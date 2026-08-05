/*
# Add unit column to budget_items + create logos storage bucket

## Overview
1. Adds a `unit` (unidade de medida) column to `budget_items` so each line item
   can specify its measurement unit (e.g. "un", "m²", "kg", "h", "m").
2. Creates a public `logos` storage bucket so companies can upload their logo
   image and have it appear on their budget PDFs and dashboard header.

## Changes
- `budget_items.unit` (text, default 'un') — unit of measure for the item.
- Storage bucket `logos` (public) for company logo uploads.
- Storage policies: authenticated users can upload/read/update/delete objects
  in the `logos` bucket. The bucket is public so generated PDFs and the app
  can display logos without a signed URL.

## Important Notes
1. The `unit` column is nullable-safe with a default of 'un' so existing rows
   (if any) are not affected.
2. Logos are stored with a path prefix of the company id so each company's
   logo is isolated: `logos/<company_id>/<filename>`.
*/

-- Add unit column to budget_items
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'un';

-- Create the logos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the logos bucket
DROP POLICY IF EXISTS "logos_read" ON storage.objects;
CREATE POLICY "logos_read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_insert" ON storage.objects;
CREATE POLICY "logos_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_update" ON storage.objects;
CREATE POLICY "logos_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos') WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_delete" ON storage.objects;
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
