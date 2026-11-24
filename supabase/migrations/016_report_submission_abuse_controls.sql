ALTER TABLE public.reports
  ADD COLUMN potential_duplicate_of uuid
    REFERENCES public.reports(id) ON DELETE SET NULL;

CREATE INDEX reports_user_created_at_idx
  ON public.reports (user_id, created_at DESC);

CREATE INDEX reports_category_created_at_idx
  ON public.reports (category_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.enforce_report_submission_controls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_suspended boolean;
  v_hour_count bigint;
  v_day_count bigint;
BEGIN
  IF v_actor_id IS NOT NULL THEN
    IF NEW.user_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'A report can only be submitted for the authenticated account'
        USING ERRCODE = '42501';
    END IF;

    SELECT p.is_suspended
    INTO v_is_suspended
    FROM public.profiles p
    WHERE p.id = v_actor_id
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_is_suspended, true) THEN
      RAISE EXCEPTION 'An active account is required to submit a report'
        USING ERRCODE = '42501';
    END IF;

    SELECT
      count(*) FILTER (WHERE submitted.created_at >= now() - interval '1 hour'),
      count(*) FILTER (WHERE submitted.created_at >= now() - interval '24 hours')
    INTO v_hour_count, v_day_count
    FROM public.reports submitted
    WHERE submitted.user_id = v_actor_id;

    IF v_hour_count >= 3 THEN
      RAISE EXCEPTION 'Submission limit reached: maximum 3 reports per hour. Try again later.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_day_count >= 10 THEN
      RAISE EXCEPTION 'Submission limit reached: maximum 10 reports per day. Try again later.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  NEW.potential_duplicate_of := NULL;

  SELECT existing_report.id
  INTO NEW.potential_duplicate_of
  FROM public.reports existing_report
  WHERE existing_report.category_id = NEW.category_id
    AND existing_report.status NOT IN ('RESOLVED', 'REJECTED')
    AND existing_report.created_at >= now() - interval '24 hours'
    AND ST_DWithin(existing_report.location, NEW.location, 100)
  ORDER BY ST_Distance(existing_report.location, NEW.location), existing_report.created_at DESC
  LIMIT 1;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_report_submission_controls()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_report_submission_controls
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_report_submission_controls();

CREATE OR REPLACE VIEW public.department_report_duplicate_flags
WITH (security_barrier = true)
AS
SELECT
  submitted.id AS report_id,
  candidate.id AS duplicate_report_id,
  candidate.status AS duplicate_status,
  candidate.created_at AS duplicate_created_at
FROM public.reports submitted
JOIN public.reports candidate ON candidate.id = submitted.potential_duplicate_of
WHERE private.can_review_report(submitted.id)
  AND private.can_review_report(candidate.id);

GRANT SELECT ON public.department_report_duplicate_flags TO authenticated;
