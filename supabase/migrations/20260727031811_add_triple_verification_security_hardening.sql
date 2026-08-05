/*
# Triple Verification Security Hardening

## Overview
This migration closes several authorization gaps by adding:
1. A helper function that checks whether the caller's company is active.
2. A helper function that identifies the EMPRESA (company admin) role.
3. An active-company gate on all write policies for budgets, budget_items,
   budget_photos, service_orders, service_order_items, service_order_photos.
4. EMPRESA-only restrictions on company branding updates (companies UPDATE)
   and budget price fields (budget_items) — technicians can create budget
   items but only with unit_price = 0; only EMPRESA/DEV can set non-zero prices.
5. A database trigger that blocks technicians from changing protected fields
   (client_name, client_email, client_phone, title, service_to_execute,
   technician assignment) on service_orders via direct API calls.
6. Storage bucket policies tightened so writes/deletes require the object's
   path prefix to match the caller's company_id, preventing cross-company
   photo tampering.

## Helper Functions
- `is_empresa()` — SECURITY DEFINER, returns true if caller's role = 'empresa'.
- `my_company_active()` — SECURITY DEFINER, returns true if the caller's
  company exists AND `companies.active = true`. DEV always returns true
  (DEV has no company_id but has full access).

## Policy Changes (all idempotent — DROP + CREATE)
- companies UPDATE: restricted to DEV or EMPRESA of that company (technicians
  can no longer change branding settings).
- budgets INSERT/UPDATE/DELETE: require active company (in addition to
  existing company-membership check).
- budget_items INSERT: technicians must use unit_price = 0; EMPRESA/DEV
  unrestricted. UPDATE/DELETE: require active company.
- budget_photos INSERT/UPDATE/DELETE: require active company.
- service_orders INSERT: requires active company. UPDATE: technician path
  still allowed but the new trigger enforces field-level protection.
- service_order_items, service_order_photos: require active company for
  EMPRESA writes; technician writes scoped to assigned O.S. (unchanged logic
  but now also gated by active company for the EMPRESA path).
- Storage objects (logos, budget-photos, service-order-photos): write/update/
  delete now require the storage object name to start with the caller's
  company_id prefix, so a user from company A cannot delete company B's photos.

## Guard Trigger
- `guard_service_order_technician_update` — BEFORE UPDATE trigger on
  service_orders. If the updater is a technician (role = 'tecnico'), the
  trigger compares OLD vs NEW for the protected columns and raises an
  exception if any changed. Protected columns: client_name, client_email,
  client_phone, title, service_to_execute, technician_id, company_id.
  This is the third layer: even if RLS allows the update and the UI hides
  the fields, the database itself rejects the change.

## Important Notes
1. No tables or columns are dropped or renamed — no data loss.
2. `my_company_active()` uses SECURITY DEFINER to read `companies.active`
   without triggering recursion (companies has its own RLS).
3. Storage path-prefix check: company logos are stored as
   `<company_id>/logo-<timestamp>.<ext>`, budget photos as
   `<budget_id>/<timestamp>-<rand>.<ext>`, and service-order photos as
   `<service_order_id>/<timestamp>-<rand>.<ext>`. For budget and OS photos
   we verify the parent entity belongs to the caller's company via a
   SECURITY DEFINER function rather than a simple prefix match, because the
   photo path uses the entity ID, not the company ID.
*/

-- ===== Helper Functions =====

CREATE OR REPLACE FUNCTION public.is_empresa()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'empresa'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_company_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_dev() THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = auth.uid() AND c.active = true
    )
  END;
$$;

-- Helper: does a budget belong to the caller's company?
CREATE OR REPLACE FUNCTION public.budget_in_my_company(b_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.budgets b
    JOIN public.profiles p ON p.company_id = b.company_id
    WHERE b.id = b_id AND p.id = auth.uid()
  );
$$;

-- Helper: does a service order belong to the caller's company?
CREATE OR REPLACE FUNCTION public.so_in_my_company(so_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_orders so
    JOIN public.profiles p ON p.company_id = so.company_id
    WHERE so.id = so_id AND p.id = auth.uid()
  );
$$;

-- ===== companies UPDATE: EMPRESA or DEV only (not technicians) =====

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR (public.is_empresa() AND id = public.my_company_id())
  ) WITH CHECK (
    public.is_dev()
    OR (public.is_empresa() AND id = public.my_company_id())
  );

-- ===== budgets: add active-company gate to writes =====

DROP POLICY IF EXISTS "budgets_insert" ON public.budgets;
CREATE POLICY "budgets_insert" ON public.budgets FOR INSERT
  TO authenticated WITH CHECK (
    public.my_company_active()
    AND company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "budgets_update" ON public.budgets;
CREATE POLICY "budgets_update" ON public.budgets FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR (public.my_company_active()
        AND company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
  ) WITH CHECK (
    public.is_dev()
    OR (public.my_company_active()
        AND company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
  );

DROP POLICY IF EXISTS "budgets_delete" ON public.budgets;
CREATE POLICY "budgets_delete" ON public.budgets FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR (public.my_company_active()
        AND company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
  );

-- ===== budget_items: technicians can only insert price=0; active-company gate =====

DROP POLICY IF EXISTS "budget_items_insert" ON public.budget_items;
CREATE POLICY "budget_items_insert" ON public.budget_items FOR INSERT
  TO authenticated WITH CHECK (
    public.my_company_active()
    AND budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
    AND (
      public.is_dev() OR public.is_empresa()
      OR unit_price = 0
    )
  );

DROP POLICY IF EXISTS "budget_items_update" ON public.budget_items;
CREATE POLICY "budget_items_update" ON public.budget_items FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR (public.my_company_active()
        AND budget_id IN (
          SELECT b.id FROM public.budgets b
          WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
        ))
  ) WITH CHECK (
    public.is_dev()
    OR (public.my_company_active()
        AND budget_id IN (
          SELECT b.id FROM public.budgets b
          WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
        )
        AND (public.is_dev() OR public.is_empresa() OR unit_price = 0))
  );

DROP POLICY IF EXISTS "budget_items_delete" ON public.budget_items;
CREATE POLICY "budget_items_delete" ON public.budget_items FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR (public.my_company_active()
        AND budget_id IN (
          SELECT b.id FROM public.budgets b
          WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
        ))
  );

-- ===== budget_photos: active-company gate on writes =====

DROP POLICY IF EXISTS "budget_photos_insert" ON public.budget_photos;
CREATE POLICY "budget_photos_insert" ON public.budget_photos FOR INSERT
  TO authenticated WITH CHECK (
    public.my_company_active()
    AND budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "budget_photos_update" ON public.budget_photos;
CREATE POLICY "budget_photos_update" ON public.budget_photos FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR (public.my_company_active()
        AND budget_id IN (
          SELECT b.id FROM public.budgets b
          WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
        ))
  ) WITH CHECK (
    public.is_dev()
    OR (public.my_company_active()
        AND budget_id IN (
          SELECT b.id FROM public.budgets b
          WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
        ))
  );

DROP POLICY IF EXISTS "budget_photos_delete" ON public.budget_photos;
CREATE POLICY "budget_photos_delete" ON public.budget_photos FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR (public.my_company_active()
        AND budget_id IN (
          SELECT b.id FROM public.budgets b
          WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
        ))
  );

-- ===== service_orders: active-company gate =====

DROP POLICY IF EXISTS "service_orders_insert" ON public.service_orders;
CREATE POLICY "service_orders_insert" ON public.service_orders FOR INSERT
  TO authenticated WITH CHECK (
    public.my_company_active()
    AND company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = auth.uid()
  );

-- UPDATE policy stays the same (dev / company member / assigned technician)
-- but we add active-company gate for the non-dev, non-technician path.
DROP POLICY IF EXISTS "service_orders_update" ON public.service_orders;
CREATE POLICY "service_orders_update" ON public.service_orders FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR (public.my_company_active()
        AND company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
    OR technician_id = auth.uid()
  ) WITH CHECK (
    public.is_dev()
    OR (public.my_company_active()
        AND company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
    OR technician_id = auth.uid()
  );

-- ===== service_order_items: active-company gate for EMPRESA path =====

DROP POLICY IF EXISTS "service_order_items_insert" ON public.service_order_items;
CREATE POLICY "service_order_items_insert" ON public.service_order_items FOR INSERT
  TO authenticated WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "service_order_items_update" ON public.service_order_items;
CREATE POLICY "service_order_items_update" ON public.service_order_items FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  ) WITH CHECK (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "service_order_items_delete" ON public.service_order_items;
CREATE POLICY "service_order_items_delete" ON public.service_order_items FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  );

