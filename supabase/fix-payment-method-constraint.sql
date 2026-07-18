-- Fix the payment method check constraints to allow the 'Cash + UPI' hybrid payment method
-- Run this in Supabase -> SQL Editor -> paste -> Run

-- 1. Drop existing constraints if they exist
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

-- 2. Re-create constraints with the 'Cash + UPI' option included
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_method_check 
  CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cash + UPI'));

ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check 
  CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cash + UPI'));
