-- =============================================================
-- BEDROCK PLATFORM — Migration: Profiles Differentiation & Trigger Update
-- Migration: 009_update_profiles_trigger_and_constraints.sql
-- =============================================================

-- ─── 1. SANITIZE EXISTING DATA ───
-- Ensure all existing profiles have valid roles. Default to 'citizen' if invalid/null.
UPDATE public.profiles 
SET role = 'citizen' 
WHERE role IS NULL OR role NOT IN ('citizen', 'staff', 'admin');

-- Clear department assignments for citizens (citizens must not belong to departments)
UPDATE public.profiles 
SET department_id = NULL 
WHERE role = 'citizen';

-- Fallback staff/admins without a department_id to 'citizen' role so constraint doesn't fail
UPDATE public.profiles 
SET role = 'citizen' 
WHERE role IN ('staff', 'admin') AND department_id IS NULL;


-- ─── 2. ENFORCE CONSTRAINTS ───
-- Enforce that role must be one of 'citizen', 'staff', 'admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profile_role;
ALTER TABLE public.profiles ADD CONSTRAINT check_profile_role
  CHECK (role IN ('citizen', 'staff', 'admin'));

-- Differentiate citizens from department accounts:
--   • Citizens: department_id MUST be NULL
--   • Staff / Admins: department_id MUST NOT be NULL
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profile_role_department;
ALTER TABLE public.profiles ADD CONSTRAINT check_profile_role_department
  CHECK (
    (role = 'citizen' AND department_id IS NULL) OR
    (role IN ('staff', 'admin') AND department_id IS NOT NULL)
  );


-- ─── 3. UPDATE USER CREATION TRIGGER ───
-- Enhance the public.handle_new_user() function to extract role and department_id
-- from raw_user_meta_data on sign up / account creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta_role text;
  meta_dept_id uuid;
BEGIN
  -- Extract role from metadata, default to 'citizen' if missing or invalid
  meta_role := COALESCE(new.raw_user_meta_data->>'role', 'citizen');
  IF meta_role NOT IN ('citizen', 'staff', 'admin') THEN
    meta_role := 'citizen';
  END IF;

  -- Extract department_id from metadata (if present)
  IF new.raw_user_meta_data->>'department_id' IS NOT NULL THEN
    BEGIN
      meta_dept_id := (new.raw_user_meta_data->>'department_id')::uuid;
    EXCEPTION WHEN others THEN
      meta_dept_id := NULL;
    END;
  END IF;

  -- Enforce business rule: citizens cannot have a department_id
  IF meta_role = 'citizen' THEN
    meta_dept_id := NULL;
  -- Enforce business rule: staff/admins must have a department_id (if missing, default to citizen)
  ELSIF meta_role IN ('staff', 'admin') AND meta_dept_id IS NULL THEN
    meta_role := 'citizen';
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, full_name, avatar_url, role, department_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    meta_role,
    meta_dept_id
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 4. UTILITY PROCEDURES (COMMENTED OUT FOR REFERENCE) ───
-- Below are SQL queries to easily promote/demote users directly in your SQL Editor:
/*
-- Promote an existing user to Department Admin:
UPDATE public.profiles 
SET role = 'admin', 
    department_id = 'YOUR-DEPARTMENT-UUID-HERE'
WHERE id = 'USER-UUID-HERE';

-- Promote an existing user to Department Staff:
UPDATE public.profiles 
SET role = 'staff', 
    department_id = 'YOUR-DEPARTMENT-UUID-HERE'
WHERE id = 'USER-UUID-HERE';

-- Demote/Reset an account to Citizen:
UPDATE public.profiles 
SET role = 'citizen', 
    department_id = NULL
WHERE id = 'USER-UUID-HERE';
*/
