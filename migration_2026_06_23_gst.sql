-- June 23, 2026: GST Inclusive/Exclusive service toggle
-- Run this in your Supabase SQL Editor

ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT true;

ALTER TABLE public.invoice_items 
  ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT true;