-- ===== service_order_photos: active-company gate for EMPRESA path =====

DROP POLICY IF EXISTS "service_order_photos_insert" ON public.service_order_photos;
CREATE POLICY "service_order_photos_insert" ON public.service_order_photos FOR INSERT
  TO authenticated WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "service_order_photos_update" ON public.service_order_photos;
CREATE POLICY "service_order_photos_update" ON public.service_order_photos FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  ) WITH CHECK (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "service_order_photos_delete" ON public.service_order_photos;
CREATE POLICY "service_order_photos_delete" ON public.service_order_photos FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE (
        (public.my_company_active()
         AND so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()))
        OR so.technician_id = auth.uid()
      )
    )
  );

-- ===== Guard Trigger: block technicians from editing protected OS fields =====

CREATE OR REPLACE FUNCTION public.guard_technician_os_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'tecnico' THEN
    IF NEW.client_name IS DISTINCT FROM OLD.client_name
       OR NEW.client_email IS DISTINCT FROM OLD.client_email
       OR NEW.client_phone IS DISTINCT FROM OLD.client_phone
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.service_to_execute IS DISTINCT FROM OLD.service_to_execute
       OR NEW.technician_id IS DISTINCT FROM OLD.technician_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
    THEN
      RAISE EXCEPTION 'Técnicos não podem alterar campos protegidos da ordem de serviço.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_technician_os_update ON public.service_orders;
CREATE TRIGGER guard_technician_os_update
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_technician_os_update();

-- ===== Storage: scope writes by company prefix =====

-- Logos: path = <company_id>/logo-... so we can prefix-match the company_id.
DROP POLICY IF EXISTS "logos_insert" ON storage.objects;
CREATE POLICY "logos_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.my_company_id()::text
  );

DROP POLICY IF EXISTS "logos_update" ON storage.objects;
CREATE POLICY "logos_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.my_company_id()::text
  ) WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.my_company_id()::text
  );

DROP POLICY IF EXISTS "logos_delete" ON storage.objects;
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.my_company_id()::text
  );

-- Budget photos: path = <budget_id>/... so verify the budget belongs to caller's company
DROP POLICY IF EXISTS "budget_photos_bucket_insert" ON storage.objects;
CREATE POLICY "budget_photos_bucket_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'budget-photos'
    AND public.budget_in_my_company((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "budget_photos_bucket_update" ON storage.objects;
CREATE POLICY "budget_photos_bucket_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'budget-photos'
    AND public.budget_in_my_company((storage.foldername(name))[1]::uuid)
  ) WITH CHECK (
    bucket_id = 'budget-photos'
    AND public.budget_in_my_company((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "budget_photos_bucket_delete" ON storage.objects;
CREATE POLICY "budget_photos_bucket_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'budget-photos'
    AND public.budget_in_my_company((storage.foldername(name))[1]::uuid)
  );

-- Service order photos: path = <so_id>/... so verify the SO belongs to caller's company
DROP POLICY IF EXISTS "service_order_photos_bucket_insert" ON storage.objects;
CREATE POLICY "service_order_photos_bucket_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-order-photos'
    AND public.so_in_my_company((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "service_order_photos_bucket_update" ON storage.objects;
CREATE POLICY "service_order_photos_bucket_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'service-order-photos'
    AND public.so_in_my_company((storage.foldername(name))[1]::uuid)
  ) WITH CHECK (
    bucket_id = 'service-order-photos'
    AND public.so_in_my_company((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "service_order_photos_bucket_delete" ON storage.objects;
CREATE POLICY "service_order_photos_bucket_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-order-photos'
    AND public.so_in_my_company((storage.foldername(name))[1]::uuid)
  );