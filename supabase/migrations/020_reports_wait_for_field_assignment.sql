CREATE OR REPLACE FUNCTION public.create_report(
  p_category_id uuid,
  p_description text,
  p_severity text,
  p_lat numeric,
  p_lng numeric,
  p_address text,
  p_photo_urls text[],
  p_anonymous boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $$
DECLARE
  v_report_id uuid;
  v_dept_id uuid;
  v_photo_url text;
  v_photo_urls text[] := COALESCE(p_photo_urls, ARRAY[]::text[]);
  v_prefix text;
  v_severity text := lower(btrim(COALESCE(p_severity, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND NOT COALESCE(p.is_suspended, true)
  ) THEN
    RAISE EXCEPTION 'An active account is required to submit a report'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.id = p_category_id
      AND c.is_active
  ) THEN
    RAISE EXCEPTION 'Choose an active report category' USING ERRCODE = '22023';
  END IF;

  IF p_lat IS NULL OR p_lat < -90 OR p_lat > 90
    OR p_lng IS NULL OR p_lng < -180 OR p_lng > 180
  THEN
    RAISE EXCEPTION 'Report coordinates are invalid' USING ERRCODE = '22023';
  END IF;

  IF v_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Report severity is invalid' USING ERRCODE = '22023';
  END IF;

  IF length(COALESCE(p_description, '')) > 2000
    OR length(COALESCE(p_address, '')) > 500
  THEN
    RAISE EXCEPTION 'Report text exceeds the allowed length' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_photo_urls) > 5 THEN
    RAISE EXCEPTION 'Attach no more than five report photos' USING ERRCODE = '22023';
  END IF;

  v_prefix := auth.uid()::text || '/';
  FOREACH v_photo_url IN ARRAY v_photo_urls LOOP
    IF v_photo_url IS NULL
      OR left(v_photo_url, length(v_prefix)) <> v_prefix
      OR v_photo_url ~ '(^|/)\.\.?(/|$)'
      OR NOT EXISTS (
        SELECT 1
        FROM storage.objects object
        WHERE object.bucket_id = 'report-photos'
          AND object.name = v_photo_url
          AND object.owner = auth.uid()
      )
    THEN
      RAISE EXCEPTION 'A report photo is missing or is not owned by this account'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  INSERT INTO public.reports (
    user_id,
    category_id,
    description,
    severity,
    latitude,
    longitude,
    location,
    address,
    is_anonymous,
    is_public
  )
  VALUES (
    auth.uid(),
    p_category_id,
    NULLIF(btrim(p_description), ''),
    v_severity,
    p_lat,
    p_lng,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    NULLIF(btrim(p_address), ''),
    COALESCE(p_anonymous, false),
    false
  )
  RETURNING id INTO v_report_id;

  FOREACH v_photo_url IN ARRAY v_photo_urls LOOP
    INSERT INTO public.report_photos (
      report_id, image_url, uploaded_by, bucket_id
    )
    VALUES (
      v_report_id, v_photo_url, auth.uid(), 'report-photos'
    );
  END LOOP;

  UPDATE public.report_photos
  SET is_primary = true
  WHERE report_id = v_report_id
    AND uploaded_at = (
      SELECT min(photo.uploaded_at)
      FROM public.report_photos photo
      WHERE photo.report_id = v_report_id
    );

  SELECT rr.department_id INTO v_dept_id
  FROM public.routing_rules rr
  WHERE rr.category_id = p_category_id
    AND rr.is_active
  LIMIT 1;

  -- Route the report to its department without marking field work as assigned.
  IF v_dept_id IS NOT NULL THEN
    INSERT INTO public.assignments (report_id, department_id)
    VALUES (v_report_id, v_dept_id);
  END IF;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_report(uuid, text, text, numeric, numeric, text, text[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_report(uuid, text, text, numeric, numeric, text, text[], boolean)
  TO authenticated;

UPDATE public.reports report
SET status = 'NEW'
FROM public.assignments assignment
WHERE assignment.report_id = report.id
  AND report.status = 'ASSIGNED'
  AND assignment.assigned_to IS NULL
  AND assignment.team_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.assignment_members member
    WHERE member.assignment_id = assignment.id
  );

UPDATE public.assignments assignment
SET assigned_by = NULL
WHERE assignment.assigned_to IS NULL
  AND assignment.team_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.assignment_members member
    WHERE member.assignment_id = assignment.id
  );
