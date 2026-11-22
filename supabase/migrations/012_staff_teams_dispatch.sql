UPDATE public.profiles
SET is_suspended = false
WHERE is_suspended IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN is_suspended SET DEFAULT false,
  ALTER COLUMN is_suspended SET NOT NULL;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX teams_department_name_unique
  ON public.teams (department_id, lower(name));

CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  primary_role text NOT NULL,
  capabilities text[] NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, profile_id),
  CHECK (primary_role = ANY(capabilities)),
  CHECK (
    capabilities <@ ARRAY[
      'Crew Lead',
      'Field Technician',
      'Driver / Equipment Operator',
      'Inspector / Verifier',
      'Safety Officer',
      'General Worker'
    ]::text[]
  )
);

CREATE TABLE public.team_categories (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, category_id)
);

ALTER TABLE public.assignments
  ADD COLUMN team_id uuid REFERENCES public.teams(id);

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_single_assignment_target
  CHECK (team_id IS NULL OR assigned_to IS NULL);

CREATE TABLE public.assignment_members (
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  assigned_role text NOT NULL,
  is_team_lead boolean NOT NULL DEFAULT false,
  PRIMARY KEY (assignment_id, profile_id),
  CHECK (assigned_role IN (
    'Crew Lead',
    'Field Technician',
    'Driver / Equipment Operator',
    'Inspector / Verifier',
    'Safety Officer',
    'General Worker'
  )),
  CHECK (is_team_lead = (assigned_role = 'Crew Lead'))
);

INSERT INTO public.assignment_members (assignment_id, profile_id, assigned_role)
SELECT id, assigned_to, 'General Worker'
FROM public.assignments
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX teams_department_active_idx
  ON public.teams (department_id, is_active);
CREATE INDEX team_members_profile_idx
  ON public.team_members (profile_id);
CREATE INDEX team_categories_category_idx
  ON public.team_categories (category_id);
CREATE INDEX assignments_team_idx
  ON public.assignments (team_id);
CREATE INDEX assignment_members_profile_idx
  ON public.assignment_members (profile_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Department staff can view teams"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = teams.department_id
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
    )
  );

CREATE POLICY "Department admins manage teams"
  ON public.teams FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = teams.department_id
        AND p.role = 'admin'
        AND NOT p.is_suspended
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = teams.department_id
        AND p.role = 'admin'
        AND NOT p.is_suspended
    )
  );

CREATE POLICY "Department staff can view team members"
  ON public.team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.profiles p ON p.department_id = t.department_id
      WHERE t.id = team_members.team_id
        AND p.id = auth.uid()
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
    )
  );

CREATE POLICY "Department admins manage team members"
  ON public.team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.profiles p ON p.department_id = t.department_id
      WHERE t.id = team_members.team_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
        AND NOT p.is_suspended
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.profiles p ON p.department_id = t.department_id
      JOIN public.profiles member ON member.id = team_members.profile_id
      WHERE t.id = team_members.team_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
        AND NOT p.is_suspended
        AND member.department_id = t.department_id
        AND member.role IN ('admin', 'staff')
        AND NOT member.is_suspended
    )
  );

CREATE POLICY "Department staff can view team categories"
  ON public.team_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.profiles p ON p.department_id = t.department_id
      WHERE t.id = team_categories.team_id
        AND p.id = auth.uid()
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
    )
  );

CREATE POLICY "Department admins manage team categories"
  ON public.team_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.profiles p ON p.department_id = t.department_id
      WHERE t.id = team_categories.team_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
        AND NOT p.is_suspended
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.profiles p ON p.department_id = t.department_id
      JOIN public.categories c ON c.id = team_categories.category_id
      WHERE t.id = team_categories.team_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
        AND NOT p.is_suspended
        AND c.dept_id = t.department_id
        AND c.is_active
    )
  );

CREATE POLICY "Department staff can view assignment members"
  ON public.assignment_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.profiles p ON p.department_id = a.department_id
      JOIN public.profiles member ON member.id = assignment_members.profile_id
      WHERE a.id = assignment_members.assignment_id
        AND p.id = auth.uid()
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
        AND member.department_id = a.department_id
    )
  );

