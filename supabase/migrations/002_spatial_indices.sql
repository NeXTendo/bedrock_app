-- Spatial indices (critical for geo queries)
-- This runs after tables are created in 001_initial_schema.sql
create index if not exists reports_location_idx on reports using gist(location);
create index if not exists reports_status_idx on reports (status);
create index if not exists reports_category_idx on reports (category_id);
create index if not exists zones_boundary_idx on zones using gist(boundary);
