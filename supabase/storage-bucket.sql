-- Storage bucket initialization for salon images
-- Supabase -> SQL Editor -> paste -> Run

-- 1. Create bucket if not exists
insert into storage.buckets (id, name, public)
values ('salon-images', 'salon-images', true)
on conflict (id) do nothing;

-- 2. Allow public access to view uploaded images
create policy "Public Access" on storage.objects
  for select to public
  using (bucket_id = 'salon-images');

-- 3. Allow authenticated users to upload/insert images
create policy "Authenticated Insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'salon-images');

-- 4. Allow authenticated users to update images
create policy "Authenticated Update" on storage.objects
  for update to authenticated
  using (bucket_id = 'salon-images')
  with check (bucket_id = 'salon-images');

-- 5. Allow authenticated users to delete images
create policy "Authenticated Delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'salon-images');
