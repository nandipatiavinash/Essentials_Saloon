-- Migration Script: Add CRM & ERP columns
-- Supabase -> SQL Editor -> paste -> Run

-- 1. Add membership_id to customers
alter table public.customers 
  add column if not exists membership_id text unique;

-- 2. Add tip to invoices
alter table public.invoices 
  add column if not exists tip numeric not null default 0;

-- 3. Add follow-up fields to bookings
alter table public.bookings 
  add column if not exists follow_up_date date,
  add column if not exists follow_up_notes text,
  add column if not exists assigned_staff text;

-- Re-grant permissions to authenticated role just to be safe
grant all on public.customers, public.invoices, public.bookings to authenticated;