CREATE POLICY "Department staff can manage assignment members"
  ON public.assignment_members FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.profiles p ON p.department_id = a.department_id
      WHERE a.id = assignment_members.assignment_id
        AND p.id = auth.uid()
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.profiles p ON p.department_id = a.department_id
      JOIN public.profiles member ON member.id = assignment_members.profile_id
      WHERE a.id = assignment_members.assignment_id
        AND p.id = auth.uid()
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
        AND member.department_id = a.department_id
        AND member.role IN ('admin', 'staff')
        AND NOT member.is_suspended
        AND (
          (a.team_id IS NULL AND a.assigned_to = assignment_members.profile_id)
          OR EXISTS (
            SELECT 1
            FROM public.team_members tm
            WHERE tm.team_id = a.team_id
              AND tm.profile_id = assignment_members.profile_id
              AND assignment_members.assigned_role = ANY(tm.capabilities)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Staff and admins can view assignments" ON public.assignments;
CREATE POLICY "Department staff can view assignments"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = assignments.department_id
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
        AND (
          assignments.team_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.teams t
            WHERE t.id = assignments.team_id
              AND t.department_id = assignments.department_id
          )
        )
        AND (
          assignments.assigned_to IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.profiles member
            WHERE member.id = assignments.assigned_to
              AND member.department_id = assignments.department_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "Staff and admins can create/update assignments" ON public.assignments;
CREATE POLICY "Department staff can manage assignments"
  ON public.assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = assignments.department_id
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
        AND (
          assignments.team_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.teams t
            WHERE t.id = assignments.team_id
              AND t.department_id = assignments.department_id
              AND t.is_active
          )
        )
        AND (
          assignments.assigned_to IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.profiles member
            WHERE member.id = assignments.assigned_to
              AND member.department_id = assignments.department_id
              AND member.role IN ('admin', 'staff')
              AND NOT member.is_suspended
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department_id = assignments.department_id
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
        AND (
          assignments.team_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.teams t
            WHERE t.id = assignments.team_id
              AND t.department_id = assignments.department_id
              AND t.is_active
          )
        )
        AND (
          assignments.assigned_to IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.profiles member
            WHERE member.id = assignments.assigned_to
              AND member.department_id = assignments.department_id
              AND member.role IN ('admin', 'staff')
              AND NOT member.is_suspended
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.save_department_team(
  p_team_id uuid,
  p_department_id uuid,
  p_name text,
  p_description text,
  p_category_ids uuid[],
  p_members jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND department_id = p_department_id
      AND role = 'admin'
      AND NOT is_suspended
  ) THEN
    RAISE EXCEPTION 'Only an active department admin can manage teams';
  END IF;

  IF length(trim(COALESCE(p_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Team name is required';
  END IF;

  IF p_members IS NULL OR jsonb_typeof(p_members) <> 'array' THEN
    RAISE EXCEPTION 'Team members must be an array';
  END IF;

  IF jsonb_array_length(p_members) = 0 THEN
    RAISE EXCEPTION 'Add at least one active team member';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS m(profile_id uuid)
    GROUP BY profile_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A team member can only be added once';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_category_ids, ARRAY[]::uuid[])) AS category_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = category_id
        AND c.dept_id = p_department_id
        AND c.is_active
    )
  ) THEN
    RAISE EXCEPTION 'Teams can only cover active categories in their department';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS m(profile_id uuid, primary_role text, capabilities text[])
    LEFT JOIN public.profiles p ON p.id = m.profile_id
    WHERE p.id IS NULL
      OR p.department_id <> p_department_id
      OR p.role NOT IN ('admin', 'staff')
      OR p.is_suspended
      OR m.primary_role IS NULL
      OR NOT (m.primary_role = ANY(COALESCE(m.capabilities, ARRAY[]::text[])))
      OR NOT (
        COALESCE(m.capabilities, ARRAY[]::text[])
        <@ ARRAY[
          'Crew Lead',
          'Field Technician',
          'Driver / Equipment Operator',
          'Inspector / Verifier',
          'Safety Officer',
          'General Worker'
        ]::text[]
      )
    )
   THEN
    RAISE EXCEPTION 'Team members must be active department staff with valid roles';
  END IF;

  IF (
    SELECT count(*)
    FROM jsonb_to_recordset(p_members) AS m(primary_role text)
    WHERE m.primary_role = 'Crew Lead'
  ) <> 1 THEN
    RAISE EXCEPTION 'Each team must have exactly one Crew Lead';
  END IF;

  IF p_team_id IS NULL THEN
    INSERT INTO public.teams (department_id, name, description, created_by)
    VALUES (p_department_id, trim(p_name), NULLIF(trim(p_description), ''), auth.uid())
    RETURNING id INTO v_team_id;
  ELSE
    UPDATE public.teams
    SET name = trim(p_name),
        description = NULLIF(trim(p_description), ''),
        updated_at = now()
    WHERE id = p_team_id
      AND department_id = p_department_id
    RETURNING id INTO v_team_id;

    IF v_team_id IS NULL THEN
      RAISE EXCEPTION 'Team not found in this department';
    END IF;
  END IF;

  DELETE FROM public.team_categories WHERE team_id = v_team_id;
  INSERT INTO public.team_categories (team_id, category_id)
  SELECT v_team_id, category_id
  FROM unnest(COALESCE(p_category_ids, ARRAY[]::uuid[])) AS category_id
  ON CONFLICT DO NOTHING;

  DELETE FROM public.team_members WHERE team_id = v_team_id;
  INSERT INTO public.team_members (team_id, profile_id, primary_role, capabilities)
  SELECT v_team_id, m.profile_id, m.primary_role, m.capabilities
  FROM jsonb_to_recordset(p_members) AS m(
    profile_id uuid,
    primary_role text,
    capabilities text[]
  );

  RETURN v_team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_best_dispatch_recommendation(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id uuid;
  v_category_id uuid;
  v_team_id uuid;
  v_team_name text;
  v_members jsonb;
  v_has_match boolean;
BEGIN
  SELECT c.dept_id, r.category_id
  INTO v_department_id, v_category_id
  FROM public.reports r
  JOIN public.categories c ON c.id = r.category_id
  WHERE r.id = p_report_id;

  IF v_department_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND department_id = v_department_id
      AND role IN ('admin', 'staff')
      AND NOT is_suspended
  ) THEN
    RAISE EXCEPTION 'Report is not available in your department';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.team_categories tc ON tc.team_id = t.id
    WHERE t.department_id = v_department_id
      AND t.is_active
      AND tc.category_id = v_category_id
      AND EXISTS (
        SELECT 1
        FROM public.team_members tm
        JOIN public.profiles p ON p.id = tm.profile_id
        WHERE tm.team_id = t.id
          AND p.role IN ('admin', 'staff')
          AND NOT p.is_suspended
      )
  )
  INTO v_has_match;

  SELECT t.id, t.name
  INTO v_team_id, v_team_name
  FROM public.teams t
  WHERE t.department_id = v_department_id
    AND t.is_active
    AND EXISTS (
      SELECT 1
      FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE tm.team_id = t.id
        AND p.role IN ('admin', 'staff')
        AND NOT p.is_suspended
    )
  ORDER BY
    CASE
      WHEN v_has_match AND EXISTS (
        SELECT 1 FROM public.team_categories tc
        WHERE tc.team_id = t.id AND tc.category_id = v_category_id
      ) THEN 0
      WHEN v_has_match THEN 1
      WHEN NOT EXISTS (
        SELECT 1 FROM public.team_categories tc WHERE tc.team_id = t.id
      ) THEN 0
      ELSE 1
    END,
    (
      SELECT count(DISTINCT a.id)
      FROM public.assignments a
      JOIN public.reports r ON r.id = a.report_id
      WHERE (
        a.team_id = t.id
        OR EXISTS (
          SELECT 1
          FROM public.assignment_members am
          JOIN public.team_members tm
            ON tm.team_id = t.id AND tm.profile_id = am.profile_id
          WHERE am.assignment_id = a.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.team_members tm
          WHERE tm.team_id = t.id AND tm.profile_id = a.assigned_to
        )
      )
        AND r.status NOT IN ('RESOLVED', 'REJECTED')
    ),
    t.created_at,
    t.id
  LIMIT 1;

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('team_id', NULL, 'team_name', NULL, 'members', '[]'::jsonb);
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', p.id,
        'full_name', COALESCE(p.full_name, 'Staff Member'),
        'assigned_role', tm.primary_role,
        'capabilities', tm.capabilities,
        'open_assignments', COALESCE(workload.open_assignments, 0),
        'is_team_lead', tm.primary_role = 'Crew Lead'
      )
      ORDER BY COALESCE(workload.open_assignments, 0), tm.primary_role, p.full_name
    ),
    '[]'::jsonb
  )
  INTO v_members
  FROM public.team_members tm
  JOIN public.profiles p ON p.id = tm.profile_id
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT a.id)::integer AS open_assignments
    FROM public.assignments a
    JOIN public.reports r ON r.id = a.report_id
    LEFT JOIN public.assignment_members am ON am.assignment_id = a.id
    WHERE (am.profile_id = p.id OR a.assigned_to = p.id)
      AND r.status NOT IN ('RESOLVED', 'REJECTED')
  ) workload ON true
  WHERE tm.team_id = v_team_id
    AND p.role IN ('admin', 'staff')
    AND NOT p.is_suspended;

  RETURN jsonb_build_object(
    'team_id', v_team_id,
    'team_name', v_team_name,
    'members', v_members
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_report_assignment(
  p_report_id uuid,
  p_worker_id uuid,
  p_team_id uuid,
  p_notes text,
  p_members jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id uuid;
  v_assignment_id uuid;
BEGIN
  IF (p_worker_id IS NULL) = (p_team_id IS NULL) THEN
    RAISE EXCEPTION 'Choose either one worker or one team';
  END IF;

  SELECT c.dept_id INTO v_department_id
  FROM public.reports r
  JOIN public.categories c ON c.id = r.category_id
  WHERE r.id = p_report_id;

  IF v_department_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND department_id = v_department_id
      AND role IN ('admin', 'staff')
      AND NOT is_suspended
  ) THEN
    RAISE EXCEPTION 'Report is not available in your department';
  END IF;

  IF p_members IS NULL OR jsonb_typeof(p_members) <> 'array' THEN
    RAISE EXCEPTION 'Assignment members must be an array';
  END IF;

  IF jsonb_array_length(p_members) = 0 THEN
    RAISE EXCEPTION 'Select at least one active worker';
  END IF;

  IF p_team_id IS NOT NULL AND (
    SELECT count(*)
    FROM jsonb_to_recordset(p_members) AS m(assigned_role text)
    WHERE m.assigned_role = 'Crew Lead'
  ) <> 1 THEN
    RAISE EXCEPTION 'A team assignment must have exactly one Crew Lead';
  END IF;

  IF p_team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = p_team_id
        AND department_id = v_department_id
        AND is_active
    ) THEN
      RAISE EXCEPTION 'Team is not active in this department';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_members) AS m(profile_id uuid, assigned_role text)
      LEFT JOIN public.team_members tm
        ON tm.team_id = p_team_id AND tm.profile_id = m.profile_id
      LEFT JOIN public.profiles p ON p.id = m.profile_id
      WHERE tm.profile_id IS NULL
        OR p.department_id <> v_department_id
        OR p.role NOT IN ('admin', 'staff')
        OR p.is_suspended
        OR NOT (m.assigned_role = ANY(tm.capabilities))
    ) THEN
      RAISE EXCEPTION 'Every assigned worker must be active, on this team, and qualified for the selected role';
    END IF;
  ELSE
    IF jsonb_array_length(p_members) <> 1 OR EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_members) AS m(profile_id uuid, assigned_role text)
      LEFT JOIN public.profiles p ON p.id = m.profile_id
      WHERE p.id IS NULL
        OR p.id <> p_worker_id
        OR p.department_id <> v_department_id
        OR p.role NOT IN ('admin', 'staff')
        OR p.is_suspended
        OR m.assigned_role NOT IN (
          'Crew Lead',
          'Field Technician',
          'Driver / Equipment Operator',
          'Inspector / Verifier',
          'Safety Officer',
          'General Worker'
        )
    ) THEN
      RAISE EXCEPTION 'Select one active department worker with a valid assignment role';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS m(profile_id uuid)
    GROUP BY profile_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A worker can only be assigned once';
  END IF;

  INSERT INTO public.assignments (
    report_id,
    department_id,
    assigned_to,
    team_id,
    assigned_by,
    notes,
    assigned_at
  )
  VALUES (
    p_report_id,
    v_department_id,
    p_worker_id,
    p_team_id,
    auth.uid(),
    NULLIF(trim(p_notes), ''),
    now()
  )
  ON CONFLICT (report_id) DO UPDATE
  SET department_id = EXCLUDED.department_id,
      assigned_to = EXCLUDED.assigned_to,
      team_id = EXCLUDED.team_id,
      assigned_by = EXCLUDED.assigned_by,
      notes = EXCLUDED.notes,
      assigned_at = EXCLUDED.assigned_at
  RETURNING id INTO v_assignment_id;

  DELETE FROM public.assignment_members
  WHERE assignment_id = v_assignment_id;

  INSERT INTO public.assignment_members (
    assignment_id,
    profile_id,
    assigned_role,
    is_team_lead
  )
  SELECT
    v_assignment_id,
    m.profile_id,
    m.assigned_role,
    m.assigned_role = 'Crew Lead'
  FROM jsonb_to_recordset(p_members) AS m(
    profile_id uuid,
    assigned_role text
  );

  RETURN v_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_department_team(uuid, uuid, text, text, uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_best_dispatch_recommendation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_report_assignment(uuid, uuid, uuid, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.save_department_team(uuid, uuid, text, text, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_best_dispatch_recommendation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_report_assignment(uuid, uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_department_team(uuid, uuid, text, text, uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_best_dispatch_recommendation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_report_assignment(uuid, uuid, uuid, text, jsonb) TO authenticated;
