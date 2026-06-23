-- Supabase Schema Update: June 23, 2026
-- Adds inventory type and expiry columns, and drops obsolete SKU column.

-- Add new inventory type and expiry columns
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS inventory_type TEXT DEFAULT 'retail';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Drop the obsolete SKU column
ALTER TABLE inventory DROP COLUMN IF EXISTS sku;

-- Create Staff Attendance Activity Logs table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT current_date,
  timestamp timestamptz NOT NULL DEFAULT now(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and policies
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_logs_admin" ON public.attendance_logs;
CREATE POLICY "attendance_logs_admin" ON public.attendance_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.attendance_logs TO authenticated;

