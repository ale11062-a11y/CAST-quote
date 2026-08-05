/*
# Add technician name + fix profiles RLS for company-scoped technician visibility

## Overview
1. `profiles.name` (text, nullable) — display name for technicians (and any
   user). The email remains the login; the name is what appears in the UI
   on budgets and service orders.
2. `profiles_select` RLS widened: an EMPRESA can now read all profiles in
   its own company (so it can list its technicians). Previously the policy
   only allowed `id = auth.uid() OR is_dev()`, which silently hid every
   other company member — including the technicians it had just created.
3. `profiles_update` unchanged (self or dev).
4. Backfill: existing technicians get a name derived from their email
   local part so the field is never empty for them.

## Security (RLS)
- profiles SELECT: self OR dev OR same-company member.
  - An empresa reading another company's profiles is still blocked: the
    `company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())`
    clause restricts to rows whose company_id matches the caller's own.
  - A technician can read colleagues in the same company (acceptable: they
    share the company and need to see who issued an O.S./budget).
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name text;

UPDATE public.profiles
  SET name = split_part(email, '@', 1)
  WHERE name IS NULL AND role = 'tecnico';

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR public.is_dev()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );
