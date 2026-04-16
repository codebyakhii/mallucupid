-- ╔════════════════════════════════════════════════════════════════╗
-- ║  KYC VERIFICATION TABLE + STORAGE BUCKETS MIGRATION          ║
-- ╚════════════════════════════════════════════════════════════════╝

-- ─── 1. KYC VERIFICATION REQUESTS TABLE ─────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_verification_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  live_photo_1 text NOT NULL,
  live_photo_2 text NOT NULL,
  admin_notes text DEFAULT NULL,
  reviewed_by uuid DEFAULT NULL REFERENCES auth.users(id),
  reviewed_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON public.kyc_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_verification_requests(status);

-- RLS
ALTER TABLE public.kyc_verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can view own kyc requests"
  ON public.kyc_verification_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can submit kyc requests"
  ON public.kyc_verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all kyc requests
CREATE POLICY "Admins can view all kyc requests"
  ON public.kyc_verification_requests FOR SELECT
  USING (public.is_admin());

-- Admins can update kyc requests (approve/reject)
CREATE POLICY "Admins can update kyc requests"
  ON public.kyc_verification_requests FOR UPDATE
  USING (public.is_admin());

-- ─── 2. STORAGE BUCKET: kyc-uploads ─────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-uploads', 'kyc-uploads', true)
  ON CONFLICT (id) DO NOTHING;

-- Upload policy: users can upload to their own folder
CREATE POLICY "Users can upload kyc images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- View policy: anyone can view (needed for admin review)
CREATE POLICY "Anyone can view kyc images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-uploads');

-- Delete policy: users can delete their own kyc images
CREATE POLICY "Users can delete own kyc images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'kyc-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── 3. STORAGE BUCKET: inbox-media ─────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('inbox-media', 'inbox-media', true)
  ON CONFLICT (id) DO NOTHING;

-- Upload policy
CREATE POLICY "Users can upload inbox media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'inbox-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- View policy
CREATE POLICY "Anyone can view inbox media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inbox-media');

-- Delete policy
CREATE POLICY "Users can delete own inbox media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'inbox-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── 4. STORAGE BUCKET: chat-once-view (7-day retention) ────────
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-once-view', 'chat-once-view', true)
  ON CONFLICT (id) DO NOTHING;

-- Upload policy
CREATE POLICY "Users can upload once-view media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-once-view' AND auth.uid()::text = (storage.foldername(name))[1]);

-- View policy
CREATE POLICY "Anyone can view once-view media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-once-view');

-- Delete policy
CREATE POLICY "Users can delete own once-view media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-once-view' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── 5. Ensure private-gallery bucket exists (already created) ──
INSERT INTO storage.buckets (id, name, public) VALUES ('private-gallery', 'private-gallery', true)
  ON CONFLICT (id) DO NOTHING;

-- ─── NOTE: chat-media bucket already exists for normal chat media ─
-- The app now uses:
--   profile-images  → profile photos
--   kyc-uploads     → KYC live photos
--   private-gallery → private gallery images/videos
--   inbox-media     → inbox shared media
--   chat-once-view  → once-view chat media (7 day retention in backend)
--   chat-media      → normal chat photos/videos
