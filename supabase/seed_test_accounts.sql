-- =============================================================
-- BEDROCK PLATFORM — Test Accounts Seed Script
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)
-- 
-- Creates:
--   • 5 department admin accounts (one per department)
--   • 5 department staff accounts (one per department)
--   • 1 citizen account (should be BLOCKED from web portal)
--
-- All passwords: Test@12345
--
-- Note: Automatically deletes existing test accounts first to
-- guarantee idempotency (re-runnability). Includes GoTrue empty
-- string defaults to prevent GoTrue authentication 500 errors.
-- =============================================================

DO $$
DECLARE
  -- Department IDs
  dept_roads  uuid;
  dept_water  uuid;
  dept_waste  uuid;
  dept_zoning uuid;
  dept_health uuid;

  -- User IDs
  uid uuid;
BEGIN
  -- ─── Look up department IDs ───
  SELECT id INTO dept_roads  FROM departments WHERE code = 'ROADS'  LIMIT 1;
  SELECT id INTO dept_water  FROM departments WHERE code = 'WATER'  LIMIT 1;
  SELECT id INTO dept_waste  FROM departments WHERE code = 'WASTE'  LIMIT 1;
  SELECT id INTO dept_zoning FROM departments WHERE code = 'ZONING' LIMIT 1;
  SELECT id INTO dept_health FROM departments WHERE code = 'HEALTH' LIMIT 1;

  -- Verify departments exist
  IF dept_roads IS NULL OR dept_water IS NULL OR dept_waste IS NULL
     OR dept_zoning IS NULL OR dept_health IS NULL THEN
    RAISE EXCEPTION 'Missing departments! Run the departments seed first.';
  END IF;

  -- ─── WIPE EXISTING SEEDED USERS FOR RE-RUNNABILITY ───
  -- Cascades automatically to public.profiles and auth.identities
  DELETE FROM auth.users 
  WHERE email IN (
    'roads.admin@lusakacity.gov.zm', 'roads.staff@lusakacity.gov.zm',
    'water.admin@lusakacity.gov.zm', 'water.staff@lusakacity.gov.zm',
    'waste.admin@lusakacity.gov.zm', 'waste.staff@lusakacity.gov.zm',
    'zoning.admin@lusakacity.gov.zm', 'zoning.staff@lusakacity.gov.zm',
    'health.admin@lusakacity.gov.zm', 'health.staff@lusakacity.gov.zm',
    'citizen@test.com'
  );

  -- ═══════════════════════════════════════════════════
  -- DEPARTMENT ADMINS (role = 'admin')
  -- ═══════════════════════════════════════════════════

  -- ─── Roads Admin ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'roads.admin@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"John Mwale"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'roads.admin@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'John Mwale', 'admin', dept_roads)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  -- Update department head
  UPDATE departments SET head_user_id = uid WHERE id = dept_roads;

  -- ─── Water Admin ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'water.admin@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Grace Banda"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'water.admin@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Grace Banda', 'admin', dept_water)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  UPDATE departments SET head_user_id = uid WHERE id = dept_water;

  -- ─── Waste Admin ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'waste.admin@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Peter Phiri"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'waste.admin@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Peter Phiri', 'admin', dept_waste)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  UPDATE departments SET head_user_id = uid WHERE id = dept_waste;

  -- ─── Zoning Admin ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'zoning.admin@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Mary Tembo"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'zoning.admin@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Mary Tembo', 'admin', dept_zoning)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  UPDATE departments SET head_user_id = uid WHERE id = dept_zoning;

  -- ─── Health Admin ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'health.admin@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Esther Lungu"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'health.admin@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Esther Lungu', 'admin', dept_health)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  UPDATE departments SET head_user_id = uid WHERE id = dept_health;

  -- ═══════════════════════════════════════════════════
  -- DEPARTMENT STAFF (role = 'staff')
  -- ═══════════════════════════════════════════════════

  -- ─── Roads Staff ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'roads.staff@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Chanda Nkonde"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'roads.staff@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Chanda Nkonde', 'staff', dept_roads)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  -- ─── Water Staff ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'water.staff@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Bwalya Musonda"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'water.staff@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Bwalya Musonda', 'staff', dept_water)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  -- ─── Waste Staff ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'waste.staff@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Mutale Chisanga"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'waste.staff@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Mutale Chisanga', 'staff', dept_waste)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  -- ─── Zoning Staff ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'zoning.staff@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Kampamba Mwila"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'zoning.staff@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Kampamba Mwila', 'staff', dept_zoning)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  -- ─── Health Staff ───
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'health.staff@lusakacity.gov.zm',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Mwansa Kaluba"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'health.staff@lusakacity.gov.zm'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Mwansa Kaluba', 'staff', dept_health)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  -- ═══════════════════════════════════════════════════
  -- CITIZEN (no department — should be BLOCKED from web)
  -- ═══════════════════════════════════════════════════

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    email_change_token_new, email_change_token_current, recovery_token,
    phone_change_token, email_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'citizen@test.com',
    crypt('Test@12345', gen_salt('bf')),
    now(), now(), now(), '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Mulenga Citizen"}'::jsonb
  ) RETURNING id INTO uid;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', 'citizen@test.com'), 'email', uid::text, now(), now(), now());

  INSERT INTO profiles (id, full_name, role, department_id)
  VALUES (uid, 'Mulenga Citizen', 'citizen', NULL)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      department_id = EXCLUDED.department_id, 
      full_name = EXCLUDED.full_name;

  RAISE NOTICE '✅ All 11 test accounts created successfully!';
END $$;
