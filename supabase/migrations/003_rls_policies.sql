-- ENABLE RLS
alter table profiles enable row level security;
alter table zones enable row level security;
alter table departments enable row level security;
alter table categories enable row level security;
alter table reports enable row level security;
alter table report_photos enable row level security;
alter table report_confirmations enable row level security;
alter table assignments enable row level security;
alter table status_history enable row level security;
alter table comments enable row level security;
alter table notifications enable row level security;
alter table routing_rules enable row level security;

-- PROFILES
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- ZONES
create policy "Zones are viewable by everyone" on zones for select using (true);

-- DEPARTMENTS
create policy "Departments are viewable by everyone" on departments for select using (true);
create policy "Only admins can modify departments" on departments for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- CATEGORIES
create policy "Categories are viewable by everyone" on categories for select using (true);

-- REPORTS
create policy "Reports are viewable by everyone" on reports for select using (true);
create policy "Authenticated users can create reports" on reports for insert with check (auth.role() = 'authenticated');
create policy "Staff and admins can update reports" on reports for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);

-- REPORT PHOTOS
create policy "Report photos are viewable by everyone" on report_photos for select using (true);
create policy "Report owners can upload photos" on report_photos for insert with check (
  exists (select 1 from reports where id = report_id and user_id = auth.uid())
);

-- REPORT CONFIRMATIONS
create policy "Confirmations are viewable by everyone" on report_confirmations for select using (true);
create policy "Users can confirm reports once" on report_confirmations for insert with check (
  auth.uid() = user_id and not exists (
    select 1 from reports where id = report_id and user_id = auth.uid()
  )
);

-- ASSIGNMENTS
create policy "Staff and admins can view assignments" on assignments for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "Staff and admins can create/update assignments" on assignments for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);

-- STATUS HISTORY
create policy "Status history viewable by everyone" on status_history for select using (true);

-- COMMENTS
create policy "Public comments viewable by everyone" on comments for select using (not is_internal);
create policy "Internal comments viewable by staff/admins" on comments for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "Authenticated users can comment" on comments for insert with check (auth.role() = 'authenticated');

-- NOTIFICATIONS
create policy "Users can view own notifications" on notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on notifications for update using (auth.uid() = user_id);

-- ROUTING RULES
create policy "Only admins can manage routing rules" on routing_rules for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
