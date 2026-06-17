-- ==========================================
-- Toni & Guy Essensuals Gorantla
-- Complete Database Migration Script (Unified Schema)
-- ==========================================
-- Execute this script in the Supabase SQL Editor to set up all tables,
-- columns, views, security policies, initial seeds, and API permissions.

create extension if not exists pgcrypto;

-- ─── 1. CORE TABLES ────────────────────────────────────────────────────────

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  icon text default '✂️',
  slug text not null unique
);

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

-- Safely add membership support columns to public.services if they do not exist
alter table public.services add column if not exists member_price numeric;

create table if not exists public.offers (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  badge text,
  price text,
  active boolean not null default true,
  color text default '#1a1a1a'
);

create table if not exists public.gallery (
  id bigint generated always as identity primary key,
  url text not null,
  caption text,
  type text default 'style'
);

create table if not exists public.salon_settings (
  id int primary key default 1 check (id = 1),
  name text,
  phone text,
  email text,
  address text,
  hours text,
  whatsapp text
);

-- Safely add settings support columns to public.salon_settings if they do not exist
alter table public.salon_settings 
  add column if not exists whatsapp_provider text default 'meta' check (whatsapp_provider in ('meta', 'twilio')),
  add column if not exists eod_report_time time default '21:00',
  add column if not exists report_recipients text;

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

-- ─── 2. ERP & CUSTOMER TABLES ───────────────────────────────────────────────

