-- Run this if tables exist but the app still fails (RLS blocking reads/writes).
-- Supabase → SQL Editor → paste → Run

-- Drop old policies (ignore errors if missing)
drop policy if exists "categories_public_read" on public.categories;
drop policy if exists "services_public_read" on public.services;
drop policy if exists "services_auth_read" on public.services;
drop policy if exists "offers_public_read" on public.offers;
drop policy if exists "offers_auth_read" on public.offers;
drop policy if exists "gallery_public_read" on public.gallery;
drop policy if exists "settings_public_read" on public.salon_settings;
drop policy if exists "bookings_public_insert" on public.bookings;
drop policy if exists "categories_admin" on public.categories;
drop policy if exists "services_admin" on public.services;
drop policy if exists "offers_admin" on public.offers;
drop policy if exists "gallery_admin" on public.gallery;
drop policy if exists "settings_admin" on public.salon_settings;
drop policy if exists "bookings_admin" on public.bookings;

alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.offers enable row level security;
alter table public.gallery enable row level security;
alter table public.salon_settings enable row level security;
alter table public.bookings enable row level security;

-- Customer: read menu
create policy "categories_public_read" on public.categories for select to anon, authenticated using (true);
create policy "services_public_read" on public.services for select to anon using (active = true);
create policy "services_auth_read" on public.services for select to authenticated using (true);
create policy "offers_public_read" on public.offers for select to anon using (active = true);
create policy "offers_auth_read" on public.offers for select to authenticated using (true);
create policy "gallery_public_read" on public.gallery for select to anon, authenticated using (true);
create policy "settings_public_read" on public.salon_settings for select to anon, authenticated using (true);

-- Customer: submit bookings (no login required)
create policy "bookings_public_insert" on public.bookings for insert to anon, authenticated with check (true);

-- Admin: full access when signed in via Supabase Auth
create policy "categories_admin" on public.categories for all to authenticated using (true) with check (true);
create policy "services_admin" on public.services for all to authenticated using (true) with check (true);
create policy "offers_admin" on public.offers for all to authenticated using (true) with check (true);
create policy "gallery_admin" on public.gallery for all to authenticated using (true) with check (true);
create policy "settings_admin" on public.salon_settings for all to authenticated using (true) with check (true);
create policy "bookings_admin" on public.bookings for all to authenticated using (true) with check (true);

-- Table grants (required for API access)
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.services, public.offers, public.gallery, public.salon_settings to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant all on public.categories, public.services, public.offers, public.gallery, public.salon_settings, public.bookings to authenticated;
