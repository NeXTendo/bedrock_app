CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

ALTER TABLE public.reports
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN public_description text,
  ADD COLUMN public_address text,
  ADD COLUMN visibility_reviewed_at timestamptz,
  ADD COLUMN visibility_reviewed_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.report_photos
  ADD COLUMN bucket_id text NOT NULL DEFAULT 'report-photos',
  ADD COLUMN is_public_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN photo_reviewed_at timestamptz,
  ADD COLUMN photo_reviewed_by uuid REFERENCES public.profiles(id);

CREATE TABLE public.report_visibility_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
  decision text NOT NULL CHECK (decision IN ('published', 'withheld')),
  note text,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX report_visibility_reviews_report_time_idx
  ON public.report_visibility_reviews (report_id, reviewed_at DESC);

ALTER TABLE public.report_visibility_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.report_visibility_reviews FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.can_review_report(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    LEFT JOIN public.categories c ON c.id = r.category_id
    LEFT JOIN public.assignments a ON a.report_id = r.id
    JOIN public.profiles actor ON actor.id = auth.uid()
    WHERE r.id = p_report_id
      AND actor.role IN ('staff', 'admin')
      AND NOT COALESCE(actor.is_suspended, true)
      AND actor.department_id = COALESCE(c.dept_id, a.department_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.can_view_private_report(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id = p_report_id
      AND (
        r.user_id = auth.uid()
        OR private.can_review_report(r.id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_view_report_photo(
  p_report_id uuid,
  p_is_public_approved boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id = p_report_id
      AND (
        (r.is_public AND r.public_description IS NOT NULL AND p_is_public_approved)
        OR r.user_id = auth.uid()
        OR private.can_review_report(r.id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_view_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
  SELECT p_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles target
      JOIN public.profiles actor
        ON actor.id = auth.uid()
       AND actor.department_id = target.department_id
      WHERE target.id = p_profile_id
        AND target.role IN ('staff', 'admin')
        AND actor.role IN ('staff', 'admin')
        AND NOT COALESCE(actor.is_suspended, true)
    );
$$;

CREATE OR REPLACE FUNCTION private.can_view_report_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.report_photos photo
    WHERE photo.bucket_id = 'report-photos'
      AND photo.image_url = p_object_name
      AND private.can_view_report_photo(photo.report_id, photo.is_public_approved)
  )
  OR (
    p_object_name ~ '^avatars/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-'
    AND private.can_view_profile(
      substring(p_object_name from '^avatars/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-')::uuid
    )
  );
$$;

REVOKE ALL ON FUNCTION private.can_review_report(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_view_private_report(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_view_report_photo(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_view_report_object(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_view_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_review_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_private_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_report_photo(uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_report_object(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_profile(uuid) TO authenticated;

REVOKE SELECT ON TABLE public.reports FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.reports FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Reports are viewable by everyone" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Staff and admins can update reports" ON public.reports;

REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, full_name, phone, avatar_url, role, department_id, zone_id,
  xp_points, level, is_suspended, created_at
) ON TABLE public.profiles TO authenticated;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view permitted profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (private.can_view_profile(id));

CREATE OR REPLACE VIEW public.public_reports
WITH (security_barrier = true)
AS
SELECT
  r.id,
  r.category_id,
  r.public_description AS description,
  r.severity,
  round(r.latitude, 2) AS latitude,
  round(r.longitude, 2) AS longitude,
  r.public_address AS address,
  r.status,
  r.created_at,
  r.updated_at,
  r.resolved_at,
  r.priority,
  r.confirmation_count,
  false AS is_owner,
  jsonb_build_object('name', c.name, 'icon', c.icon, 'color', c.color) AS categories,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', photo.id,
        'image_url', photo.image_url,
        'bucket_id', photo.bucket_id,
        'is_public_approved', photo.is_public_approved,
        'uploaded_at', photo.uploaded_at,
        'is_primary', photo.is_primary
      )
      ORDER BY photo.is_primary DESC, photo.uploaded_at
    )
    FROM public.report_photos photo
    WHERE photo.report_id = r.id
      AND photo.is_public_approved
  ), '[]'::jsonb) AS report_photos,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', history.id,
        'old_status', history.old_status,
        'new_status', history.new_status,
        'changed_at', history.changed_at
      )
      ORDER BY history.changed_at
    )
    FROM public.status_history history
    WHERE history.report_id = r.id
  ), '[]'::jsonb) AS status_history
FROM public.reports r
LEFT JOIN public.categories c ON c.id = r.category_id
WHERE r.is_public
  AND r.public_description IS NOT NULL;

CREATE OR REPLACE VIEW public.my_reports
WITH (security_barrier = true)
AS
SELECT
  r.id,
  r.user_id,
  r.category_id,
  r.description,
  r.severity,
  r.latitude,
  r.longitude,
  r.address,
  r.zone_id,
  r.status,
  r.priority,
  r.is_anonymous,
  r.confirmation_count,
  r.created_at,
  r.updated_at,
  r.resolved_at,
  r.is_public,
  r.public_description,
  r.public_address,
  r.visibility_reviewed_at,
  true AS is_owner,
  jsonb_build_object('name', c.name, 'icon', c.icon, 'color', c.color) AS categories,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', photo.id,
        'image_url', photo.image_url,
        'bucket_id', photo.bucket_id,
        'is_public_approved', photo.is_public_approved,
        'uploaded_at', photo.uploaded_at,
        'is_primary', photo.is_primary
      )
      ORDER BY photo.is_primary DESC, photo.uploaded_at
    )
    FROM public.report_photos photo
    WHERE photo.report_id = r.id
  ), '[]'::jsonb) AS report_photos,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', history.id,
        'old_status', history.old_status,
        'new_status', history.new_status,
        'changed_at', history.changed_at
      )
      ORDER BY history.changed_at
    )
    FROM public.status_history history
    WHERE history.report_id = r.id
  ), '[]'::jsonb) AS status_history
