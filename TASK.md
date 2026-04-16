# Mallu Cupid — Task Tracker

## WORKING PAGES (Complete UI + Backend)

| Page | Status |
|------|--------|
| LoginPage.tsx | Supabase Auth login, error handling |
| SignupPage.tsx | 4-step registration, OTP, profile creation, photo upload |
| ForgotPasswordFlow.tsx | OTP-based password reset |
| Discover.tsx | Swipe cards, gender filtering, animations |
| EditProfile.tsx | Full profile editor with Supabase save |
| AdminDashboard.tsx | 5-tab admin panel with user management |
| DesktopBlocker.tsx | Anti-screenshot, DevTools detection |

## PARTIALLY BUILT (UI exists, NO backend persistence)

| Page | What's Missing |
|------|---------------|
| ChatPage.tsx | ✅ DONE — Instagram-style messaging with Supabase realtime |
| InboxPage.tsx | ✅ DONE — Real-time inbox with unread counts, search, read receipts |
| AlertsPage.tsx | No `notifications` / `connection_requests` table |
| UserDetails.tsx | Block/unfriend/report only in React state |
| EarningsPage.tsx | No `earnings` / `withdrawals` table |
| BankAccountPage.tsx | Form doesn't actually save to `profiles.bank_info` |
| BlockedUsersPage.tsx | No Supabase storage for blocked users |
| SecretGallery.tsx | No `secret_content` table, no file storage |
| SecretGalleryView.tsx | No `purchases` table |
| ExclusiveRoom.tsx | No room data in Supabase |
| ExclusiveRoomView.tsx | No `subscriptions` table |
| VerificationPage.tsx | Docs uploaded but never sent to backend |

## STUB / UNUSED PAGES

| Page | Issue |
|------|-------|
| ProfilePage.tsx | Redundant — overlaps with EditProfile |
| AdminPanel.tsx | Superseded by AdminDashboard |
| FriendsPage.tsx | Component exists but never routed in App.tsx |

## MISSING SUPABASE TABLES (10 tables needed)

| Table | Purpose |
|-------|---------|
| `connection_requests` | Friend request system |
| `messages` | ✅ DONE — Chat persistence + real-time |
| `notifications` | Alerts & activity feed |
| `user_reports` | Abuse reporting |
| `withdrawals` | Payout requests |
| `purchases` | Secret gallery sales |
| `subscriptions` | Exclusive room access |
| `earnings` | Transaction history |
| `secret_content` | Premium media storage |
| `blocked_users` | User blocking |

## ROUTING ISSUES in App.tsx

- [ ] `'friends'` is in navigation but `renderContent()` never renders FriendsPage
- [ ] `'notifications'` nav item not wired to AlertsPage

## CRITICAL ISSUES

- [ ] Nothing persists except profile data — messages, connections, earnings, blocks, reports are all React state only. Refresh = gone.
- [ ] No payment system — Pro membership, secret gallery purchases, room subscriptions are all fake (client-side state).
- [ ] No real-time messaging — Chat UI works but messages are ephemeral.
