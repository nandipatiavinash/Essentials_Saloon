-- ============================================================
-- Essensuals Salon — Database Migration
-- Date: 2026-06-17
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add item_type column to invoice_items
--    Allows distinguishing service items from product (inventory) sales
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'service';

-- 2. Add inventory_id foreign key to invoice_items
--    Links a product sale line item to the inventory record
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL;

-- 3. Update existing rows to have item_type = 'service'
UPDATE invoice_items
SET item_type = 'service'
WHERE item_type IS NULL OR item_type = '';

-- 4. Simplify membership_tier in customers table
--    All existing tiers become 'Member' (single tier system)
UPDATE customers
SET membership_tier = 'Member'
WHERE is_member = true;

UPDATE customers
SET membership_tier = 'Regular'
WHERE is_member = false OR is_member IS NULL;

-- 5. Create index for faster invoice number lookups by date prefix
--    (supports sequential INV-YYYYMMDD-NNN generation)
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number
  ON invoices (invoice_number);

-- ============================================================
-- Verification queries — run these to confirm migration
-- ============================================================

-- Check item_type column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'invoice_items'
  AND column_name IN ('item_type', 'inventory_id');

-- Check membership_tier values
SELECT membership_tier, COUNT(*) as count
FROM customers
GROUP BY membership_tier;

-- Check index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'invoices'
  AND indexname = 'idx_invoices_invoice_number';
