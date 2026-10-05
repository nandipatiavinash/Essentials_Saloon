-- =====================================================================
-- ESSENSUALS SALON MANAGEMENT PLATFORM
-- Security fix: wallet_transactions RLS policy had no `TO` clause, which
-- defaults to PUBLIC in Postgres — meaning unauthenticated (anon) callers
-- could insert/update/delete rows in the cashback/recharge ledger via a
-- direct PostgREST call, with no login required.
-- Timestamp: 20260924000000
-- =====================================================================

DROP POLICY IF EXISTS "Allow all for authenticated/anon on wallet_transactions" ON public.wallet_transactions;

CREATE POLICY "wallet_transactions_authenticated_only"
  ON public.wallet_transactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
