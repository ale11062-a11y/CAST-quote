/*
# Fix profiles_select RLS infinite recursion

## Problem
The `profiles_select` policy added in the previous migration contained:
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
That subquery hits `profiles` again, which re-evaluates the same SELECT
policy, which runs the subquery again — infinite recursion. Postgres
errors out, so every profile read returns nothing. The frontend calls
`fetchProfile()` right after `signInWithPassword()`, gets null, and the
router (`if (!profile) return <Login />`) bounces back to the login
screen — so login appears to silently fail.

## Fix
1. Add `public.my_company_id()` — a SECURITY DEFINER function that
   reads the caller's `company_id` from `profiles` as the owner role
   (bypassing RLS). This breaks the recursion: the policy no longer
   references `profiles` from inside its own evaluation.
2. Rewrite `profiles_select` to:
     id = auth.uid()
     OR public.is_dev()
     OR company_id = public.my_company_id()
   Semantics are identical to the intent of the previous migration:
   a user can read their own row, the DEV can read everyone, and any
   member of a company can read every other member of that same
   company (so the empresa can list its technicians). Cross-company
   reads are still blocked because `my_company_id()` returns the
   caller's own company_id only.

## Security
- `my_company_id()` is SECURITY DEFINER, owned by the postgres/owner
  role, so it bypasses RLS on `profiles` by design — but it only
  returns the caller's own company_id, never another user's.
- No other policies or tables are touched.
*/

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR public.is_dev()
    OR company_id = public.my_company_id()
  );
