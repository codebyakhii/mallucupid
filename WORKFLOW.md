# MalluCupid Application Workflow

**Last updated**: March 25, 2026  
**Stack**: React 19.2.3 + TypeScript + Vite 6 + Tailwind CSS (CDN) + Supabase  
**Hosting**: Vercel (auto-deploy from GitHub main branch)  
**Domain**: mallucupid.com / www.mallucupid.com  
**Email**: Resend SMTP (smtp.resend.com, port 465)

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Database Schema](#2-database-schema)
3. [Authentication Flow](#3-authentication-flow)
4. [App Routing](#4-app-routing)
5. [Discover (Swipe Cards)](#5-discover-swipe-cards)
6. [User Details](#6-user-details)
7. [Connections & Friends](#7-connections--friends)
8. [Chat & Inbox](#8-chat--inbox)
9. [Notifications](#9-notifications)
10. [Profile Management](#10-profile-management)
11. [Secret Gallery](#11-secret-gallery)
12. [Exclusive Room](#12-exclusive-room)
13. [Earnings & Withdrawals](#13-earnings--withdrawals)
14. [Admin Dashboard](#14-admin-dashboard)
15. [Navigation & UI](#15-navigation--ui)
16. [File Reference](#16-file-reference)

---

## 1. Architecture

### File Structure
```
/workspaces/mallucupid/
├── App.tsx                    Main app router & state manager
├── types.ts                   All TypeScript interfaces
├── constants.tsx              Landing background image
├── index.html                 Entry point (Tailwind CDN)
├── index.tsx                  React root render
├── vite.config.ts             Vite build configuration
├── package.json               Dependencies
├── .env                       Supabase credentials
├── RULES.md                   Development rules (read before every task)
├── WORKFLOW.md                This file
├── lib/
│   ├── supabase.ts           Supabase client initialization
│   ├── auth.ts               16 auth/profile functions (incl. deleteProfileImage)
│   └── location.ts           GPS + OpenStreetMap Nominatim
├── components/
│   ├── DesktopBlocker.tsx    Blocks desktop access (mobile only)
│   ├── LoginPage.tsx         Email/password login
│   ├── SignupPage.tsx        4-step registration
│   ├── ForgotPasswordFlow.tsx  OTP-based password reset
│   ├── Discover.tsx          Tinder-style swipe cards
│   ├── UserDetails.tsx       View other user's profile
│   ├── ChatPage.tsx          1-on-1 messaging
│   ├── InboxPage.tsx         Chat list
│   ├── FriendsPage.tsx       Connected users grid
│   ├── AlertsPage.tsx        Connection requests & alerts
│   ├── EditProfile.tsx        Edit own profile (full Tinder-style)
│   ├── PrivateGallery.tsx    Owner private gallery management
│   ├── PrivateGalleryView.tsx Viewer private gallery access
│   ├── EarningsPage.tsx      Earnings & withdrawal requests
│   ├── BankAccountPage.tsx   Bank details form
│   ├── BlockedUsersPage.tsx  Manage blocked users
│   ├── VerificationPage.tsx  KYC live photo verification
│   └── AdminDashboard.tsx    6-tab admin control panel
└── supabase/
    ├── migration.sql         Database schema + RLS policies
    ├── edit_profile_migration.sql  Profile field additions
    ├── withdrawals_earnings_migration.sql  Withdrawals & earnings tables
    ├── swipe_history_migration.sql  Swipe tracking table
    ├── countries_seed.sql    197 countries table
    └── config.toml           Supabase local config
```

### Dependencies
- `react` 19.2.3, `react-dom` 19.2.3
- `@supabase/supabase-js` (auth, database, storage)
- `vite` 6.x, `typescript`
- Tailwind CSS via CDN (no npm package)

### Supabase Project
- **Project ref**: waiutstnvmoscloztwcg
- **URL**: https://waiutstnvmoscloztwcg.supabase.co
- **Storage bucket**: profile-images (public)

---

## 2. Database Schema

### Profiles Table
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique not null,
  email text unique not null,
  dob date not null,
  age integer not null,
  location text not null,
  bio text default '',
  gender text default 'Women',
  looking_for text default 'All',
  orientation text default 'Straight',
  relationship_goal text default 'Longterm Partner',
  interests text[] default '{}',
  image_url text default '',
  images text[] default '{}',
  occupation text default '',
  verified boolean default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  balance numeric(10,2) default 0,
  pro_expiry timestamptz default null,
  bank_info jsonb default null,
  verification_docs jsonb default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  pronouns text default '',
  lifestyle jsonb default '{}',
  job_title text default '',
  company text default '',
  education text default '',
  latitude double precision default null,
  longitude double precision default null,
  show_me text default 'Everyone',
  age_min integer default 18,
  age_max integer default 50,
  max_distance integer default 50,
  show_age boolean default true,
  show_distance boolean default true,
  show_orientation boolean default true
);
```

### Countries Table
- 197 countries seeded via `countries_seed.sql`
- Used as fallback in location selection

### RLS Policies
1. **Anyone can view active profiles** — `status = 'active' or auth.uid() = id`
2. **Users can insert own profile** — `auth.uid() = id`
3. **Users can update own profile** — `auth.uid() = id`
4. **Admins can view all profiles** — via `is_admin()` security definer function
5. **Admins can update any profile** — via `is_admin()` security definer function
6. **Admins can delete profiles** — via `is_admin()` security definer function

### Security Definer Function
```sql
create function public.is_admin() returns boolean
language sql security definer stable
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
```
This prevents infinite recursion in admin RLS policies.

### Storage
- **Bucket**: `profile-images` (public read)
- **Upload path**: `profile-images/{userId}/{timestamp}.{ext}`
- **Policies**: Users can upload/delete own images, public read

---

## 3. Authentication Flow

### 3a. Signup (4 Steps)

**Step 1 — Account Credentials**
1. User enters: full name, username, date of birth, email, password
2. Validations:
   - Name: auto title-case (first letter capital per word)
   - Username: lowercase, alphanumeric + special chars, 6-20 characters
   - Username: real-time uniqueness check via `checkUsernameAvailable()`
   - Date of birth: exact age calculation, must be 18+
   - Email: regex validation
   - Password: 8-25 chars, requires uppercase + lowercase + number + special char
3. On "Next": calls `signUpWithEmail(email, password)` → stores authUserId
4. Moves to Step 2

**Step 2 — Email Verification**
1. 6-digit OTP sent automatically to email (via Resend SMTP)
2. User enters OTP code
3. 30-second cooldown timer for resend
4. On "Verify": calls `verifyOtp(email, token)`
5. Moves to Step 3

**Step 3 — Profile Information**
1. Location: GPS auto-detect button + OpenStreetMap Nominatim search
   - `getCurrentPosition()` → `reverseGeocode(lat, lon)` for auto-detect
   - `searchPlaces(query)` with 400ms debounce for search
   - Country dropdown fallback via `fetchCountries()`
2. Bio: minimum 10 characters
3. Dropdowns: gender, looking for, orientation, relationship goal
4. Moves to Step 4

**Step 4 — Profile Images**
1. Upload 2-10 images (JPG/PNG/WEBP, max 10MB each)
2. Each image uploaded to Supabase Storage via `uploadProfileImage()`
3. Accept Terms & Privacy checkboxes required
4. On "Complete Signup":
   - Uploads all images → collects URLs
   - Calls `createUserProfile(authUserId, profileData)`
   - Shows success screen (2 seconds)
   - Calls `onSuccess()` → App fetches session → fetches profile → navigates to discover

### 3b. Login

1. User enters email and password
2. On "Login": calls `loginWithEmail(email, password)`
3. App calls `fetchUserProfile(user.id)`
4. If profile not found → error "Profile not found. Please sign up first."
5. If status is "blocked" → error "Your account has been suspended."
6. Calls `fetchAllProfiles()` to populate discover
7. If role is "admin" → navigates to `adminDashboard`
8. Otherwise → navigates to `discover`

### 3c. Session Restore (App Mount)

1. On App.tsx mount: calls `getCurrentSession()`
2. If session exists: fetches profile + all users
3. Routes to `adminDashboard` or `discover` based on role
4. Listens to `supabase.auth.onAuthStateChange` for sign-out events

### 3d. Forgot Password (3 Steps)

**Step 1**: Enter email → calls `sendPasswordResetOtp(email)`  
**Step 2**: Enter 6-digit OTP → calls `verifyPasswordResetOtp(email, token)`  
**Step 3**: Enter new password + confirm → calls `updatePassword(newPassword)`  
**Result**: Success screen → redirect to login

### 3e. Logout

1. Confirmation modal: "Sign Out?"
2. On confirm: calls `signOut()`
3. Clears all state (currentUser, allUsers, connections, messages, etc.)
4. Navigates to `landing`

---

## 4. App Routing

### View Type (20 views)
```typescript
type View = 'landing' | 'login' | 'signup' | 'forgotPassword'
  | 'discover' | 'friends' | 'profile' | 'chat' | 'inbox'
  | 'userDetails' | 'notifications' | 'privateGallery'
  | 'privateGalleryView' | 'earnings' | 'verification'
  | 'blockedUsers' | 'adminDashboard' | 'bankAccount'
  | 'terms' | 'privacy';
```

### Navigation Methods
- `setView(view)` — instant view change
- `navigateToView(view)` — 600ms loading transition with spinner

### Main Tab Views (show header + bottom nav)
- `discover`, `friends`, `privateGallery`, `notifications`, `profile`, `inbox`

### Render Map
| View | Component | Access |
|------|-----------|--------|
| landing | Custom JSX (background image + "Get Started") | Public |
| terms | Custom JSX (scrollable) | Public |
| privacy | Custom JSX (scrollable) | Public |
| login | LoginPage | Public |
| signup | SignupPage | Public |
| forgotPassword | ForgotPasswordFlow | Public |
| discover | Discover | Authenticated |
| userDetails | UserDetails | Authenticated |
| chat | ChatPage | Authenticated + Pro |
| inbox | InboxPage | Authenticated |
| friends | FriendsPage | Authenticated |
| notifications | AlertsPage | Authenticated |
| profile | EditProfile | Authenticated |
| privateGallery | PrivateGallery | Authenticated |
| privateGalleryView | PrivateGalleryView | Authenticated |
| earnings | EarningsPage | Authenticated |
| bankAccount | BankAccountPage | Authenticated |
| blockedUsers | BlockedUsersPage | Authenticated |
| verification | VerificationPage | Authenticated |
| adminDashboard | AdminDashboard | Admin only |

---

## 5. Discover (Swipe Cards)

### How It Works
1. Loads `allUsers` from Supabase
2. Filters: removes self, blocked, suspended, non-matching gender preferences
3. Displays one card at a time with next card visible behind (scaled 95%)

### Swipe Mechanics
- **Drag right > 80px** → like (green "LIKE" stamp, fly right animation)
- **Drag left > 80px** → dislike (red "NOPE" stamp, fly left animation)
- **Below threshold** → spring back to center with elastic animation
- Card rotation follows drag direction (dragX * 0.08 degrees)

### Image Navigation
- Tap left 35% of card → previous image
- Tap right 65% of card → next image
- Progress dots at top show current image index

### Action Buttons (bottom row)
- **X button** (red circle) → reject/skip, moves to next profile
- **Star button** (blue circle) → view full profile details
- **Heart button** (green circle) → like/connect (disabled if already requested)

### Profile Info on Card
- Name, age (large, white, bold)
- Verified badge (blue checkmark)
- Occupation (medium, white/70)
- Location with pin icon (small, white/50)
- Info button (i) → navigate to UserDetails

### Empty State
- Heart emoji in gradient circle
- "No More Profiles" heading
- "Check back later for new people" subtitle

---

## 6. User Details

### Navigation
- From Discover: tap info button or star button on card
- From Friends: tap profile card in grid

### Layout
- Image gallery (65% height) with navigation arrows
- Profile info section (scrollable below)
- Back button returns to previous view

### Actions Available
- **Chat Now** — requires: connected + Pro member
- **Connect** — send connection request (or shows "Request Pending")
- **Secret Gallery** → navigates to secretGalleryView
- **Exclusive Room** → navigates to exclusiveRoomView
- **Unfriend** — remove connection (only if connected)
- **Block** — add to blocked list
- **Report** — submit report with reason

### Modals
- "Connect First" — shown when trying to chat without being connected
- "Pro Feature" — shown when trying to chat without Pro (₹99/month upgrade)

---

## 7. Connections & Friends

### Connection Flow
1. User A swipes right / clicks "Connect" on User B
2. Connection request created: `{ fromId: A, toId: B, status: 'pending' }`
3. User B sees request in Alerts page
4. User B clicks "Accept" → status changes to `'accepted'`
5. Both users appear in each other's Friends page
6. Connection enables chat (if Pro)

### Friends Page
- 2-column grid of connected profiles
- Each card: photo, username, age, location
- Tap card → management modal (View Profile, Block, Close)
- Empty state: "No linked accounts yet"

### Linked Profiles Computation
```typescript
const linkedProfiles = connections
  .filter(c => c.status === 'accepted')
  .map(c => c.fromId === currentUser.id ? c.toId : c.fromId)
  .filter(id => !blockedIds.includes(id))
  .map(id => allUsers.find(u => u.id === id));
```

---

## 8. Chat & Inbox

### Inbox
- Lists active conversations with connected users
- Sorted by most recent message timestamp
- Shows: avatar, username, last message preview, time
- **Pro required**: non-Pro users see upgrade modal

### Chat Page
- Real-time 1-on-1 messaging
- Auto-scrolls to latest message
- Own messages: right-aligned, colored background
- Other messages: left-aligned, white background
- Supports text and media (image/video) messages
- Upload progress bar for media
- Header shows: avatar, username, verified badge, "Active Now"

---

## 9. Notifications

### Two Sections
1. **Connection Requests** — pending requests with accept/reject buttons
2. **All Notifications** — system notifications with colored dots and timestamps

### Notification Types
- `request` — connection request (shows profile + accept/reject)
- `update` — system update
- `acceptance` — request accepted
- `payout` — earnings notification (green dot)

---

## 10. Profile Management (Edit Profile)

### Component: `EditProfile.tsx` (replaces old ProfilePage.tsx)
Tinder-inspired full edit profile page with 13 sections.

### Structure (Top → Bottom)
1. **Header** — sticky top bar with "Edit profile" title + gradient Save button
2. **Photo Manager** — upload/delete/reorder up to 9 photos with real Supabase Storage
   - Aspect 3:4 photo viewer with pagination dots
   - Left/right navigation arrows
   - Three-dot menu: set as main, move left/right, delete (with confirmation modal)
   - Thumbnail grid (5 columns) with active indicator + dashed upload button
   - All changes persist to DB in real time (images[] + image_url)
3. **Bio** — textarea (max 500 chars) with character counter
4. **Basic Info** — name, username, DOB (readonly), age (readonly), gender pills, orientation pills, pronouns pills
5. **Interests** — multi-select chip grid (38 options, max 15 selections)
6. **Lifestyle** — drinking, smoking, exercise, pets, diet — each with pill selectors
7. **Work & Education** — job title, company, education text inputs
8. **Relationship Goals** — single-select pills (5 options)
9. **Location Settings** — search input with Nominatim autocomplete + GPS auto-detect button
10. **Discovery Settings** — show me selector, age range dual slider, distance slider
11. **Verification** — status badge + verify button (links to verification page)
12. **Privacy (Visibility Controls)** — toggle switches for show age, distance, orientation
13. **Account Actions** — nav links (blocked users, bank account, earnings) + logout + delete account

### Database Fields Used
- Basic: full_name, username, bio, gender, orientation, pronouns, relationship_goal
- Photos: images text[], image_url text
- Interests: interests text[]
- Lifestyle: lifestyle jsonb {drinking, smoking, workout, pets, diet}
- Work: job_title, company, education, occupation
- Location: location text, latitude float, longitude float
- Discovery: show_me text, age_min int, age_max int, max_distance int
- Privacy: show_age bool, show_distance bool, show_orientation bool

### UI Design
- Background: gradient from light pink to white
- Cards: white rounded-2xl with subtle shadow and border
- Active selections: gradient from #FD267A to #FF6036
- Inputs: gray-50 background, rounded-xl, focus border #FD267A
- Toggle switches: custom gradient toggle (not native)
- Toast notifications: fixed top-center with success/error/loading states
- Modals: backdrop blur with rounded-3xl white cards

### Navigation From Profile
- `verification` — id verification page
- `blockedUsers` — manage blocked users
- `bankAccount` — manage bank details
- `earnings` — view earnings & request withdrawals

---

## 11. Secret Gallery

### Owner Mode (SecretGallery)
- Upload paid photos/videos with custom pricing (₹49–₹999)
- 2-column grid of uploaded content
- Delete individual items

### Viewer Mode (SecretGalleryView)
- Blurred thumbnails for unpurchased content
- Unlock button with price
- Clear view after purchase

---

## 12. Exclusive Room

### Owner Mode (ExclusiveRoom)
- Set subscription price (₹99 minimum)
- Upload exclusive content (images/videos)
- View subscriber list and count

### Viewer Mode (ExclusiveRoomView)
- Subscribe to access content
- 30-day subscription period
- Access all room content after subscribing

---

## 13. Earnings & Withdrawals

### Earnings Page
- Total balance display
- Earnings breakdown by type (purchases, subscriptions)
- Request withdrawal button
- Pending withdrawal requests list

### Bank Account Page
- Account name, number, IFSC, bank name
- Optional UPI ID
- Stored in `bank_info` jsonb column

---

## 14. Admin Dashboard

### Access
- Only users with `role = 'admin'` in profiles table
- Redirected automatically on login/session restore

### 5 Tabs
1. **Users** — search/filter all users, manage individual users
2. **Verifications** — pending id verification approvals
3. **Withdrawals** — approve/hold/reject payout requests
4. **Reports** — review user reports
5. **Config** — set Pro plan price and duration globally

### User Management Actions
- Grant/revoke Pro membership
- Add/remove verified badge
- Block/unblock accounts
- Delete accounts permanently

---

## 15. Navigation & UI

### Header (visible on main tabs)
- Left: logout button (gray icon)
- Center: MalluCupid logo (gradient red-orange "M" badge + brand text)
- Right: empty spacer

### Bottom Navigation (5 tabs)
| Tab | View | Icon | Active Color |
|-----|------|------|-------------|
| Discover | discover | Heart | #FF4458 |
| Matches | friends | People group | #FF4458 |
| Chat | inbox | Message bubble | #FF4458 |
| Alerts | notifications | Bell | #FF4458 |
| Profile | profile | User avatar/photo | #FF4458 |

- Active tab: filled icon + colored text (#FF4458)
- Inactive tab: outlined icon + gray text
- Profile tab shows user's actual photo if available

### Desktop Blocker
- If screen width > 1024px, shows DesktopBlocker component
- App is mobile-only by design

### Loading States
- Full-screen spinner with "Mallu Cupid" text during initial load
- 600ms transition spinner on view navigation (via `navigateToView`)
- Button spinners on all async operations

### Color Palette
- Primary accent: #FF4458 (Tinder red, nav active)
- Background: #fffafa (off-white)
- Header/button gradient: #FF4458 → #FF7854
- Success/connect: #006400 (dark green)
- Reject/block: #8B0000 (dark red)
- Pro badge: #FFD700 (gold)
- Chat own message: red background
- Chat other message: white background

---

## 16. File Reference

### Auth Functions (lib/auth.ts)
| Function | Purpose |
|----------|---------|
| `signUpWithEmail(email, password)` | Create auth user |
| `verifyOtp(email, token)` | Verify signup OTP |
| `resendSignupOtp(email)` | Resend signup OTP |
| `createUserProfile(authUserId, data)` | Insert profile to database |
| `checkUsernameAvailable(username)` | Check username uniqueness |
| `loginWithEmail(email, password)` | Sign in with email/password |
| `getCurrentSession()` | Get active session |
| `signOut()` | Sign out user |
| `sendPasswordResetOtp(email)` | Send password reset OTP |
| `verifyPasswordResetOtp(email, token)` | Verify reset OTP |
| `updatePassword(newPassword)` | Update password |
| `fetchUserProfile(userId)` | Get single profile |
| `fetchAllProfiles()` | Get all profiles |
| `updateUserProfile(userId, updates)` | Update profile fields |
| `uploadProfileImage(userId, file)` | Upload image to storage |

### Location Functions (lib/location.ts)
| Function | Purpose |
|----------|---------|
| `reverseGeocode(lat, lon)` | Coordinates to city/country |
| `searchPlaces(query)` | Search locations via Nominatim |
| `getCurrentPosition()` | Get GPS coordinates |
| `fetchCountries()` | Get 197 countries list |

### Type Definitions (types.ts)
| Type | Purpose |
|------|---------|
| `Profile` | User profile (25+ fields) |
| `View` | 21 navigation states |
| `ConnectionRequest` | Friend request |
| `Message` | Chat message |
| `Notification` | Alert/notification |
| `PurchaseRecord` | Content purchase |
| `SubscriptionRecord` | Room subscription |
| `Earning` | Revenue record |
| `WithdrawalRequest` | Payout request |
| `UserReport` | User report |
| `ProConfig` | Admin Pro settings |
| `SecretContent` | Paid content item |
| `Gender`, `LookingFor`, `Orientation`, `RelationshipGoal` | Enum types |

---

*This document is the single source of truth for MalluCupid app behavior. Update after every task.*
