-- =============================================
-- MESSAGES & CHAT SYSTEM MIGRATION
-- Instagram-style messaging with once-view media
-- =============================================

-- 1. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  is_once_view BOOLEAN DEFAULT false,
  once_view_opened BOOLEAN DEFAULT false,
  once_view_opened_at TIMESTAMPTZ,
  once_view_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Typing indicators (ephemeral, cleaned up periodically)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- 3. Chat deletions (soft delete per user)
CREATE TABLE IF NOT EXISTS chat_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, other_user_id)
);

-- 4. Storage bucket for chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_once_view_expires ON messages(once_view_expires_at) WHERE is_once_view = true AND once_view_opened = true;
CREATE INDEX IF NOT EXISTS idx_typing_sender ON typing_indicators(sender_id);
CREATE INDEX IF NOT EXISTS idx_typing_receiver ON typing_indicators(receiver_id);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_deletions ENABLE ROW LEVEL SECURITY;

-- Messages: users can read their own conversations
CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Messages: users can insert messages they send
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Messages: receiver can update status (delivered/read), sender can't edit text
CREATE POLICY "Users can update message status"
  ON messages FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Typing: users can see typing targeted at them
CREATE POLICY "Users can read typing indicators"
  ON typing_indicators FOR SELECT
  USING (auth.uid() = receiver_id);

-- Typing: users can insert/update their own typing
CREATE POLICY "Users can set typing"
  ON typing_indicators FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update typing"
  ON typing_indicators FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete typing"
  ON typing_indicators FOR DELETE
  USING (auth.uid() = sender_id);

-- Chat deletions: users can manage their own
CREATE POLICY "Users can read own chat deletions"
  ON chat_deletions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat deletions"
  ON chat_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat deletions"
  ON chat_deletions FOR DELETE
  USING (auth.uid() = user_id);

-- Storage: chat-media policies
CREATE POLICY "Users can upload chat media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view chat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');

CREATE POLICY "Users can delete own chat media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-update updated_at on messages
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();

-- Mark messages as delivered when receiver fetches them
CREATE OR REPLACE FUNCTION mark_messages_delivered(p_sender_id UUID, p_receiver_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET status = 'delivered', delivered_at = now()
  WHERE sender_id = p_sender_id
    AND receiver_id = p_receiver_id
    AND status = 'sent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(p_sender_id UUID, p_receiver_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET status = 'read', read_at = now()
  WHERE sender_id = p_sender_id
    AND receiver_id = p_receiver_id
    AND status IN ('sent', 'delivered');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Open a once-view message (sets 5 day expiry)
CREATE OR REPLACE FUNCTION open_once_view_message(p_message_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET once_view_opened = true,
      once_view_opened_at = now(),
      once_view_expires_at = now() + INTERVAL '5 days',
      status = 'read',
      read_at = now()
  WHERE id = p_message_id
    AND is_once_view = true
    AND once_view_opened = false
    AND receiver_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired once-view media (run via pg_cron or edge function)
CREATE OR REPLACE FUNCTION cleanup_expired_once_view()
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET media_url = NULL,
      text = '[Once-view media expired]'
  WHERE is_once_view = true
    AND once_view_opened = true
    AND once_view_expires_at < now()
    AND media_url IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean stale typing indicators (older than 10 seconds)
CREATE OR REPLACE FUNCTION cleanup_stale_typing()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators
  WHERE started_at < now() - INTERVAL '10 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REALTIME: Enable realtime on messages & typing
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
