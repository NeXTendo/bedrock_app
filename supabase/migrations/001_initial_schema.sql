-- PROFILES (extends auth.users)
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  phone         text,
  avatar_url    text,
  role          text not null default 'citizen',   -- citizen | staff | admin
  department_id uuid,
  zone_id       uuid,
  xp_points     integer default 0,
  level         integer default 1,
  is_suspended  boolean default false,
  created_at    timestamptz default now()
);

-- ZONES / WARDS
create table zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  boundary   geography(POLYGON, 4326),              -- PostGIS polygon
  created_at timestamptz default now()
);

-- DEPARTMENTS
create table departments (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  code           text unique,                        -- e.g. "ROAD_MAINT"
  contact_email  text,
  head_user_id   uuid references profiles(id),
  zone_id        uuid references zones(id),
  created_at     timestamptz default now()
);

-- Add foreign key to profiles after departments and zones are created
alter table profiles add foreign key (department_id) references departments(id);
alter table profiles add foreign key (zone_id) references zones(id);

-- CATEGORIES
create table categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references categories(id),       -- null = main category
  name        text not null,
  icon        text,                                  -- Ionicons name
  color       text,                                  -- hex color
  dept_id     uuid references departments(id),       -- auto-routing
  is_active   boolean default true,
  sort_order  integer default 0
);

-- REPORTS (core table)
create table reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id),
  category_id   uuid references categories(id),
  description   text,
  severity      text default 'medium',               -- low | medium | high | critical
  location      geography(POINT, 4326) not null,     -- PostGIS point
  latitude      numeric(10, 7) not null,
  longitude     numeric(10, 7) not null,
  address       text,                                -- reverse geocoded
  zone_id       uuid references zones(id),
  status        text not null default 'NEW',
  -- NEW | VERIFIED | ASSIGNED | IN_PROGRESS | RESOLVED | REJECTED
  priority      integer default 0,                   -- auto-calculated
  is_anonymous  boolean default false,
  confirmation_count integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  resolved_at   timestamptz
);

-- REPORT PHOTOS
create table report_photos (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references reports(id) on delete cascade,
  image_url   text not null,
  uploaded_by uuid references profiles(id),
  is_primary  boolean default false,
  uploaded_at timestamptz default now()
);

-- REPORT CONFIRMATIONS (each user can confirm once)
create table report_confirmations (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references reports(id) on delete cascade,
  user_id     uuid references profiles(id),
  confirmed_at timestamptz default now(),
  unique (report_id, user_id)
);

-- ASSIGNMENTS
create table assignments (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid references reports(id) on delete cascade unique,
  department_id uuid references departments(id),
  assigned_to   uuid references profiles(id),         -- specific staff
  assigned_by   uuid references profiles(id),
  notes         text,
  assigned_at   timestamptz default now()
);

-- STATUS HISTORY (full audit trail)
create table status_history (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references reports(id) on delete cascade,
  old_status  text,
  new_status  text not null,
  changed_by  uuid references profiles(id),
  note        text,
  changed_at  timestamptz default now()
);

-- COMMENTS
create table comments (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references reports(id) on delete cascade,
  user_id     uuid references profiles(id),
  content     text not null,
  is_internal boolean default false,                  -- staff-only notes
  created_at  timestamptz default now()
);

-- NOTIFICATIONS LOG
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  report_id   uuid references reports(id),
  type        text,  -- status_change | assigned | resolved | confirmation
  title       text,
  body        text,
  is_read     boolean default false,
  sent_at     timestamptz default now()
);

-- AUTO-ROUTING RULES
create table routing_rules (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references categories(id),
  department_id uuid references departments(id),
  is_active     boolean default true
);
