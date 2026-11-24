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
      AND NOT COALESCE(actor.is_suspended, true)
      AND actor.department_id = COALESCE(c.dept_id, a.department_id)
      AND (
        actor.role = 'admin'
        OR (
          actor.role = 'staff'
          AND EXISTS (
            SELECT 1
            FROM public.assignments assigned
            JOIN public.assignment_members member
              ON member.assignment_id = assigned.id
            WHERE assigned.report_id = r.id
              AND assigned.department_id = actor.department_id
              AND member.profile_id = actor.id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_review_report(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_review_report(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.can_view_assignment(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignments assignment
    JOIN public.profiles actor ON actor.id = auth.uid()
    WHERE assignment.id = p_assignment_id
      AND assignment.department_id = actor.department_id
      AND NOT COALESCE(actor.is_suspended, true)
      AND (
        actor.role = 'admin'
        OR (
          actor.role = 'staff'
          AND EXISTS (
            SELECT 1
            FROM public.assignment_members member
            WHERE member.assignment_id = assignment.id
              AND member.profile_id = actor.id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_view_assignment(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_assignment(uuid) TO authenticated;

DROP POLICY IF EXISTS "Department staff can view assignments" ON public.assignments;
DROP POLICY IF EXISTS "Department staff can manage assignments" ON public.assignments;
CREATE POLICY "Assigned staff and admins can view assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (private.can_view_assignment(id));

DROP POLICY IF EXISTS "Department staff can view assignment members" ON public.assignment_members;
DROP POLICY IF EXISTS "Department staff can manage assignment members" ON public.assignment_members;
CREATE POLICY "Assigned staff and admins can view assignment members"
  ON public.assignment_members FOR SELECT
  TO authenticated
  USING (private.can_view_assignment(assignment_id));

REVOKE ALL ON TABLE public.assignments, public.assignment_members
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.assignments, public.assignment_members
  TO authenticated;

REVOKE ALL ON FUNCTION public.save_report_assignment(uuid, uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_best_dispatch_recommendation(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_best_dispatch_recommendation(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_department_id uuid;
  v_department_id uuid;
  v_actor_role text;
  v_is_suspended boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT role, department_id, is_suspended
  INTO v_actor_role, v_actor_department_id, v_is_suspended
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND
    OR v_actor_role <> 'admin'
    OR COALESCE(v_is_suspended, true)
  THEN
    RAISE EXCEPTION 'An active department admin is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT c.dept_id
  INTO v_department_id
  FROM public.reports r
  JOIN public.categories c ON c.id = r.category_id
  WHERE r.id = p_report_id;

  IF NOT FOUND OR v_department_id IS DISTINCT FROM v_actor_department_id THEN
    RAISE EXCEPTION 'Report is not available in your department'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.get_best_dispatch_recommendation(p_report_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_best_dispatch_recommendation(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_best_dispatch_recommendation(uuid)
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
  v_actor_role text;
  v_actor_suspended boolean;
BEGIN
  IF auth.uid() IS NULL OR p_publish IS NULL THEN
    RAISE EXCEPTION 'Authentication and a review decision are required'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, is_suspended
  INTO v_actor_role, v_actor_suspended
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR v_actor_role <> 'admin' OR COALESCE(v_actor_suspended, true) THEN
    RAISE EXCEPTION 'Only an active department admin can review public release'
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
