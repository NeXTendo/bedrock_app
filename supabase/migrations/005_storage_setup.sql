-- Create the 'report-photos' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

-- RLS Policies for the bucket
-- Allow public viewing of photos
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'report-photos' );

-- Allow authenticated users to upload photos
create policy "Authenticated Upload"
on storage.objects for insert
with check (
  bucket_id = 'report-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow users to delete their own photos
create policy "Owner Delete"
on storage.objects for delete
using (
  bucket_id = 'report-photos'
  AND auth.uid() = owner
);
