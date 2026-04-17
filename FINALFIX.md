# MALLUCUPID — FINAL FIX LIST

> Generated from full app audit (April 17, 2026)
> Codebase: 9,361 lines | 31 files | 19 DB tables | Build: PASSING

---

## 🔴 MUST FIX (Critical)

### 1. OTP Rate Limit is Frontend-Only
- **Location:** `SignupPage.tsx`, `ForgotPasswordFlow.tsx`
- **Issue:** 30-second resend cooldown is enforced only on the frontend. No server-side rate limiting visible.
- **Risk:** OTP brute-force possible if Supabase rate limiting is not configured.
- **Fix:** Enable Supabase Auth rate limits in project settings (or add server-side throttle).

### 2. No Server-Side File Type Validation on Uploads
- **Location:** All storage uploads (EditProfile, ChatPage, PrivateGallery, VerificationPage)
- **Issue:** File type/MIME validation is frontend-only (`accept` attribute). Backend relies solely on Supabase storage policies.
- **Risk:** Malicious file upload if storage policies are misconfigured.
- **Fix:** Add server-side MIME type validation or Supabase storage policy with allowed MIME types.

### 3. Bank Details Stored in Profiles JSONB Column
- **Location:** `profiles.bank_info` (JSONB), `EditProfile.tsx`, `lib/auth.ts`
- **Issue:** Sensitive bank account details (account number, IFSC, holder name) stored directly in the `profiles` table as a JSONB field.
- **Risk:** Any RLS misconfiguration on `profiles` exposes bank info. Should be in a separate table with stricter RLS.
- **Fix:** Move bank info to a dedicated `bank_accounts` table with RLS: only the user and admin can read.

---

## 🟡 SHOULD FIX (High Priority)

### 4. 6 Async Operations Missing Error Handling
- **Locations:**
  - `App.tsx` — Heartbeat `profiles.update` (~line 145): no try-catch, silent fail
  - `App.tsx` — `refreshConnectionData()`: no error wrapping
  - `Discover.tsx` — `recordSwipe()`: no error handling
  - `FriendsPage.tsx` — `fetchFriends()`: catch block is silent (no user feedback)
  - `InboxPage.tsx` — `fetchConversations()`: no error handling
  - `ChatPage.tsx` — `handleDeleteForMe()` loop: unhandled errors in loop
- **Risk:** Silent failures on network errors. User sees stale data or broken state.
- **Fix:** Add try-catch with appropriate error feedback on each.

### 5. Once-View Media Expiry Calculated on Frontend
- **Location:** `ChatPage.tsx`
- **Issue:** View-once message expiry time is calculated client-side. Backend marks `once_view_opened` but doesn't enforce expiry.
- **Risk:** Client could manipulate the expiry timing.
- **Fix:** Add a DB trigger or RPC that enforces expiry server-side.

### 6. `globalDiscovery` Filter Not Enforced in Discover Query
- **Location:** `App.tsx` → `fetchAllProfiles` call
- **Issue:** Users who set `global_discovery = false` are still returned in remote discover results. The field is stored in DB but never filtered.
- **Risk:** Privacy expectation broken — users expect turning off global discovery hides them.
- **Fix:** Add `.eq('global_discovery', true)` filter when fetching remote profiles (or handle via RLS policy).

### 7. Soft-Deleted Messages Still Exist in DB
- **Location:** `messages` table — `deleted_for_sender`, `deleted_for_receiver`, `deleted_for_everyone` flags
- **Issue:** "Delete for everyone" only sets a flag. The actual message text/media remains in the database.
- **Risk:** Admin or DB breach exposes "deleted" messages. Privacy concern.
- **Fix:** Consider hard-deleting message content (keep metadata) or encrypting message bodies.

### 8. No CSRF Protection on API Routes
- **Location:** `api/create-order.ts`, `api/verify-payment.ts`
- **Issue:** Vercel serverless functions have no built-in CSRF protection. Any origin can POST to these endpoints.
- **Risk:** Cross-site request forgery on payment endpoints.
- **Fix:** Validate `Origin` or `Referer` header, or add a CSRF token flow.

---

## 🟠 MEDIUM PRIORITY

### 9. Free Message Limit is Hardcoded (Frontend-Only)
- **Location:** `ChatPage.tsx` line 37 — `const FREE_MESSAGE_LIMIT = 5;`
- **Issue:** The 5-message limit for free users is a hardcoded frontend constant. Not backed by any DB table or config. No server-side enforcement.
- **Risk:** Can be bypassed by modifying frontend code or calling Supabase directly.
- **Fix:** Move to a config table (e.g., `app_config`) and enforce via RLS policy or RPC.

### 10. Daily Like Limit is Hardcoded (Frontend Constant)
- **Location:** `App.tsx` — `const DAILY_LIKE_LIMIT = 100;`
- **Issue:** The 100 daily like limit is a frontend constant. The RPC `get_daily_like_count` counts swipes but the limit check is client-side.
- **Risk:** Can be bypassed by calling Supabase RPC directly.
- **Fix:** Enforce the limit inside the `increment_daily_like` RPC function on the server.

### 11. Bundle Size Warning (719 KB JS)
- **Location:** Build output
- **Issue:** Single JS bundle is 719 KB (180 KB gzipped). Vite warns about chunks > 500 KB.
- **Risk:** Slow initial load on mobile networks.
- **Fix:** Code-split with `React.lazy()` and dynamic imports for routes.

---

## ⚪ DEAD CODE / CLEANUP

### 12. Unused Component Files
- `components/AdminPanel.tsx` — exists but never imported in `App.tsx`
- `components/SecretGallery.tsx` — exists but never imported (replaced by PrivateGallery.tsx?)
- `components/SecretGalleryView.tsx` — exists but never imported (replaced by PrivateGalleryView.tsx?)
- `components/ExclusiveRoom.tsx` — exists but never imported
- `components/ExclusiveRoomView.tsx` — exists but never imported

### 13. Unused Profile Fields (Stored in DB, Never Displayed)
- `profiles.company` — stored but not shown anywhere in UI
- `profiles.show_age` — stored but no UI toggle
- `profiles.show_distance` — stored but no UI toggle
- `profiles.show_orientation` — stored but no UI toggle

---

## ✅ VERIFIED WORKING (No Fix Needed)

- Razorpay HMAC SHA256 signature verification (server-side)
- Supabase RLS policies on all 19 tables
- Admin access gated by security questions (server-side answer check via RPC)
- Password validation (8-25 chars, uppercase, lowercase, digit, special)
- Blocked user check on login (status='blocked' → denied)
- Session restore + JWT refresh on TOKEN_REFRESHED event
- Heartbeat updates `last_active` every 5 minutes
- 7 real-time channels active and correctly filtered
- Razorpay webhook safety net for payment.captured/failed
- No secrets exposed in frontend code
- No console.log in production paths (only in error handlers)
- No hardcoded mock data — all data from Supabase backend

---

## STATS

| Category | Count |
|----------|-------|
| 🔴 Must Fix | 3 |
| 🟡 Should Fix | 5 |
| 🟠 Medium | 3 |
| ⚪ Dead Code | 5 files + 4 fields |
| ✅ Verified OK | 12 items |
| **Total Issues** | **11 + cleanup** |
