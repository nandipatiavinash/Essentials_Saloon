-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

-- Categories
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  icon text default '✂️',
  slug text not null unique
);

-- Services
create table if not exists public.services (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  description text,
  duration text,
  price_from numeric not null default 0,
  price_to numeric,
  featured boolean not null default false,
  active boolean not null default true,
  image text
);

-- Offers
create table if not exists public.offers (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  badge text,
  price text,
  active boolean not null default true,
  color text default '#1a1a1a'
);

-- Gallery
create table if not exists public.gallery (
  id bigint generated always as identity primary key,
  url text not null,
  caption text,
  type text default 'style'
);

-- Salon settings (single row)
create table if not exists public.salon_settings (
  id int primary key default 1 check (id = 1),
  name text,
  phone text,
  email text,
  address text,
  hours text,
  whatsapp text
);

-- Booking inquiries
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service text,
  booking_date date,
  booking_time time,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.offers enable row level security;
alter table public.gallery enable row level security;
alter table public.salon_settings enable row level security;
alter table public.bookings enable row level security;

-- Public read (customer menu)
create policy "categories_public_read" on public.categories for select to anon, authenticated using (true);
create policy "services_public_read" on public.services for select to anon using (active = true);
create policy "services_auth_read" on public.services for select to authenticated using (true);
create policy "offers_public_read" on public.offers for select to anon using (active = true);
create policy "offers_auth_read" on public.offers for select to authenticated using (true);
create policy "gallery_public_read" on public.gallery for select to anon, authenticated using (true);
create policy "settings_public_read" on public.salon_settings for select to anon, authenticated using (true);

-- Public booking submissions
create policy "bookings_public_insert" on public.bookings for insert to anon, authenticated with check (true);

-- Admin writes (authenticated users — create admin in Supabase Auth)
create policy "categories_admin" on public.categories for all to authenticated using (true) with check (true);
create policy "services_admin" on public.services for all to authenticated using (true) with check (true);
create policy "offers_admin" on public.offers for all to authenticated using (true) with check (true);
create policy "gallery_admin" on public.gallery for all to authenticated using (true) with check (true);
create policy "settings_admin" on public.salon_settings for all to authenticated using (true) with check (true);
create policy "bookings_admin" on public.bookings for all to authenticated using (true) with check (true);
