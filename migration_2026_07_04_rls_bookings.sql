-- =====================================================================
-- MIGRATION: Fix RLS on bookings table + enable realtime
-- Paste this into Supabase SQL Editor and click RUN
-- =====================================================================

-- 1. Ensure RLS is enabled on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "bookings_public_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin"          ON public.bookings;

-- 3. Allow anyone (anon / public) to INSERT a booking (public booking form)
CREATE POLICY "bookings_public_insert"
  ON public.bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4. Allow authenticated admin users full access
CREATE POLICY "bookings_admin"
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Grant INSERT privilege to anon role
GRANT INSERT ON public.bookings TO anon;

-- 6. Enable Supabase Realtime (wrapped in DO blocks to handle duplicates)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- DONE.
-- =====================================================================
