-- seed.sql

-- 1. Create a default Admin User (you will need to sign up this email in the Auth UI to link it)
-- Note: Supabase handles auth.users, but we can pre-create the profile assuming a specific UUID or let the app create it. 
-- For seeding reference data, it's better to add the core lookups first.

-- 2. Insert Zones (Wards)
insert into zones (name, boundary) values
  ('Kanyama', ST_SetSRID(ST_GeomFromText('POLYGON((28.25 -15.42, 28.28 -15.42, 28.28 -15.45, 28.25 -15.45, 28.25 -15.42))'), 4326)::geography),
  ('Matero', ST_SetSRID(ST_GeomFromText('POLYGON((28.20 -15.35, 28.25 -15.35, 28.25 -15.40, 28.20 -15.40, 28.20 -15.35))'), 4326)::geography),
  ('Chilenje', ST_SetSRID(ST_GeomFromText('POLYGON((28.30 -15.43, 28.35 -15.43, 28.35 -15.48, 28.30 -15.48, 28.30 -15.43))'), 4326)::geography),
  ('Munali', ST_SetSRID(ST_GeomFromText('POLYGON((28.32 -15.37, 28.38 -15.37, 28.38 -15.42, 28.32 -15.42, 28.32 -15.37))'), 4326)::geography);

-- 3. Insert Departments
insert into departments (name, code, contact_email) values
  ('Roads & Infrastructure', 'ROADS', 'roads@lusakacity.gov.zm'),
  ('Water & Sanitation', 'WATER', 'water@lusakacity.gov.zm'),
  ('Waste Management', 'WASTE', 'waste@lusakacity.gov.zm'),
  ('City Planning & Zoning', 'ZONING', 'planning@lusakacity.gov.zm'),
  ('Public Health & Environment', 'HEALTH', 'health@lusakacity.gov.zm');

-- 4. Get Department IDs for Routing
do $$
declare
  dept_roads uuid;
  dept_water uuid;
  dept_waste uuid;
  dept_health uuid;
  
  cat_roads uuid;
  cat_water uuid;
  cat_waste uuid;
  cat_elec uuid;
begin
  select id into dept_roads from departments where code = 'ROADS' limit 1;
  select id into dept_water from departments where code = 'WATER' limit 1;
  select id into dept_waste from departments where code = 'WASTE' limit 1;
  select id into dept_health from departments where code = 'HEALTH' limit 1;

  -- 5. Insert Categories
  insert into categories (name, icon, color, dept_id, sort_order) values
    ('Potholes & Roads', 'car.fill', '#E53935', dept_roads, 1) returning id into cat_roads;
  
  insert into categories (name, icon, color, dept_id, sort_order) values
    ('Water & Leaks', 'drop.fill', '#1E88E5', dept_water, 2) returning id into cat_water;
    
  insert into categories (name, icon, color, dept_id, sort_order) values
    ('Trash & Dumping', 'trash.fill', '#43A047', dept_waste, 3) returning id into cat_waste;
    
  insert into categories (name, icon, color, sort_order) values
    ('Electricity & Lights', 'bolt.fill', '#FFA000', 4) returning id into cat_elec;

  -- 6. Insert Routing Rules
  insert into routing_rules (category_id, department_id, is_active) values
    (cat_roads, dept_roads, true),
    (cat_water, dept_water, true),
    (cat_waste, dept_waste, true);

end $$;
