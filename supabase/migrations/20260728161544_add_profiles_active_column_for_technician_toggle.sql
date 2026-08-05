/*
# Add profiles.active column for technician activation/deactivation

## Overview
Adds an `active` boolean column to `profiles` so the DEV can activate/deactivate
individual technicians (and any user) independently of their company's active
state. Defaults to `true` so all existing users remain active.

## Changes
1. `profiles.active` (boolean, NOT NULL, default true) — per-user on/off switch.
   - Existing rows backfilled to true.
   - New profiles default to true.
2. No RLS policy changes needed — the existing profiles_update policy already
   allows DEV to update any profile, and the toggle is performed by the admin
   edge function using the service role key (bypasses RLS).

## Security
- The `active` column is only toggled via the `toggle-technician` admin edge
  function action, which requires a DEV caller.
- The frontend AuthContext will check this flag at login and block inactive
  technicians from accessing the app (in addition to the existing company
  active check).

## Important Notes
1. This column is additive — no data is lost.
2. Company-level active state (companies.active) remains the primary gate;
   profiles.active is a secondary per-user toggle for fine-grained control.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Backfill: ensure all existing profiles are active
UPDATE public.profiles SET active = true WHERE active IS NULL;