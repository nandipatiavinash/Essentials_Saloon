-- =====================================================================
-- TONI & GUY ESSENSUALS GORANTLA - SUPABASE DATABASE MIGRATION SCRIPT
-- =====================================================================
-- Paste this script into your Supabase SQL Editor and click RUN.
-- This script safely configures all tables, columns, constraints, and
-- row-level security (RLS) policies without breaking existing data.

-- ─── 1. CORE AND ERP TABLES ──────────────────────────────────────────

-- Safely alter services table to support member pricing
alter table public.services
  add column if not exists member_price numeric;

-- Safely alter customers table to support membership columns
alter table public.customers
  add column if not exists is_member boolean not null default false,
  add column if not exists membership_tier text not null default 'Member',
  add column if not exists membership_start date,
  add column if not exists membership_end date,
  add column if not exists membership_id text unique;

-- Add constraint to check membership_tier safely
alter table public.customers drop constraint if exists customers_membership_tier_check;
alter table public.customers add constraint customers_membership_tier_check 
  check (membership_tier in ('Regular', 'Member', 'Gold', 'Platinum', 'VVIP'));

-- Safely alter invoices table to support tips
alter table public.invoices
  add column if not exists tip numeric not null default 0;

-- Safely alter bookings table to support follow-up and staff tracking
alter table public.bookings
  add column if not exists follow_up_date date,
  add column if not exists follow_up_notes text,
  add column if not exists assigned_staff text;


-- ─── 2. HR & ATTENDANCE MODULE ────────────────────────────────────────

-- Create HR Staff table
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create Staff Attendance table
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


-- ─── 3. INVENTORY & CASH REGISTER MODULES ────────────────────────────

-- Create Inventory table
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

-- Create Daily Cash Register table
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


-- ─── 4. SECURITY & API PERMISSIONS (RLS) ─────────────────────────────

-- Enable RLS on newly created tables
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

-- Grant privileges to authenticated users on core and erp tables
grant all on public.customers, public.invoices, public.invoice_items, public.bookings to authenticated;
grant all on public.staff, public.attendance, public.inventory, public.cash_register to authenticated;


-- ─── 5. INITIAL STAFF SEEDS ──────────────────────────────────────────

insert into public.staff (name, role, phone)
values 
  ('Anil Kumar', 'Senior Stylist', '+91 91002 92525'),
  ('Deepika R.', 'Makeup Artist', '+91 91002 92526'),
  ('Srinivas K.', 'Stylist & Colorist', '+91 91002 92527')
on conflict do nothing;

-- =====================================================================
-- MIGRATION COMPLETE. YOUR DATABASE IS NOW READY.
-- =====================================================================
