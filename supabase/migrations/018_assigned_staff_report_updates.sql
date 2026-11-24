CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_status text;
  v_user_id uuid;
  v_department_id uuid;
  v_actor_department_id uuid;
  v_actor_role text;
  v_is_suspended boolean;
  v_new_status text;
  v_status_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_new_status := upper(btrim(COALESCE(p_new_status, '')));
  IF v_new_status NOT IN (
    'NEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'
  ) THEN
    RAISE EXCEPTION 'Invalid report status' USING ERRCODE = '22023';
  END IF;

  SELECT role, department_id, is_suspended
  INTO v_actor_role, v_actor_department_id, v_is_suspended
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND
    OR v_actor_role NOT IN ('staff', 'admin')
    OR COALESCE(v_is_suspended, true)
  THEN
    RAISE EXCEPTION 'An active department staff account is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.status, r.user_id, COALESCE(c.dept_id, a.department_id)
  INTO v_old_status, v_user_id, v_department_id
  FROM public.reports AS r
  LEFT JOIN public.categories AS c ON c.id = r.category_id
  LEFT JOIN public.assignments AS a ON a.report_id = r.id
  WHERE r.id = p_report_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_department_id IS NULL
    OR v_department_id IS DISTINCT FROM v_actor_department_id
  THEN
    RAISE EXCEPTION 'Report is not available in your department'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role = 'staff' AND NOT EXISTS (
    SELECT 1
    FROM public.assignments assignment
    JOIN public.assignment_members member
      ON member.assignment_id = assignment.id
    WHERE assignment.report_id = p_report_id
      AND assignment.department_id = v_actor_department_id
      AND member.profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only staff assigned to this report can update its operational status'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.reports
  SET status = v_new_status,
      updated_at = now(),
      resolved_at = CASE WHEN v_new_status = 'RESOLVED' THEN now() ELSE NULL END
  WHERE id = p_report_id;

  INSERT INTO public.status_history
    (report_id, old_status, new_status, changed_by, note)
  VALUES
    (p_report_id, v_old_status, v_new_status, auth.uid(), p_note);

  v_status_label := CASE v_new_status
    WHEN 'NEW' THEN 'New'
    WHEN 'VERIFIED' THEN 'Verified'
    WHEN 'ASSIGNED' THEN 'Assigned'
    WHEN 'IN_PROGRESS' THEN 'In progress'
    WHEN 'RESOLVED' THEN 'Resolved'
    WHEN 'REJECTED' THEN 'Rejected'
  END;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (user_id, report_id, type, title, body)
    VALUES
      (v_user_id, p_report_id, 'status_change', 'Report status updated',
       'Your report is now ' || v_status_label || '.');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_report_status(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_report_status(uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_report_assignment(
  p_report_id uuid,
  p_worker_id uuid,
  p_team_id uuid,
  p_notes text,
  p_members jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_status text;
  v_user_id uuid;
  v_department_id uuid;
  v_actor_department_id uuid;
  v_actor_role text;
  v_is_suspended boolean;
  v_assignment_id uuid;
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
    RAISE EXCEPTION 'Only an active department admin can assign reports'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.status, r.user_id, c.dept_id
  INTO v_old_status, v_user_id, v_department_id
  FROM public.reports r
  JOIN public.categories c ON c.id = r.category_id
  WHERE r.id = p_report_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_department_id IS NULL
    OR v_department_id IS DISTINCT FROM v_actor_department_id
  THEN
    RAISE EXCEPTION 'Report is not available in your department'
      USING ERRCODE = '42501';
  END IF;

  v_assignment_id := public.save_report_assignment(
    p_report_id,
    p_worker_id,
    p_team_id,
    p_notes,
    p_members
  );

  IF v_old_status IN ('NEW', 'VERIFIED') THEN
    UPDATE public.reports
    SET status = 'ASSIGNED',
        updated_at = now(),
        resolved_at = NULL
    WHERE id = p_report_id;

    INSERT INTO public.status_history
      (report_id, old_status, new_status, changed_by, note)
    VALUES
      (p_report_id, v_old_status, 'ASSIGNED', auth.uid(), 'Assigned for field work.');

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.notifications
        (user_id, report_id, type, title, body)
      VALUES
        (v_user_id, p_report_id, 'status_change', 'Report assigned',
         'Your report has been assigned for field work.');
    END IF;
  END IF;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_report_assignment(uuid, uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_report_assignment(uuid, uuid, uuid, text, jsonb)
  TO authenticated;
