/*
# Add Service Orders, budget photos, and OS photos

## Overview
Adds three new features to the budget system:
1. **Budget photos** — photos can be attached to a budget (e.g. of the site/objects being quoted).
2. **Service Orders (Ordens de Serviço / O.S.)** — a budget that is approved can be
   converted into a Service Order. The budget's description/observations become the
   "serviço a executar" field, and the budget's items become the "material utilizado"
   list. The O.S. has its own status, technician, and notes.
3. **Service Order photos** — before/after photos attached to a service order, used
   to generate a "relatório do serviço realizado" PDF report.

## New Tables
1. `budget_photos` — id, budget_id (FK budgets), storage_path, position, created_at.
   Multiple photos per budget, ordered by `position`.
2. `service_orders` — id, company_id (FK companies), budget_id (FK budgets, nullable),
   user_id (owner, defaults to auth.uid()), client_name, client_email, client_phone,
   title, service_to_execute (text), materials_used (text[]), technician, status
   (draft|in_progress|completed|cancelled), notes, created_at, updated_at.
3. `service_order_photos` — id, service_order_id (FK service_orders), storage_path,
   kind ('before' | 'after'), position, created_at.

## Storage Buckets
- `budget-photos` (public) — photos attached to budgets.
- `service-order-photos` (public) — before/after photos attached to service orders.

## Security (RLS)
- All new tables are owner-company scoped (same pattern as budgets): DEV reads all,
  EMPRESA manages rows whose company_id matches their profile's company_id.
- Storage buckets: authenticated can upload/read/update/delete; public read so the
  app and generated PDFs can display images without signed URLs.

## Important Notes
1. `service_orders.user_id` defaults to `auth.uid()` so inserts omitting the owner succeed.
2. `service_orders.materials_used` is a text array capturing the list of budget items
   as plain strings (e.g. "Tinta branca — 10 un"). This is a snapshot at conversion
   time, not a live link, so later edits to the budget don't silently change the O.S.
3. A service order may be created from a budget (budget_id set) or standalone (null).
4. When a budget is deleted, linked service_orders keep their data (ON DELETE SET NULL
   on budget_id) so historical O.S. records are preserved.
*/

-- ===== budget_photos =====
CREATE TABLE IF NOT EXISTS public.budget_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_photos_budget_id_idx ON public.budget_photos(budget_id);

ALTER TABLE public.budget_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_photos_select" ON public.budget_photos;
CREATE POLICY "budget_photos_select" ON public.budget_photos FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "budget_photos_insert" ON public.budget_photos;
CREATE POLICY "budget_photos_insert" ON public.budget_photos FOR INSERT
  TO authenticated WITH CHECK (
    budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "budget_photos_update" ON public.budget_photos;
CREATE POLICY "budget_photos_update" ON public.budget_photos FOR UPDATE
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

DROP POLICY IF EXISTS "budget_photos_delete" ON public.budget_photos;
CREATE POLICY "budget_photos_delete" ON public.budget_photos FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

-- ===== service_orders =====
CREATE TABLE IF NOT EXISTS public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  title text NOT NULL,
  service_to_execute text,
  materials_used text[] NOT NULL DEFAULT '{}',
  technician text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_orders_company_id_idx ON public.service_orders(company_id);
CREATE INDEX IF NOT EXISTS service_orders_budget_id_idx ON public.service_orders(budget_id);

DROP TRIGGER IF EXISTS service_orders_touch_updated_at ON public.service_orders;
CREATE TRIGGER service_orders_touch_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_orders_select" ON public.service_orders;
CREATE POLICY "service_orders_select" ON public.service_orders FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "service_orders_insert" ON public.service_orders;
CREATE POLICY "service_orders_insert" ON public.service_orders FOR INSERT
  TO authenticated WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "service_orders_update" ON public.service_orders;
CREATE POLICY "service_orders_update" ON public.service_orders FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "service_orders_delete" ON public.service_orders;
CREATE POLICY "service_orders_delete" ON public.service_orders FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

-- ===== service_order_photos =====
CREATE TABLE IF NOT EXISTS public.service_order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'before' CHECK (kind IN ('before','after')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_order_photos_so_id_idx ON public.service_order_photos(service_order_id);

ALTER TABLE public.service_order_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_order_photos_select" ON public.service_order_photos;
CREATE POLICY "service_order_photos_select" ON public.service_order_photos FOR SELECT
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "service_order_photos_insert" ON public.service_order_photos;
CREATE POLICY "service_order_photos_insert" ON public.service_order_photos FOR INSERT
  TO authenticated WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "service_order_photos_update" ON public.service_order_photos;
CREATE POLICY "service_order_photos_update" ON public.service_order_photos FOR UPDATE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  ) WITH CHECK (
    service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "service_order_photos_delete" ON public.service_order_photos;
CREATE POLICY "service_order_photos_delete" ON public.service_order_photos FOR DELETE
  TO authenticated USING (
    public.is_dev()
    OR service_order_id IN (
      SELECT so.id FROM public.service_orders so
      WHERE so.company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    )
  );

-- ===== Storage buckets =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('budget-photos', 'budget-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('service-order-photos', 'service-order-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for budget-photos bucket
DROP POLICY IF EXISTS "budget_photos_bucket_read" ON storage.objects;
CREATE POLICY "budget_photos_bucket_read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'budget-photos');

DROP POLICY IF EXISTS "budget_photos_bucket_insert" ON storage.objects;
CREATE POLICY "budget_photos_bucket_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'budget-photos');

DROP POLICY IF EXISTS "budget_photos_bucket_update" ON storage.objects;
CREATE POLICY "budget_photos_bucket_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'budget-photos') WITH CHECK (bucket_id = 'budget-photos');

DROP POLICY IF EXISTS "budget_photos_bucket_delete" ON storage.objects;
CREATE POLICY "budget_photos_bucket_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'budget-photos');

-- Storage policies for service-order-photos bucket
DROP POLICY IF EXISTS "service_order_photos_bucket_read" ON storage.objects;
CREATE POLICY "service_order_photos_bucket_read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'service-order-photos');

DROP POLICY IF EXISTS "service_order_photos_bucket_insert" ON storage.objects;
CREATE POLICY "service_order_photos_bucket_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'service-order-photos');

DROP POLICY IF EXISTS "service_order_photos_bucket_update" ON storage.objects;
CREATE POLICY "service_order_photos_bucket_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'service-order-photos') WITH CHECK (bucket_id = 'service-order-photos');

DROP POLICY IF EXISTS "service_order_photos_bucket_delete" ON storage.objects;
CREATE POLICY "service_order_photos_bucket_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'service-order-photos');