FROM public.reports r
LEFT JOIN public.categories c ON c.id = r.category_id
WHERE r.user_id = auth.uid();

CREATE OR REPLACE VIEW public.department_reports
WITH (security_barrier = true)
AS
SELECT
  r.id,
  r.category_id,
  r.description,
  r.severity,
  r.latitude,
  r.longitude,
  r.address,
  r.zone_id,
  r.status,
  r.priority,
  r.is_anonymous,
  r.confirmation_count,
  r.created_at,
  r.updated_at,
  r.resolved_at,
  r.is_public,
  r.public_description,
  r.public_address,
  r.visibility_reviewed_at,
  r.visibility_reviewed_by,
  false AS is_owner,
  jsonb_build_object('name', c.name, 'icon', c.icon, 'color', c.color) AS categories,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', photo.id,
        'image_url', photo.image_url,
        'bucket_id', photo.bucket_id,
        'is_public_approved', photo.is_public_approved,
        'uploaded_at', photo.uploaded_at,
        'is_primary', photo.is_primary
      )
      ORDER BY photo.is_primary DESC, photo.uploaded_at
    )
    FROM public.report_photos photo
    WHERE photo.report_id = r.id
  ), '[]'::jsonb) AS report_photos,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', history.id,
        'old_status', history.old_status,
        'new_status', history.new_status,
        'changed_by', history.changed_by,
        'note', history.note,
        'changed_at', history.changed_at,
        'profiles', CASE
          WHEN actor.id IS NULL THEN NULL
          ELSE jsonb_build_object('full_name', actor.full_name)
        END
      )
      ORDER BY history.changed_at
    )
    FROM public.status_history history
    LEFT JOIN public.profiles actor ON actor.id = history.changed_by
    WHERE history.report_id = r.id
  ), '[]'::jsonb) AS status_history,
  (
    SELECT jsonb_build_object(
      'id', a.id,
      'report_id', a.report_id,
      'department_id', a.department_id,
      'assigned_to', a.assigned_to,
      'notes', a.notes,
      'assigned_at', a.assigned_at,
      'profiles', CASE
        WHEN assigned.id IS NULL THEN NULL
        ELSE jsonb_build_object('full_name', assigned.full_name)
      END,
      'teams', CASE
        WHEN team.id IS NULL THEN NULL
        ELSE jsonb_build_object('name', team.name)
      END,
      'assignment_members', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'profile_id', member.profile_id,
            'assigned_role', member.assigned_role,
            'is_team_lead', member.is_team_lead,
            'profiles', jsonb_build_object('full_name', worker.full_name)
          )
        )
        FROM public.assignment_members member
        JOIN public.profiles worker ON worker.id = member.profile_id
        WHERE member.assignment_id = a.id
      ), '[]'::jsonb)
    )
    FROM public.assignments a
    LEFT JOIN public.profiles assigned ON assigned.id = a.assigned_to
    LEFT JOIN public.teams team ON team.id = a.team_id
    WHERE a.report_id = r.id
  ) AS assignments
FROM public.reports r
LEFT JOIN public.categories c ON c.id = r.category_id
WHERE private.can_review_report(r.id);

GRANT SELECT ON public.public_reports, public.my_reports, public.department_reports
  TO anon, authenticated;

REVOKE ALL ON TABLE public.report_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.report_photos TO anon, authenticated;
DROP POLICY IF EXISTS "Report photos are viewable by everyone" ON public.report_photos;
DROP POLICY IF EXISTS "Report owners can upload photos" ON public.report_photos;
CREATE POLICY "Report photos visible to authorized viewers"
  ON public.report_photos
  FOR SELECT
  TO anon, authenticated
  USING (private.can_view_report_photo(report_id, is_public_approved));

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.status_history
  FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.status_history TO authenticated;
