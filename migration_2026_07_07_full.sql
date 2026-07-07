-- =====================================================================
-- ESSENSUALS GORANTLA - FULL MIGRATION: HR, FINANCE, REVIEWS, TRANSFERS
-- Run in: Supabase → SQL Editor → Paste → RUN
-- Safe: additive only, no data is deleted.
-- =====================================================================

-- ─── SECTION 1: STAFF PAYROLL COLUMNS ────────────────────────────────

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS base_salary    numeric      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joining_date   date,
  ADD COLUMN IF NOT EXISTS bank_account   text,
  ADD COLUMN IF NOT EXISTS upi_id         text;

-- ─── SECTION 2: STAFF PAYMENTS (monthly salary records) ──────────────

CREATE TABLE IF NOT EXISTS public.staff_payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id                uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  work_month              text NOT NULL,
  payment_month           text,
  base_salary             numeric NOT NULL DEFAULT 0,
  tips_earned             numeric NOT NULL DEFAULT 0,
  incentives              numeric NOT NULL DEFAULT 0,
  advances_deducted       numeric NOT NULL DEFAULT 0,
  other_deductions        numeric NOT NULL DEFAULT 0,
  net_payable             numeric NOT NULL DEFAULT 0,
  scheduled_payment_date  date,
  payment_date            date,
  status                  text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid','paid','partial')),
  payment_method          text DEFAULT 'Cash',
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, work_month)
);

-- ─── SECTION 3: STAFF ADVANCES ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_advances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  amount              numeric NOT NULL,
  date                date NOT NULL DEFAULT current_date,
  work_month          text NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','deducted','waived')),
  salary_payment_id   uuid REFERENCES public.staff_payments(id),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── SECTION 4: INVOICE TIP SPLITS ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_tip_splits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  staff_id    uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name  text NOT NULL,
  tip_amount  numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── SECTION 5: EXPENSE CATEGORIES (unlimited, user-defined) ─────────

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  icon        text DEFAULT '💳',
  is_system   boolean NOT NULL DEFAULT false,
  is_fixed    boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 99,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.expense_categories (name, icon, is_system, is_fixed, sort_order) VALUES
  ('Rent',           '🏠', true, true,  1),
  ('Room Rent',      '🏠', true, true,  2),
  ('Salaries',       '💰', true, true,  3),
  ('Staff Advance',  '💵', true, false, 4),
  ('Utilities',      '💡', true, true,  5),
  ('Inventory',      '📦', true, false, 6),
  ('Marketing',      '📣', true, false, 7),
  ('Equipment',      '🔧', true, false, 8),
  ('Maintenance',    '🛠️', true, false, 9),
  ('Petty Cash',     '🪙', true, false, 10),
  ('Other',          '📋', true, false, 99)
ON CONFLICT (name) DO NOTHING;

-- ─── SECTION 6: EXPENSES LOG ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expenses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category          text NOT NULL,
  description       text,
  amount            numeric NOT NULL,
  date              date NOT NULL DEFAULT current_date,
  payment_method    text DEFAULT 'Cash',
  reference         text,
  month             text,
  notes             text,
  is_system_entry   boolean NOT NULL DEFAULT false,
  source_id         uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── SECTION 7: CUSTOMER REVIEWS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number  text,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  client_name     text,
  mobile          text,
  rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         text,
  staff_name      text,
  service_names   text[],
  review_token    text UNIQUE,
  reviewed_at     timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Add review columns to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS review_token text,
  ADD COLUMN IF NOT EXISTS review_sent  boolean NOT NULL DEFAULT false;

-- ─── SECTION 8: STOCK TRANSFERS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  product_name    text NOT NULL,
  quantity        numeric NOT NULL,
  transfer_type   text NOT NULL
    CHECK (transfer_type IN ('transfer_out','transfer_in','adjustment','write_off')),
  destination     text,
  origin          text,
  reason          text,
  reference       text,
  transferred_by  text,
  date            date NOT NULL DEFAULT current_date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── SECTION 9: ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE public.staff_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_advances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_tip_splits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_payments_admin"     ON public.staff_payments;
DROP POLICY IF EXISTS "staff_advances_admin"     ON public.staff_advances;
DROP POLICY IF EXISTS "tip_splits_admin"         ON public.invoice_tip_splits;
DROP POLICY IF EXISTS "expense_categories_admin" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_read"  ON public.expense_categories;
DROP POLICY IF EXISTS "expenses_admin"           ON public.expenses;
DROP POLICY IF EXISTS "reviews_public_insert"    ON public.reviews;
DROP POLICY IF EXISTS "reviews_public_select"    ON public.reviews;
DROP POLICY IF EXISTS "reviews_admin"            ON public.reviews;
DROP POLICY IF EXISTS "stock_transfers_admin"    ON public.stock_transfers;

CREATE POLICY "staff_payments_admin"
  ON public.staff_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "staff_advances_admin"
  ON public.staff_advances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "tip_splits_admin"
  ON public.invoice_tip_splits FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "expense_categories_admin"
  ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "expense_categories_read"
  ON public.expense_categories FOR SELECT TO anon USING (true);

CREATE POLICY "expenses_admin"
  ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "reviews_public_insert"
  ON public.reviews FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "reviews_public_select"
  ON public.reviews FOR SELECT TO anon USING (true);

CREATE POLICY "reviews_admin"
  ON public.reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "stock_transfers_admin"
  ON public.stock_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── SECTION 10: FIX INVENTORY & INVOICE RLS ─────────────────────────
-- Ensure authenticated users can read/write inventory and invoice_items

DROP POLICY IF EXISTS "inventory_admin"   ON public.inventory;
DROP POLICY IF EXISTS "invoice_items_admin" ON public.invoice_items;
DROP POLICY IF EXISTS "transactions_admin"  ON public.transactions;

CREATE POLICY "inventory_admin"
  ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "invoice_items_admin"
  ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "transactions_admin"
  ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── SECTION 11: GRANTS ──────────────────────────────────────────────

GRANT ALL ON
  public.staff_payments,
  public.staff_advances,
  public.invoice_tip_splits,
  public.expense_categories,
  public.expenses,
  public.reviews,
  public.stock_transfers
TO authenticated;

GRANT SELECT ON public.expense_categories TO anon;
GRANT INSERT, SELECT ON public.reviews TO anon;

GRANT ALL ON
  public.invoice_items,
  public.transactions,
  public.inventory
TO authenticated;

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================
