# Mallu Cupid — Task Tracker

## FULLY WORKING PAGES (UI + Supabase Backend)

| Page | Status |
|------|--------|
| LoginPage.tsx | Supabase Auth login, error handling, blocked user check |
| SignupPage.tsx | 4-step registration, OTP, profile creation, photo upload |
| ForgotPasswordFlow.tsx | OTP-based password reset |
| Discover.tsx | Swipe cards, gender filtering, swipe history tracking (DB-backed) |
| EditProfile.tsx | Full profile editor with Supabase save, navigation to sub-pages |
| ChatPage.tsx | Instagram-style messaging with Supabase realtime, media, once-view |
| InboxPage.tsx | Real-time inbox with unread counts, search, read receipts, chat deletion |
| AlertsPage.tsx | Connection requests + notifications from DB, real-time subscriptions |
| UserDetails.tsx | View profile, block/unfriend/report all via Supabase |
| FriendsPage.tsx | Connected users grid, real-time updates, unfriend via DB |
| BlockedUsersPage.tsx | Manage blocked users from Supabase |
| PrivateGallery.tsx | Owner gallery management with Supabase storage |
| PrivateGalleryView.tsx | Viewer gallery access with purchase tracking |
| EarningsPage.tsx | Real earnings/withdrawals from DB, create withdrawal requests |
| BankAccountPage.tsx | Saves bank_info to profiles table via Supabase |
| VerificationPage.tsx | KYC live photo capture, uploads to storage, inserts DB record |
| AdminDashboard.tsx | 6-tab admin panel — overview, users, KYC, pro plan, withdrawals, payouts — all DB-backed |
| DesktopBlocker.tsx | Anti-screenshot, DevTools detection |

## LIVE SUPABASE TABLES (16 tables)

| Table | Purpose | Status |
|-------|---------|--------|
| profiles | User profiles, settings, bank_info, balance, pro_expiry | ✅ Active |
| messages | Chat messages with media support | ✅ Active |
| connection_requests | Friend request system (pending/accepted/rejected) | ✅ Active |
| notifications | Alerts & activity feed | ✅ Active |
| blocked_users | User blocking | ✅ Active |
| user_reports | Abuse reporting | ✅ Active |
| kyc_verification_requests | KYC live photo submissions | ✅ Active |
| chat_deletions | Soft-delete chat conversations | ✅ Active |
| typing_indicators | Real-time typing status | ✅ Active |
| private_gallery_setup | Gallery pricing & config | ✅ Active |
| private_gallery_content | Gallery media items | ✅ Active |
| private_gallery_purchases | Gallery access purchases | ✅ Active |
| earnings | Transaction history (gallery purchases, tips) | ✅ Active |
| withdrawals | Payout requests with admin review | ✅ Active |
| swipe_history | Tracks who each user already swiped on | ✅ Active |
| countries | 197 countries reference table | ✅ Active |

## STORAGE BUCKETS (6 buckets)

| Bucket | Purpose |
|--------|---------|
| profile-images | User profile photos |
| chat-media | Chat attachments |
| chat-once-view | View-once media |
| inbox-media | Inbox thumbnails |
| kyc-uploads | KYC verification photos |
| private-gallery | Private gallery content |

## NAVIGATION STRUCTURE

### Bottom nav (5 tabs)
Discover · Matches · Gallery · Alerts · Profile

### Header
Logout button (left) · Logo (center) · Inbox (right)

### Sub-pages (accessed from profile/cards)
UserDetails · Chat · PrivateGalleryView · Earnings · BankAccount · BlockedUsers · Verification

### Auth restriction
- Logged-in users cannot navigate to landing — browser back shows logout confirmation
- Admin users only see AdminDashboard — back button triggers logout confirmation

## REMAINING WORK

| Item | Priority | Notes |
|------|----------|-------|
| Payment gateway for Pro membership | High | Currently activates instantly without payment — needs Razorpay/Stripe |
| `onDislike` passes through but no further action needed | Low | Swipe is tracked in swipe_history, dislike just moves to next card |
