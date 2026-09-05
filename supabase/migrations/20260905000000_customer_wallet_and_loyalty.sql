-- =====================================================================
-- ESSENSUALS SALON MANAGEMENT PLATFORM
-- Customer Wallet, 5% Cashback (60-day Expiry), & Ledger Migration
-- Timestamp: 20260905000000
-- =====================================================================

-- 1. Extend customers table with wallet_balance column if not present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN wallet_balance numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Create public.wallet_transactions ledger table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  mobile text NOT NULL,
  type text NOT NULL CHECK (type IN ('recharge_credit', 'recharge_debit', 'cashback_credit', 'wallet_expire', 'adjustment')),
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  bonus_amount numeric DEFAULT 0,
  expiry_date timestamptz,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast customer wallet history lookup
CREATE INDEX IF NOT EXISTS idx_wallet_tx_customer ON public.wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_mobile ON public.wallet_transactions(mobile);

-- 3. Update payment_method constraints on invoices and transactions to allow 'Wallet Balance'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_method_check 
  CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cash + UPI', 'Wallet Balance'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check 
  CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cash + UPI', 'Wallet Balance'));

-- Ensure 'Wallet Balance' is present in payment_methods lookup table if present
INSERT INTO public.payment_methods (name)
VALUES ('Wallet Balance')
ON CONFLICT (name) DO NOTHING;

-- 4. Enable RLS and add public access policies for local Supabase
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated/anon on wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Allow all for authenticated/anon on wallet_transactions" 
  ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);

-- 5. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