create table if not exists public.payment_methods (
  id bigint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.payment_methods (name)
values ('Cash'), ('UPI'), ('Card'), ('Bank Transfer')
on conflict (name) do nothing;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null unique,
  notes text,
  preferred_services text[] not null default '{}',
  total_spend numeric not null default 0,
  visit_count int not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safely add membership columns to public.customers if they do not exist
alter table public.customers
  add column if not exists is_member boolean not null default false,
  add column if not exists membership_tier text not null default 'Regular' check (membership_tier in ('Regular', 'Gold', 'Platinum', 'VVIP')),
  add column if not exists membership_start date,
  add column if not exists membership_end date;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  client_name text not null,
  mobile text not null,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  tax_rate numeric not null default 0,
  total numeric not null default 0,
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'UPI', 'Card', 'Bank Transfer')),
  transaction_id text,
  notes text,
  staff_name text,
  status text not null default 'paid' check (status in ('draft', 'paid', 'partially_paid', 'refunded', 'void')),
  refund_status text not null default 'none' check (refund_status in ('none', 'requested', 'approved', 'processed')),
  created_by uuid references auth.users(id) on delete set null,
  billing_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  service_id bigint references public.services(id) on delete set null,
  service_name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  price numeric not null default 0,
  total numeric not null default 0,
  staff_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  payment_method text not null check (payment_method in ('Cash', 'UPI', 'Card', 'Bank Transfer')),
  transaction_id text,
  amount numeric not null default 0,
  status text not null default 'success' check (status in ('pending', 'success', 'failed', 'refunded')),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.imported_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_type text,
  row_count int not null default 0,
  processed_rows int not null default 0,
  error_rows int not null default 0,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'completed_with_errors', 'failed')),
  mapping jsonb not null default '{}',
  errors jsonb not null default '[]',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.report_logs (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  recipient text,
  status text not null default 'prepared',
  provider text default 'meta',
  payload jsonb not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'manager', 'receptionist', 'accountant')),
  permissions jsonb not null default '{"billing": true, "analytics": true, "reports": true, "settings": true}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── 3. HR, ATTENDANCE, INVENTORY, CASH REGISTER ────────────────────────────

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.analytics_daily (
  metric_date date primary key,
  revenue numeric not null default 0,
  invoice_count int not null default 0,
  average_bill numeric not null default 0,
  cash_total numeric not null default 0,
  upi_total numeric not null default 0,
  card_total numeric not null default 0,
  bank_transfer_total numeric not null default 0,
  new_customers int not null default 0,
  repeat_customers int not null default 0,
  top_services jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_monthly (
  metric_month date primary key,
  revenue numeric not null default 0,
  invoice_count int not null default 0,
  average_bill numeric not null default 0,
  top_services jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ─── 4. DATABASE INDEXES ───────────────────────────────────────────────────

create index if not exists invoices_billing_at_idx on public.invoices (billing_at desc);
create index if not exists invoices_customer_idx on public.invoices (customer_id);
create index if not exists invoices_mobile_idx on public.invoices (mobile);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index if not exists customers_mobile_idx on public.customers (mobile);
create index if not exists transactions_paid_at_idx on public.transactions (paid_at desc);

-- ─── 5. ANALYTICS VIEWS & PROCEDURES ────────────────────────────────────────

create or replace view public.daily_sales_view as
select
  billing_at::date as sale_date,
  count(*) as invoice_count,
  coalesce(sum(total), 0) as revenue,
  coalesce(avg(total), 0) as average_bill,
  coalesce(sum(total) filter (where payment_method = 'Cash'), 0) as cash_total,
  coalesce(sum(total) filter (where payment_method = 'UPI'), 0) as upi_total,
  coalesce(sum(total) filter (where payment_method = 'Card'), 0) as card_total,
  coalesce(sum(total) filter (where payment_method = 'Bank Transfer'), 0) as bank_transfer_total
from public.invoices
where status <> 'void'
group by billing_at::date;

create or replace view public.monthly_sales_view as
select
  date_trunc('month', billing_at)::date as sale_month,
  count(*) as invoice_count,
  coalesce(sum(total), 0) as revenue,
  coalesce(avg(total), 0) as average_bill
from public.invoices
where status <> 'void'
group by date_trunc('month', billing_at)::date;

create or replace function public.refresh_sales_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_daily (metric_date, revenue, invoice_count, average_bill, cash_total, upi_total, card_total, bank_transfer_total, updated_at)
  select sale_date, revenue, invoice_count, average_bill, cash_total, upi_total, card_total, bank_transfer_total, now()
  from public.daily_sales_view
  on conflict (metric_date) do update set
    revenue = excluded.revenue,
    invoice_count = excluded.invoice_count,
    average_bill = excluded.average_bill,
    cash_total = excluded.cash_total,
    upi_total = excluded.upi_total,
    card_total = excluded.card_total,
    bank_transfer_total = excluded.bank_transfer_total,
    updated_at = now();

  insert into public.analytics_monthly (metric_month, revenue, invoice_count, average_bill, updated_at)
  select sale_month, revenue, invoice_count, average_bill, now()
  from public.monthly_sales_view
  on conflict (metric_month) do update set
    revenue = excluded.revenue,
    invoice_count = excluded.invoice_count,
    average_bill = excluded.average_bill,
    updated_at = now();
end;
$$;

-- ─── 6. SECURITY (RLS) & POLICIES ───────────────────────────────────────────

-- Enable RLS on all tables
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.offers enable row level security;
alter table public.gallery enable row level security;
alter table public.salon_settings enable row level security;
alter table public.bookings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.transactions enable row level security;
alter table public.imported_files enable row level security;
alter table public.report_logs enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.analytics_monthly enable row level security;
alter table public.staff enable row level security;
alter table public.attendance enable row level security;
alter table public.inventory enable row level security;
alter table public.cash_register enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "categories_public_read" on public.categories;
drop policy if exists "categories_admin" on public.categories;
drop policy if exists "services_public_read" on public.services;
drop policy if exists "services_auth_read" on public.services;
drop policy if exists "services_admin" on public.services;
drop policy if exists "offers_public_read" on public.offers;
drop policy if exists "offers_auth_read" on public.offers;
drop policy if exists "offers_admin" on public.offers;
drop policy if exists "gallery_public_read" on public.gallery;
drop policy if exists "gallery_admin" on public.gallery;
drop policy if exists "settings_public_read" on public.salon_settings;
drop policy if exists "settings_admin" on public.salon_settings;
drop policy if exists "bookings_public_insert" on public.bookings;
drop policy if exists "bookings_admin" on public.bookings;
drop policy if exists "payment_methods_admin" on public.payment_methods;
drop policy if exists "customers_admin" on public.customers;
drop policy if exists "invoices_admin" on public.invoices;
drop policy if exists "invoice_items_admin" on public.invoice_items;
drop policy if exists "transactions_admin" on public.transactions;
drop policy if exists "imported_files_admin" on public.imported_files;
drop policy if exists "report_logs_admin" on public.report_logs;
drop policy if exists "admin_profiles_admin" on public.admin_profiles;
drop policy if exists "analytics_daily_admin" on public.analytics_daily;
drop policy if exists "analytics_monthly_admin" on public.analytics_monthly;
drop policy if exists "staff_admin" on public.staff;
drop policy if exists "attendance_admin" on public.attendance;
drop policy if exists "inventory_admin" on public.inventory;
drop policy if exists "cash_register_admin" on public.cash_register;

-- Define Policies

-- Public Select Policies
create policy "categories_public_read" on public.categories for select to anon, authenticated using (true);
create policy "services_public_read" on public.services for select to anon using (active = true);
create policy "services_auth_read" on public.services for select to authenticated using (true);
create policy "offers_public_read" on public.offers for select to anon using (active = true);
create policy "offers_auth_read" on public.offers for select to authenticated using (true);
create policy "gallery_public_read" on public.gallery for select to anon, authenticated using (true);
create policy "settings_public_read" on public.salon_settings for select to anon, authenticated using (true);

-- Public Insert Policies
create policy "bookings_public_insert" on public.bookings for insert to anon, authenticated with check (true);

-- Admin (Authenticated) Full Policies
create policy "categories_admin" on public.categories for all to authenticated using (true) with check (true);
create policy "services_admin" on public.services for all to authenticated using (true) with check (true);
create policy "offers_admin" on public.offers for all to authenticated using (true) with check (true);
create policy "gallery_admin" on public.gallery for all to authenticated using (true) with check (true);
create policy "settings_admin" on public.salon_settings for all to authenticated using (true) with check (true);
create policy "bookings_admin" on public.bookings for all to authenticated using (true) with check (true);
create policy "payment_methods_admin" on public.payment_methods for all to authenticated using (true) with check (true);
create policy "customers_admin" on public.customers for all to authenticated using (true) with check (true);
create policy "invoices_admin" on public.invoices for all to authenticated using (true) with check (true);
create policy "invoice_items_admin" on public.invoice_items for all to authenticated using (true) with check (true);
create policy "transactions_admin" on public.transactions for all to authenticated using (true) with check (true);
create policy "imported_files_admin" on public.imported_files for all to authenticated using (true) with check (true);
create policy "report_logs_admin" on public.report_logs for all to authenticated using (true) with check (true);
create policy "admin_profiles_admin" on public.admin_profiles for all to authenticated using (true) with check (true);
create policy "analytics_daily_admin" on public.analytics_daily for all to authenticated using (true) with check (true);
create policy "analytics_monthly_admin" on public.analytics_monthly for all to authenticated using (true) with check (true);
create policy "staff_admin" on public.staff for all to authenticated using (true) with check (true);
create policy "attendance_admin" on public.attendance for all to authenticated using (true) with check (true);
create policy "inventory_admin" on public.inventory for all to authenticated using (true) with check (true);
create policy "cash_register_admin" on public.cash_register for all to authenticated using (true) with check (true);

-- ─── 7. TABLE PERMISSIONS & GRANTS ──────────────────────────────────────────

-- Ensure Supabase API role accounts have necessary grants to access tables and schema.
grant usage on schema public to anon, authenticated;

-- Read-only tables for general public / anon
grant select on public.categories, public.services, public.offers, public.gallery, public.salon_settings to anon;
grant insert on public.bookings to anon;

-- Full permission grants on all tables for authenticated administrative logins
grant all on public.categories, public.services, public.offers, public.gallery, public.salon_settings, public.bookings, 
           public.payment_methods, public.customers, public.invoices, public.invoice_items, public.transactions, 
           public.imported_files, public.report_logs, public.admin_profiles, public.analytics_daily, public.analytics_monthly,
           public.staff, public.attendance, public.inventory, public.cash_register to authenticated;

-- ─── 8. STAFF SEED DATA ─────────────────────────────────────────────────────

insert into public.staff (name, role, phone)
values 
  ('Anil Kumar', 'Senior Stylist', '+91 91002 92525'),
  ('Deepika R.', 'Makeup Artist', '+91 91002 92526'),
  ('Srinivas K.', 'Stylist & Colorist', '+91 91002 92527')
on conflict do nothing;

-- ==========================================
-- Migration Complete
-- ==========================================
