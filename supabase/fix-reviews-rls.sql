-- Fix reviews unassigned issue by allowing anonymous select on invoices and invoice_items with review tokens
-- Run this in Supabase -> SQL Editor -> paste -> Run

-- Drop old review read policies if they exist
DROP POLICY IF EXISTS "invoices_public_review_read" ON public.invoices;
DROP POLICY IF EXISTS "invoice_items_public_review_read" ON public.invoice_items;

-- Create SELECT policies for anon/authenticated roles to read invoices & items via review tokens
CREATE POLICY "invoices_public_review_read" ON public.invoices
  FOR SELECT TO anon, authenticated
  USING (review_token IS NOT NULL);

CREATE POLICY "invoice_items_public_review_read" ON public.invoice_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.review_token IS NOT NULL
    )
  );

-- Grant select permission to anon/authenticated roles on invoices and invoice_items
GRANT SELECT ON public.invoices, public.invoice_items TO anon, authenticated;
