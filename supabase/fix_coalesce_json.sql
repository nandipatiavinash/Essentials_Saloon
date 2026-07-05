-- =====================================================================
-- MIGRATION: Fix coalesce and JSON/JSONB type issues in sales analytics
-- Run this in your Supabase SQL Editor
-- =====================================================================

CREATE OR REPLACE FUNCTION public.refresh_sales_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert/update daily analytics, explicitly casting '[]' to jsonb to avoid any coalesce json vs text conflicts
  INSERT INTO public.analytics_daily (
    metric_date, revenue, invoice_count, average_bill, 
    cash_total, upi_total, card_total, bank_transfer_total, 
    top_services, updated_at
  )
  SELECT 
    sale_date, revenue, invoice_count, average_bill, 
    cash_total, upi_total, card_total, bank_transfer_total,
    '[]'::jsonb, -- Explicitly default top_services to jsonb
    now()
  FROM public.daily_sales_view
  ON CONFLICT (metric_date) DO UPDATE SET
    revenue = excluded.revenue,
    invoice_count = excluded.invoice_count,
    average_bill = excluded.average_bill,
    cash_total = excluded.cash_total,
    upi_total = excluded.upi_total,
    card_total = excluded.card_total,
    bank_transfer_total = excluded.bank_transfer_total,
    updated_at = now();

  -- Insert/update monthly analytics, explicitly casting '[]' to jsonb
  INSERT INTO public.analytics_monthly (
    metric_month, revenue, invoice_count, average_bill, 
    top_services, updated_at
  )
  SELECT 
    sale_month, revenue, invoice_count, average_bill, 
    '[]'::jsonb, -- Explicitly default top_services to jsonb
    now()
  FROM public.monthly_sales_view
  ON CONFLICT (metric_month) DO UPDATE SET
    revenue = excluded.revenue,
    invoice_count = excluded.invoice_count,
    average_bill = excluded.average_bill,
    updated_at = now();
END;
$$;
