-- Keep profile self-service limited to non-privileged fields.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, phone, avatar_url)
  ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.department_id IS DISTINCT FROM OLD.department_id
    OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
    OR NEW.xp_points IS DISTINCT FROM OLD.xp_points
    OR NEW.level IS DISTINCT FROM OLD.level
  ) THEN
    RAISE EXCEPTION 'Users cannot modify privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_changes ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_changes();

-- Registration metadata is user-controlled; newly created accounts are always citizens.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role, department_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'citizen',
    NULL
  );

  RETURN NEW;
END;
$$;

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
