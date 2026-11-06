-- RPC: create_report()
create or replace function create_report(
  p_category_id uuid,
  p_description text,
  p_severity text,
  p_lat numeric,
  p_lng numeric,
  p_address text,
  p_photo_urls text[],
  p_anonymous boolean default false
) returns uuid language plpgsql security definer as $$
declare
  v_report_id uuid;
  v_dept_id uuid;
  v_photo_url text;
begin
  -- Insert report
  insert into reports (user_id, category_id, description, 
    severity, latitude, longitude, 
    location, address, is_anonymous)
  values (
    auth.uid(), p_category_id, p_description,
    p_severity, p_lat, p_lng,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_address, p_anonymous
  ) returning id into v_report_id;

  -- Insert photos
  foreach v_photo_url in array p_photo_urls loop
    insert into report_photos (report_id, image_url, uploaded_by)
    values (v_report_id, v_photo_url, auth.uid());
  end loop;

  -- Set first photo as primary
  update report_photos set is_primary = true
  where report_id = v_report_id
  and uploaded_at = (
    select min(uploaded_at) from report_photos
    where report_id = v_report_id);

  -- Auto-routing
  select department_id into v_dept_id
  from routing_rules
  where category_id = p_category_id and is_active = true
  limit 1;

  if v_dept_id is not null then
    insert into assignments (report_id, department_id, assigned_by)
    values (v_report_id, v_dept_id, auth.uid());
    
    update reports set status = 'ASSIGNED' where id = v_report_id;
  end if;

  -- Log XP
  update profiles set xp_points = xp_points + 10
  where id = auth.uid();

  return v_report_id;
end; $$;

-- RPC: get_nearby_reports()
create or replace function get_nearby_reports(
  p_lat numeric,
  p_lng numeric,
  p_radius_m integer default 2000,
  p_categories uuid[] default null,
  p_status text[] default null
) returns setof reports
language sql stable as $$
  select r.*
  from reports r
  where
    ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    and (p_categories is null
         or r.category_id = any(p_categories))
    and (p_status is null
         or r.status = any(p_status))
  order by r.created_at desc
  limit 200;
$$;

-- RPC: find_duplicate_reports()
create or replace function find_duplicate_reports(
  p_lat numeric,
  p_lng numeric,
  p_category_id uuid,
  p_radius_m integer default 50
) returns table(report_id uuid, distance_m float)
language sql stable as $$
  select r.id,
    ST_Distance(
      r.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) as distance_m
  from reports r
  where
    ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    and r.category_id = p_category_id
    and r.status != 'RESOLVED'
  order by distance_m asc
  limit 5;
$$;

-- RPC: update_report_status()
create or replace function update_report_status(
  p_report_id uuid,
  p_new_status text,
  p_note text default null
) returns void language plpgsql security definer as $$
declare
  v_old_status text;
  v_user_id uuid;
begin
  select status, user_id
  into v_old_status, v_user_id
  from reports where id = p_report_id;

  update reports set
    status = p_new_status,
    updated_at = now(),
    resolved_at = case when p_new_status = 'RESOLVED' 
                  then now() else null end
  where id = p_report_id;

  -- Audit trail
  insert into status_history
    (report_id, old_status, new_status, changed_by, note)
  values (p_report_id, v_old_status, p_new_status, 
          auth.uid(), p_note);

  -- Notify citizen
  insert into notifications
    (user_id, report_id, type, title, body)
  values (
    v_user_id, p_report_id, 'status_change',
    'Report Update',
    'Your report status changed to: ' || p_new_status
  );
end; $$;
