-- SAVED LOCATIONS
create table saved_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  address     text,
  latitude    numeric(10, 7) not null,
  longitude   numeric(10, 7) not null,
  created_at  timestamptz default now()
);

-- Enable RLS
alter table saved_locations enable row level security;

-- Policies
create policy "Users can manage their own saved locations"
  on saved_locations for all
  using (auth.uid() = user_id);

-- Explicit separate policies for clarity if needed, but 'all' handles it.
-- We'll stay with one 'all' policy for simplicity in this professional standard.
