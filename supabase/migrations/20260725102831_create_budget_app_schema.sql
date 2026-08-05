/*
# Create budget app schema (multi-tenant with DEV + EMPRESA roles)

## Overview
A customizable budget/quote (orcamento) PWA with two access levels:
- DEV: creates, activates, deactivates companies (empresas); can view any
  company's data and reset any company's password.
- EMPRESA: manages their own budgets and customizes their company's appearance.

## New Tables
1. `companies` - id, name, active, primary_color, logo_url, created_at
2. `profiles` - id (FK auth.users), email, role (dev|empresa), company_id, created_at
3. `budgets` - id, company_id, user_id, client info, title, status, valid_until, timestamps
4. `budget_items` - id, budget_id, description, quantity, unit_price, created_at

## Security (RLS)
- companies: DEV reads/updates all; EMPRESA reads/updates own company.
- profiles: self read/update; DEV reads/updates all.
- budgets + budget_items: DEV reads all; EMPRESA manages own company's rows.

## Important Notes
1. Tables are created before the is_dev() helper function to avoid forward refs.
2. Company activation/deactivation and password resets are handled by an edge
   function using the service role key.
3. Owner columns default to auth.uid() so inserts omitting the owner succeed.
*/

-- companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  primary_color text NOT NULL DEFAULT '#2563eb',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('dev','empresa')),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_company_id_idx ON public.profiles(company_id);

-- budgets
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected')),
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budgets_company_id_idx ON public.budgets(company_id);

-- budget_items
CREATE TABLE IF NOT EXISTS public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_items_budget_id_idx ON public.budget_items(budget_id);

-- Helper function: is the current user a DEV?
CREATE OR REPLACE FUNCTION public.is_dev()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'dev'
  );
$$;

-- updated_at trigger for budgets
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budgets_touch_updated_at ON public.budgets;
CREATE TRIGGER budgets_touch_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- companies policies
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  ) WITH CHECK (
    public.is_dev()
    OR id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

-- profiles policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid() OR public.is_dev()
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  TO authenticated USING (
    id = auth.uid() OR public.is_dev()
  ) WITH CHECK (
    id = auth.uid() OR public.is_dev()
  );

-- budgets policies
DROP POLICY IF EXISTS "budgets_select" ON public.budgets;
CREATE POLICY "budgets_select" ON public.budgets FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "budgets_insert" ON public.budgets;
CREATE POLICY "budgets_insert" ON public.budgets FOR INSERT
  TO authenticated WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "budgets_update" ON public.budgets;
CREATE POLICY "budgets_update" ON public.budgets FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "budgets_delete" ON public.budgets;
CREATE POLICY "budgets_delete" ON public.budgets FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

-- budget_items policies
DROP POLICY IF EXISTS "budget_items_select" ON public.budget_items;
CREATE POLICY "budget_items_select" ON public.budget_items FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "budget_items_insert" ON public.budget_items;
CREATE POLICY "budget_items_insert" ON public.budget_items FOR INSERT
  TO authenticated WITH CHECK (
    budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "budget_items_update" ON public.budget_items;
CREATE POLICY "budget_items_update" ON public.budget_items FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  ) WITH CHECK (
    budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "budget_items_delete" ON public.budget_items;
CREATE POLICY "budget_items_delete" ON public.budget_items FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );
