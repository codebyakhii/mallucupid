-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MALLU CUPID — Social Features Migration                   ║
-- ║  Tables: connection_requests, notifications,                ║
-- ║          blocked_users, user_reports                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════
-- 1. CONNECTION REQUESTS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(from_id, to_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_requests_from ON public.connection_requests(from_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_to ON public.connection_requests(to_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON public.connection_requests(status);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own connection requests (sent or received)
CREATE POLICY "Users can view own connection requests"
  ON public.connection_requests FOR SELECT
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Users can send connection requests
CREATE POLICY "Users can send connection requests"
  ON public.connection_requests FOR INSERT
  WITH CHECK (auth.uid() = from_id);

-- Users can update requests they received (accept/reject) or sent (cancel)
CREATE POLICY "Users can update own connection requests"
  ON public.connection_requests FOR UPDATE
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Users can delete their own sent requests
CREATE POLICY "Users can delete own connection requests"
  ON public.connection_requests FOR DELETE
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Admins can manage all connection requests
CREATE POLICY "Admins can manage all connection requests"
  ON public.connection_requests FOR ALL
  USING (public.is_admin());

-- ════════════════════════════════════════════════════════════════
-- 2. NOTIFICATIONS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('request', 'acceptance', 'update', 'payout')),
  from_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  text text NOT NULL DEFAULT '',
  read boolean DEFAULT false,
  related_id uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System/users can insert notifications for any user
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own notifications (mark read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications  
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin());

-- ════════════════════════════════════════════════════════════════
-- 3. BLOCKED USERS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocks
CREATE POLICY "Users can view own blocks"
  ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

-- Users can block other users
CREATE POLICY "Users can block others"
  ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Users can unblock (delete their own blocks)
CREATE POLICY "Users can unblock others"
  ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Admins can manage all blocks
CREATE POLICY "Admins can manage all blocks"
  ON public.blocked_users FOR ALL
  USING (public.is_admin());

-- ════════════════════════════════════════════════════════════════
-- 4. USER REPORTS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_target ON public.user_reports(target_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON public.user_reports(status);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON public.user_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Users can submit reports
CREATE POLICY "Users can submit reports"
  ON public.user_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Admins can manage all reports
CREATE POLICY "Admins can manage all reports"
  ON public.user_reports FOR ALL
  USING (public.is_admin());

-- ════════════════════════════════════════════════════════════════
-- 5. HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════════

-- Function: Accept a connection request + create notifications for both users
CREATE OR REPLACE FUNCTION public.accept_connection_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req record;
BEGIN
  SELECT * INTO req FROM public.connection_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.to_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Update status
  UPDATE public.connection_requests SET status = 'accepted', updated_at = now() WHERE id = request_id;

  -- Notify the sender that their request was accepted
  INSERT INTO public.notifications (user_id, type, from_user_id, text, related_id)
  VALUES (req.from_id, 'acceptance', req.to_id, 'accepted your connection request', request_id);
END;
$$;

-- Function: Reject a connection request
CREATE OR REPLACE FUNCTION public.reject_connection_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req record;
BEGIN
  SELECT * INTO req FROM public.connection_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.to_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.connection_requests SET status = 'rejected', updated_at = now() WHERE id = request_id;
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- 6. REALTIME
-- ════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;
