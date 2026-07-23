-- Migration to add days_present column to staff_payments table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.staff_payments 
ADD COLUMN IF NOT EXISTS days_present integer DEFAULT 0;
