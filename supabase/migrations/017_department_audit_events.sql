ALTER TABLE public.report_visibility_reviews
  ADD COLUMN approved_photo_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

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
    report_id,
    reviewer_id,
    decision,
    note,
    approved_photo_ids
  )
  VALUES (
    p_report_id,
    auth.uid(),
    CASE WHEN p_publish THEN 'published' ELSE 'withheld' END,
    NULLIF(btrim(p_note), ''),
    CASE WHEN p_publish THEN v_approved_photo_ids ELSE ARRAY[]::uuid[] END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_report_visibility(uuid, boolean, text, text, uuid[], text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_report_visibility(uuid, boolean, text, text, uuid[], text)
  TO authenticated;

CREATE OR REPLACE VIEW public.department_audit_events
WITH (security_barrier = true)
AS
SELECT
  history.id AS event_id,
  'status'::text AS event_type,
  history.report_id,
  history.changed_by AS actor_id,
  actor.full_name AS actor_name,
  history.old_status,
  history.new_status,
  NULL::text AS decision,
  history.note,
  ARRAY[]::uuid[] AS approved_photo_ids,
  history.changed_at AS occurred_at
FROM public.status_history history
JOIN public.reports report ON report.id = history.report_id
LEFT JOIN public.profiles actor ON actor.id = history.changed_by
WHERE private.can_review_report(report.id)

UNION ALL

SELECT
  review.id AS event_id,
  'visibility_review'::text AS event_type,
  review.report_id,
  review.reviewer_id AS actor_id,
  actor.full_name AS actor_name,
  NULL::text AS old_status,
  NULL::text AS new_status,
  review.decision AS decision,
  review.note,
  review.approved_photo_ids,
  review.reviewed_at AS occurred_at
FROM public.report_visibility_reviews review
JOIN public.reports report ON report.id = review.report_id
LEFT JOIN public.profiles actor ON actor.id = review.reviewer_id
WHERE private.can_review_report(report.id);

GRANT SELECT ON public.department_audit_events TO authenticated;
