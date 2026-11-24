ALTER TABLE public.assignment_members
  ADD COLUMN progress_status text NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN progress_note text,
  ADD COLUMN progress_updated_at timestamptz,
  ADD COLUMN progress_updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN role_updated_at timestamptz,
  ADD COLUMN role_updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT assignment_members_progress_status_check
    CHECK (progress_status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE')),
  ADD CONSTRAINT assignment_members_progress_note_length_check
    CHECK (progress_note IS NULL OR length(progress_note) <= 1000);

CREATE OR REPLACE FUNCTION private.can_view_team(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams team
    JOIN public.profiles actor ON actor.id = auth.uid()
    WHERE team.id = p_team_id
      AND team.department_id = actor.department_id
      AND actor.role IN ('admin', 'staff')
      AND NOT COALESCE(actor.is_suspended, true)
      AND (
        actor.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.team_members member
          WHERE member.team_id = team.id
            AND member.profile_id = actor.id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_view_team(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_team(uuid) TO authenticated;

DROP POLICY IF EXISTS "Department staff can view teams" ON public.teams;
CREATE POLICY "Team members and admins can view teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (private.can_view_team(id));

DROP POLICY IF EXISTS "Department staff can view team members" ON public.team_members;
CREATE POLICY "Team members and admins can view team members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (private.can_view_team(team_id));

DROP POLICY IF EXISTS "Department staff can view team categories" ON public.team_categories;
CREATE POLICY "Team members and admins can view team categories"
  ON public.team_categories FOR SELECT
  TO authenticated
  USING (private.can_view_team(team_id));

CREATE OR REPLACE FUNCTION private.can_lead_assignment(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignments assignment
    JOIN public.profiles actor
      ON actor.id = auth.uid()
     AND actor.department_id = assignment.department_id
    JOIN public.assignment_members lead
      ON lead.assignment_id = assignment.id
     AND lead.profile_id = actor.id
     AND lead.is_team_lead
    WHERE assignment.id = p_assignment_id
      AND assignment.team_id IS NOT NULL
      AND actor.role = 'staff'
      AND NOT COALESCE(actor.is_suspended, true)
  );
$$;

REVOKE ALL ON FUNCTION private.can_lead_assignment(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_lead_assignment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_assigned_team_roles(
  p_assignment_id uuid,
  p_members jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
  v_team_id uuid;
  v_report_status text;
  v_assignment_department_id uuid;
  v_actor_department_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_members IS NULL OR jsonb_typeof(p_members) <> 'array'
    OR jsonb_array_length(p_members) = 0
  THEN
    RAISE EXCEPTION 'Provide the complete assigned team roster'
      USING ERRCODE = '22023';
  END IF;

  SELECT assignment.team_id, report.status, assignment.department_id
  INTO v_team_id, v_report_status, v_assignment_department_id
  FROM public.assignments assignment
  JOIN public.reports report ON report.id = assignment.report_id
  WHERE assignment.id = p_assignment_id
  FOR UPDATE OF report;

  IF NOT FOUND OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'This is not a team assignment'
      USING ERRCODE = '42501';
  END IF;

  SELECT department_id INTO v_actor_department_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'staff'
    AND NOT is_suspended;

  IF v_actor_department_id IS NULL
    OR v_actor_department_id IS DISTINCT FROM v_assignment_department_id
    OR NOT private.can_lead_assignment(p_assignment_id)
  THEN
    RAISE EXCEPTION 'Only the assigned Crew Lead can change job roles'
      USING ERRCODE = '42501';
  END IF;

  IF v_report_status IN ('RESOLVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Roles cannot be changed on a closed job'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS requested(profile_id uuid, assigned_role text)
    GROUP BY requested.profile_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A team member can only be listed once'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assignment_members member
    WHERE member.assignment_id = p_assignment_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_members) AS requested(profile_id uuid, assigned_role text)
        WHERE requested.profile_id = member.profile_id
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS requested(profile_id uuid, assigned_role text)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.assignment_members member
      WHERE member.assignment_id = p_assignment_id
        AND member.profile_id = requested.profile_id
    )
  ) THEN
    RAISE EXCEPTION 'Role changes must include only the complete assigned team'
      USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*)
    FROM jsonb_to_recordset(p_members) AS requested(profile_id uuid, assigned_role text)
    WHERE requested.assigned_role = 'Crew Lead'
  ) <> 1 THEN
    RAISE EXCEPTION 'A team assignment must have exactly one Crew Lead'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS requested(profile_id uuid, assigned_role text)
    LEFT JOIN public.team_members team_member
      ON team_member.team_id = v_team_id
     AND team_member.profile_id = requested.profile_id
    WHERE team_member.profile_id IS NULL
      OR NOT (requested.assigned_role = ANY(team_member.capabilities))
  ) THEN
    RAISE EXCEPTION 'Each job role must be a capability of that team member'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.assignment_members member
  SET assigned_role = requested.assigned_role,
      is_team_lead = requested.assigned_role = 'Crew Lead',
      role_updated_at = now(),
      role_updated_by = auth.uid()
  FROM jsonb_to_recordset(p_members) AS requested(profile_id uuid, assigned_role text)
  WHERE member.assignment_id = p_assignment_id
    AND member.profile_id = requested.profile_id
    AND member.assigned_role IS DISTINCT FROM requested.assigned_role;
END;
$$;

REVOKE ALL ON FUNCTION public.update_assigned_team_roles(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_assigned_team_roles(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.update_assignment_member_progress(
  p_assignment_id uuid,
  p_member_profile_id uuid,
  p_progress_status text,
  p_progress_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
  v_team_id uuid;
  v_report_status text;
  v_assignment_department_id uuid;
  v_actor_department_id uuid;
  v_new_progress_status text := upper(btrim(COALESCE(p_progress_status, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_new_progress_status NOT IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE')
    OR length(COALESCE(p_progress_note, '')) > 1000
  THEN
    RAISE EXCEPTION 'Progress status or note is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT assignment.team_id, report.status, assignment.department_id
  INTO v_team_id, v_report_status, v_assignment_department_id
  FROM public.assignments assignment
  JOIN public.reports report ON report.id = assignment.report_id
  WHERE assignment.id = p_assignment_id
  FOR UPDATE OF report;

  IF NOT FOUND OR v_team_id IS NULL THEN
    RAISE EXCEPTION 'This is not a team assignment'
      USING ERRCODE = '42501';
  END IF;

  SELECT department_id INTO v_actor_department_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'staff'
    AND NOT is_suspended;

  IF v_actor_department_id IS NULL
    OR v_actor_department_id IS DISTINCT FROM v_assignment_department_id
    OR NOT private.can_lead_assignment(p_assignment_id)
  THEN
    RAISE EXCEPTION 'Only the assigned Crew Lead can update team progress'
      USING ERRCODE = '42501';
  END IF;

  IF v_report_status IN ('RESOLVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Progress cannot be changed on a closed job'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.assignment_members
  SET progress_status = v_new_progress_status,
      progress_note = NULLIF(btrim(p_progress_note), ''),
      progress_updated_at = now(),
      progress_updated_by = auth.uid()
  WHERE assignment_id = p_assignment_id
    AND profile_id = p_member_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected worker is not assigned to this job'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_assignment_member_progress(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_assignment_member_progress(uuid, uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
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
  v_assignment_id uuid;
  v_team_id uuid;
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

  SELECT report.status, report.user_id, COALESCE(category.dept_id, assignment.department_id),
         assignment.id, assignment.team_id
  INTO v_old_status, v_user_id, v_department_id, v_assignment_id, v_team_id
  FROM public.reports report
  LEFT JOIN public.categories category ON category.id = report.category_id
  LEFT JOIN public.assignments assignment ON assignment.report_id = report.id
  WHERE report.id = p_report_id
  FOR UPDATE OF report;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_department_id IS NULL
    OR v_department_id IS DISTINCT FROM v_actor_department_id
  THEN
    RAISE EXCEPTION 'Report is not available in your department'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role = 'staff' THEN
    IF v_new_status NOT IN ('IN_PROGRESS', 'RESOLVED') THEN
      RAISE EXCEPTION 'Assigned staff may only set a report to In Progress or Resolved'
        USING ERRCODE = '42501';
    END IF;

    IF v_assignment_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.assignment_members member
      WHERE member.assignment_id = v_assignment_id
        AND member.profile_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Only staff assigned to this report can update its operational status'
        USING ERRCODE = '42501';
    END IF;

    IF v_new_status = 'RESOLVED' AND v_team_id IS NOT NULL THEN
      IF NOT private.can_lead_assignment(v_assignment_id) THEN
        RAISE EXCEPTION 'Only the assigned Crew Lead can resolve a team job'
          USING ERRCODE = '42501';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.assignment_members member
        WHERE member.assignment_id = v_assignment_id
          AND member.progress_status <> 'COMPLETE'
      ) THEN
        RAISE EXCEPTION 'Every team member must be marked complete before resolving this job'
          USING ERRCODE = '22023';
      END IF;
    END IF;
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
