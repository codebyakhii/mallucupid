-- Swipe history table — tracks who each user has already swiped on
CREATE TABLE IF NOT EXISTS swipe_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL CHECK (action IN ('like', 'dislike')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, target_id)
);

ALTER TABLE swipe_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own swipes" ON swipe_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own swipes" ON swipe_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_swipe_history_user ON swipe_history(user_id);
CREATE INDEX IF NOT EXISTS idx_swipe_history_target ON swipe_history(target_id);