DROP POLICY IF EXISTS "Status history viewable by everyone" ON public.status_history;
CREATE POLICY "Private report history visible to owner and department"
  ON public.status_history
  FOR SELECT
  TO authenticated
  USING (private.can_view_private_report(report_id));

CREATE OR REPLACE VIEW public.public_status_history
WITH (security_barrier = true)
AS
SELECT
  history.id,
  history.report_id,
  history.old_status,
  history.new_status,
  history.changed_at
FROM public.status_history history
JOIN public.reports r ON r.id = history.report_id
WHERE r.is_public
  AND r.public_description IS NOT NULL;

GRANT SELECT ON public.public_status_history TO anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.comments
  FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Public comments viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Internal comments viewable by staff/admins" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can comment" ON public.comments;

REVOKE ALL ON TABLE public.report_confirmations FROM PUBLIC, anon, authenticated;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg']::text[]
WHERE id = 'report-photos';

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;

CREATE POLICY "Report evidence is readable only when authorized"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'report-photos'
    AND private.can_view_report_object(name)
  );

CREATE POLICY "Users upload only their own report photos and avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'report-photos'
    AND (
      name LIKE auth.uid()::text || '/%'
      OR name LIKE 'avatars/' || auth.uid()::text || '-%'
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND NOT COALESCE(p.is_suspended, true)
    )
  );

CREATE POLICY "Users delete only their own uploaded objects"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'report-photos'
    AND owner = auth.uid()
  );

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

  SELECT c.dept_id INTO v_dept_id
  FROM public.categories c
  WHERE c.id = p_category_id;

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

  IF v_dept_id IS NOT NULL THEN
    INSERT INTO public.assignments (report_id, department_id, assigned_by)
    VALUES (v_report_id, v_dept_id, auth.uid());

    UPDATE public.reports
    SET status = 'ASSIGNED'
    WHERE id = v_report_id;
  END IF;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_report(uuid, text, text, numeric, numeric, text, text[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_report(uuid, text, text, numeric, numeric, text, text[], boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.review_report_visibility(
  p_report_id uuid,
  p_publish boolean,
  p_public_description text DEFAULT NULL,
  p_public_address text DEFAULT NULL,
  p_approved_photo_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
  v_approved_photo_ids uuid[] := COALESCE(p_approved_photo_ids, ARRAY[]::uuid[]);
BEGIN
  IF auth.uid() IS NULL OR p_publish IS NULL THEN
    RAISE EXCEPTION 'Authentication and a review decision are required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_review_report(p_report_id) THEN
    RAISE EXCEPTION 'Report is not available for review in your department'
      USING ERRCODE = '42501';
  END IF;

  IF p_publish AND (
    length(btrim(COALESCE(p_public_description, ''))) = 0
    OR length(p_public_description) > 1000
    OR length(COALESCE(p_public_address, '')) > 200
  ) THEN
    RAISE EXCEPTION 'Provide a sanitized public description and a short area label'
      USING ERRCODE = '22023';
  END IF;

  IF NOT p_publish AND length(btrim(COALESCE(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'A reason is required when keeping a report private'
      USING ERRCODE = '22023';
  END IF;

  IF length(COALESCE(p_note, '')) > 1000 THEN
    RAISE EXCEPTION 'Review note exceeds the allowed length' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_approved_photo_ids) requested(id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.report_photos photo
      WHERE photo.id = requested.id
        AND photo.report_id = p_report_id
    )
  ) THEN
    RAISE EXCEPTION 'A selected photo does not belong to this report'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.reports
  SET is_public = p_publish,
      public_description = CASE
        WHEN p_publish THEN btrim(p_public_description)
        ELSE NULL
      END,
      public_address = CASE
        WHEN p_publish THEN NULLIF(btrim(p_public_address), '')
        ELSE NULL
      END,
      visibility_reviewed_at = now(),
      visibility_reviewed_by = auth.uid()
  WHERE id = p_report_id;

  UPDATE public.report_photos
  SET is_public_approved = p_publish AND id = ANY(v_approved_photo_ids),
      photo_reviewed_at = now(),
      photo_reviewed_by = auth.uid()
  WHERE report_id = p_report_id;

  INSERT INTO public.report_visibility_reviews (
    report_id, reviewer_id, decision, note
  )
  VALUES (
    p_report_id,
    auth.uid(),
    CASE WHEN p_publish THEN 'published' ELSE 'withheld' END,
    NULLIF(btrim(p_note), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_report_visibility(uuid, boolean, text, text, uuid[], text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_report_visibility(uuid, boolean, text, text, uuid[], text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_nearby_reports(numeric, numeric, integer, uuid[], text[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_duplicate_reports(numeric, numeric, uuid, integer)
  FROM PUBLIC, anon, authenticated;
