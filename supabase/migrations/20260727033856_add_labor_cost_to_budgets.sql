/*
# Add labor_cost column to budgets

## Overview
Adds a dedicated `labor_cost` column to the `budgets` table so that the "MÃO DE
OBRA" (labor) value is stored as a fixed field on the budget itself, separate
from the line items. This makes labor a first-class, always-present field on
every budget — visible in the editor, the preview, and the generated PDF.

## Changes
- `budgets.labor_cost` (numeric, nullable, default 0) — the labor/mão-de-obra
  value for the budget. Stored separately from budget_items so it is always
  shown as a fixed row regardless of whether any line items exist.

## Security
- No policy changes. The existing budgets RLS policies (select/insert/update/
  delete) already cover the table; adding a column does not require new
  policies — the existing ownership checks apply to the entire row including
  the new column.

## Important Notes
1. The column is nullable with a default of 0 so existing budgets are not
   affected — they will report labor_cost = 0.
2. No data is lost; no tables or columns are dropped or renamed.
3. Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ to safely add the column
   only if it does not already exist.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'budgets' AND column_name = 'labor_cost'
  ) THEN
    ALTER TABLE public.budgets ADD COLUMN labor_cost numeric DEFAULT 0;
  END IF;
END $$;