-- ─── SUPABASE RLS POLICIES FIX ──────────────────────────────────────────────
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/wrgdvrctdsmnrmpdtdio/sql)
-- This will ensure that all RLS policies are correctly set up so authenticated admins can view and edit data.

-- 1. Enable RLS on all tables
ALTER TABLE public.categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_advances         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_tip_splits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expense_payments ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
DROP POLICY IF EXISTS "categories_admin"       ON public.categories;
DROP POLICY IF EXISTS "services_public_read"   ON public.services;
DROP POLICY IF EXISTS "services_auth_read"     ON public.services;
DROP POLICY IF EXISTS "services_admin"         ON public.services;
DROP POLICY IF EXISTS "offers_public_read"     ON public.offers;
DROP POLICY IF EXISTS "offers_auth_read"       ON public.offers;
DROP POLICY IF EXISTS "offers_admin"           ON public.offers;
DROP POLICY IF EXISTS "gallery_public_read"    ON public.gallery;
DROP POLICY IF EXISTS "gallery_admin"          ON public.gallery;
DROP POLICY IF EXISTS "settings_public_read"   ON public.salon_settings;
DROP POLICY IF EXISTS "settings_admin"         ON public.salon_settings;
DROP POLICY IF EXISTS "bookings_public_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin"         ON public.bookings;
DROP POLICY IF EXISTS "customers_admin"        ON public.customers;
DROP POLICY IF EXISTS "invoices_admin"         ON public.invoices;
DROP POLICY IF EXISTS "invoice_items_admin"    ON public.invoice_items;
DROP POLICY IF EXISTS "transactions_admin"     ON public.transactions;
DROP POLICY IF EXISTS "staff_admin"            ON public.staff;
DROP POLICY IF EXISTS "attendance_admin"       ON public.attendance;
DROP POLICY IF EXISTS "attendance_logs_admin"  ON public.attendance_logs;
DROP POLICY IF EXISTS "inventory_admin"        ON public.inventory;
DROP POLICY IF EXISTS "cash_register_admin"    ON public.cash_register;
DROP POLICY IF EXISTS "expenses_admin"         ON public.expenses;
DROP POLICY IF EXISTS "expense_categories_admin" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_read"  ON public.expense_categories;
DROP POLICY IF EXISTS "staff_payments_admin"   ON public.staff_payments;
DROP POLICY IF EXISTS "staff_advances_admin"   ON public.staff_advances;
DROP POLICY IF EXISTS "tip_splits_admin"       ON public.invoice_tip_splits;
DROP POLICY IF EXISTS "reviews_public_insert"  ON public.reviews;
DROP POLICY IF EXISTS "reviews_public_select"  ON public.reviews;
DROP POLICY IF EXISTS "reviews_admin"          ON public.reviews;
DROP POLICY IF EXISTS "stock_transfers_admin"  ON public.stock_transfers;
DROP POLICY IF EXISTS "fixed_expenses_admin"   ON public.fixed_expenses;
DROP POLICY IF EXISTS "fixed_expense_payments_admin" ON public.fixed_expense_payments;
DROP POLICY IF EXISTS "invoices_public_review_read" ON public.invoices;
DROP POLICY IF EXISTS "invoice_items_public_review_read" ON public.invoice_items;

-- 3. Create public/anon select policies (for client website)
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "services_public_read"   ON public.services FOR SELECT TO anon USING (active = true);
CREATE POLICY "services_auth_read"     ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "offers_public_read"     ON public.offers FOR SELECT TO anon USING (active = true);
CREATE POLICY "offers_auth_read"       ON public.offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "gallery_public_read"    ON public.gallery FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_public_read"   ON public.salon_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bookings_public_insert" ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "expense_categories_read" ON public.expense_categories FOR SELECT TO anon USING (true);
CREATE POLICY "reviews_public_insert"  ON public.reviews FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "reviews_public_select"  ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "invoices_public_review_read" ON public.invoices FOR SELECT TO anon, authenticated USING (review_token IS NOT NULL);
CREATE POLICY "invoice_items_public_review_read" ON public.invoice_items FOR SELECT TO anon, authenticated USING (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND invoices.review_token IS NOT NULL
  )
);

-- 4. Create full admin access policies for authenticated users
CREATE POLICY "categories_admin"       ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "services_admin"         ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "offers_admin"           ON public.offers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "gallery_admin"          ON public.gallery FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "settings_admin"         ON public.salon_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bookings_admin"         ON public.bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_admin"        ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "invoices_admin"         ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "invoice_items_admin"    ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "transactions_admin"     ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_admin"            ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "attendance_admin"       ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "attendance_logs_admin"  ON public.attendance_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_admin"        ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cash_register_admin"    ON public.cash_register FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "expenses_admin"         ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "expense_categories_admin" ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_payments_admin"   ON public.staff_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_advances_admin"   ON public.staff_advances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tip_splits_admin"       ON public.invoice_tip_splits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reviews_admin"          ON public.reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "stock_transfers_admin"  ON public.stock_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fixed_expenses_admin"   ON public.fixed_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fixed_expense_payments_admin" ON public.fixed_expense_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Grant permissions to authenticated role on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. Grant select access on invoices and invoice_items to anon role so they can perform token-based lookups
GRANT SELECT ON public.invoices, public.invoice_items TO anon;
