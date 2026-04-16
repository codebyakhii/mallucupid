-- =====================================================
-- Private Gallery Migration
-- Tables: private_gallery_setup, private_gallery_content, private_gallery_purchases
-- =====================================================

-- 1. Setup table — stores bank/KYC info for gallery creators
CREATE TABLE IF NOT EXISTS private_gallery_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dob text NOT NULL,
  email text NOT NULL,
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text NOT NULL,
  bank_name text NOT NULL,
  terms_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Content table — photos/videos uploaded by gallery owners
CREATE TABLE IF NOT EXISTS private_gallery_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  file_url text NOT NULL,
  head_note text NOT NULL CHECK (char_length(head_note) <= 100),
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Purchases table — tracks who paid for what content
CREATE TABLE IF NOT EXISTS private_gallery_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES private_gallery_content(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buyer_id, content_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pg_setup_user ON private_gallery_setup(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_content_owner ON private_gallery_content(owner_id);
CREATE INDEX IF NOT EXISTS idx_pg_purchases_buyer ON private_gallery_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_pg_purchases_content ON private_gallery_purchases(content_id);

-- RLS Policies
ALTER TABLE private_gallery_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_gallery_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_gallery_purchases ENABLE ROW LEVEL SECURITY;

-- Setup: users can read/insert/update their own row
CREATE POLICY "Users can read own gallery setup"
  ON private_gallery_setup FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gallery setup"
  ON private_gallery_setup FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gallery setup"
  ON private_gallery_setup FOR UPDATE
  USING (auth.uid() = user_id);

-- Content: owners can CRUD their own; anyone can SELECT (to browse galleries)
CREATE POLICY "Anyone can view gallery content"
  ON private_gallery_content FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert gallery content"
  ON private_gallery_content FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own gallery content"
  ON private_gallery_content FOR DELETE
  USING (auth.uid() = owner_id);

-- Purchases: buyers can insert their own; can read their own
CREATE POLICY "Buyers can read own purchases"
  ON private_gallery_purchases FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can insert purchases"
  ON private_gallery_purchases FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Content owners can see purchases of their content
CREATE POLICY "Owners can see purchases of their content"
  ON private_gallery_purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private_gallery_content
      WHERE private_gallery_content.id = private_gallery_purchases.content_id
      AND private_gallery_content.owner_id = auth.uid()
    )
  );

-- Create storage bucket for private gallery media
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-gallery', 'private-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload to private-gallery"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'private-gallery' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view private-gallery files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'private-gallery');

CREATE POLICY "Users can delete own private-gallery files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'private-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for content updates
ALTER PUBLICATION supabase_realtime ADD TABLE private_gallery_content;
