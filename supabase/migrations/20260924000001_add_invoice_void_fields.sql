-- =====================================================================
-- ESSENSUALS SALON MANAGEMENT PLATFORM
-- Soft-void workflow for invoices (BILL-06 audit fix).
--
-- invoices.status already supports 'void'/'refunded' via a CHECK
-- constraint, and every revenue/report aggregation already excludes
-- status = 'void' — but nothing in the app ever set that status; the
-- only correction mechanism was a hard DELETE with no audit trail.
-- This adds the columns needed to record WHY and WHEN an invoice was
-- voided, and by whom, so a corrected bill is excluded from revenue
-- but the record (and the reason) is retained.
-- Timestamp: 20260924000001
-- =====================================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS voided_by text;

NOTIFY pgrst, 'reload schema';
