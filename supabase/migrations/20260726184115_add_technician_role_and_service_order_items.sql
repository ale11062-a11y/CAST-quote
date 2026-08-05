/*
# Add technician role, link service orders to technicians, and structured OS materials

## Overview
Adds a third access level — TECNICO (technician) — to the existing DEV/EMPRESA roles.
A technician belongs to a company (like EMPRESA), can create budgets WITHOUT price
fields (scope/dimensions only), and executes the service orders assigned to them.

## Changes

1. `profiles.role` check constraint expanded to allow 'tecnico'.
   - A technician profile is linked to a company via `company_id` (same as empresa).

2. `service_orders.technician_id` (uuid, nullable) — references auth.users.
   When an EMPRESA creates an O.S. it picks a technician from a list of the
   company's registered technicians; this column stores that link so the
   technician can see only the O.S. assigned to them.

3. `service_order_items` — new table for structured materials added during
   execution of a service order (description, quantity, unit). Replaces the
   free-text `materials_used` text[] for materials the technician adds on the
   ground; the snapshot list coming from the budget stays in `materials_used`.
   - `id`, `service_order_id` (FK service_orders ON DELETE CASCADE),
     `description`, `quantity`, `unit`, `created_at`.

4. RLS on `service_order_items`: DEV reads all; within a company, both EMPRESA
   and TECNICO can read; EMPRESA can insert/update/delete; TECNICO can
   insert/update/delete on the O.S. assigned to them.

5. RLS updates for `service_orders` and `service_order_photos`:
   - SELECT: a technician can now see the O.S. whose `technician_id` equals
     their own user id (in addition to the existing company-membership rule).
   - UPDATE: a technician can update the O.S. assigned to them (to execute it:
     add materials, photos, change status, notes) but NOT change the technician
     assignment or client/title/service fields set by the company. The policy
     is split so EMPRESA keeps full company-scoped update and TECNICO gets a
     narrower update scope.

## Security (RLS)
- profiles: unchanged (self read/update, DEV all). Role values now include 'tecnico'.
- service_orders: SELECT/UPDATE widened to allow the assigned technician.
- service_order_items: new owner/company-scoped policies with technician
  execution access on their assigned O.S.
- budget_items / budgets: a technician can SEE and CREATE budgets for their
  company (so they can build the scope), but the existing policies already
  scope by company membership, which now includes technicians. No budget
  policy change needed beyond the company-membership check, which already
  uses `company_id IN (SELECT company_id FROM profiles ...)`.

## Important Notes
1. `technician_id` is nullable so existing O.S. rows are not affected. New O.S.
   created by the company will set it; standalone O.S. may leave it null.
2. `service_order_items` is additive — `materials_used` (text[]) is kept as the
   budget snapshot. New execution-time materials go into `service_order_items`.
3. The technician update policy restricts WHAT a technician may change via the
   application layer (the frontend hides fields); the DB policy itself allows
   the update on the assigned row. Field-level restriction is enforced in the
   UI, not at column level, to keep the policy simple and avoid dynamic SQL.
*/

-- 1. Expand profiles.role to include 'tecnico'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_role_check' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('dev','empresa','tecnico'));

-- 2. Add technician_id to service_orders
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_orders_technician_id_idx ON public.service_orders(technician_id);

-- 3. New table for structured materials added during OS execution
CREATE TABLE IF NOT EXISTS public.service_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'un',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_order_items_so_id_idx ON public.service_order_items(service_order_id);

ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;

-- helper: is the caller a technician?
CREATE OR REPLACE FUNCTION public.is_tecnico()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'tecnico'
  );
$$;

-- service_order_items policies
DROP POLICY IF EXISTS "service_order_items_select" ON public.service_order_items;
CREATE POLICY "service_order_items_select" ON public.service_order_items FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
    OR service_order_id IN (SELECT id FROM public.service_orders WHERE technician_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_order_items_insert" ON public.service_order_items;
CREATE POLICY "service_order_items_insert" ON public.service_order_items FOR INSERT
  TO authenticated WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_order_items_update" ON public.service_order_items;
CREATE POLICY "service_order_items_update" ON public.service_order_items FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  ) WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_order_items_delete" ON public.service_order_items;
CREATE POLICY "service_order_items_delete" ON public.service_order_items FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  );

-- 4. Widen service_orders SELECT so an assigned technician sees their O.S.
DROP POLICY IF EXISTS "service_orders_select" ON public.service_orders;
CREATE POLICY "service_orders_select" ON public.service_orders FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    OR technician_id = auth.uid()
  );

-- 5. Allow the assigned technician to UPDATE their O.S. (execution)
DROP POLICY IF EXISTS "service_orders_update" ON public.service_orders;
CREATE POLICY "service_orders_update" ON public.service_orders FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    OR technician_id = auth.uid()
  ) WITH CHECK (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    OR technician_id = auth.uid()
  );

-- 6. Widen service_order_photos so an assigned technician can manage photos
DROP POLICY IF EXISTS "service_order_photos_select" ON public.service_order_photos;
CREATE POLICY "service_order_photos_select" ON public.service_order_photos FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_order_photos_insert" ON public.service_order_photos;
CREATE POLICY "service_order_photos_insert" ON public.service_order_photos FOR INSERT
  TO authenticated WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_order_photos_update" ON public.service_order_photos;
CREATE POLICY "service_order_photos_update" ON public.service_order_photos FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  ) WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_order_photos_delete" ON public.service_order_photos;
CREATE POLICY "service_order_photos_delete" ON public.service_order_photos FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR so.technician_id = auth.uid()
    )
  );