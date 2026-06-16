-- Database schema extension for Client Memberships, HR/Attendance, Inventory, and Cash Register.
-- Run this in the Supabase SQL Editor.

-- 1. Alter Customers to support membership
alter table public.customers
  add column if not exists is_member boolean not null default false,
  add column if not exists membership_tier text not null default 'Regular' check (membership_tier in ('Regular', 'Gold', 'Platinum', 'VVIP')),
  add column if not exists membership_start date,
  add column if not exists membership_end date;

-- 2. Alter Services to support member-only pricing
alter table public.services
  add column if not exists member_price numeric;

-- 3. Create HR Staff table
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create Staff Attendance table
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  date date not null default current_date,
  check_in time,
  check_out time,
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'leave')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, date)
);

-- 5. Create Inventory table
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  sku text unique,
  stock_qty numeric not null default 0,
  min_qty numeric not null default 0,
  unit_price numeric not null default 0,
  supplier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Create Daily Cash Register table
create table if not exists public.cash_register (
  id uuid primary key default gen_random_uuid(),
  date date unique not null default current_date,
  opening_cash numeric not null default 0,
  closing_cash numeric,
  expenses numeric not null default 0,
  expense_notes text,
  notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS (Row Level Security)
alter table public.staff enable row level security;
alter table public.attendance enable row level security;
alter table public.inventory enable row level security;
alter table public.cash_register enable row level security;

-- Policies for Authenticated Users (Admins/Staff)
drop policy if exists "staff_admin" on public.staff;
drop policy if exists "attendance_admin" on public.attendance;
drop policy if exists "inventory_admin" on public.inventory;
drop policy if exists "cash_register_admin" on public.cash_register;

create policy "staff_admin" on public.staff for all to authenticated using (true) with check (true);
create policy "attendance_admin" on public.attendance for all to authenticated using (true) with check (true);
create policy "inventory_admin" on public.inventory for all to authenticated using (true) with check (true);
create policy "cash_register_admin" on public.cash_register for all to authenticated using (true) with check (true);

-- Seed initial sample staff
insert into public.staff (name, role, phone)
values 
  ('Anil Kumar', 'Senior Stylist', '+91 91002 92525'),
  ('Deepika R.', 'Makeup Artist', '+91 91002 92526'),
  ('Srinivas K.', 'Stylist & Colorist', '+91 91002 92527')
on conflict do nothing;
