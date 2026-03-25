-- =====================================================
-- MALLUCUPID SUPABASE DATABASE SETUP
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- 1. PROFILES TABLE
-- Stores ALL signup inputs + user data
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  username text unique not null,
  email text unique not null,
  dob date not null,
  age integer not null,
  location text not null,
  bio text not null default '',
  gender text not null default 'Women',
  looking_for text not null default 'All',
  orientation text not null default 'Straight',
  relationship_goal text not null default 'Longterm Partner',
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
  updated_at timestamptz default now()
);

-- 2. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;

-- Users can read all active profiles (for discover)
create policy "Anyone can view active profiles"
  on public.profiles for select
  using (status = 'active' or auth.uid() = id);

-- Users can only insert their own profile
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can view ALL profiles (including blocked)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update ANY profile (for verify, block, pro toggle)
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can delete profiles
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 3. AUTO-UPDATE `updated_at` TRIGGER
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- 4. STORAGE BUCKET FOR PROFILE IMAGES
-- Run this separately or create via Supabase Dashboard > Storage
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
create policy "Users can upload own images"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access to profile images
create policy "Public can view profile images"
  on storage.objects for select
  using (bucket_id = 'profile-images');

-- Allow users to delete their own images
create policy "Users can delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- 5. CREATE ADMIN ACCOUNT (BACKEND ONLY)
-- After creating an admin user via Supabase Auth dashboard
-- or via `supabase.auth.admin.createUser()`, run:
--
--   insert into public.profiles (id, full_name, username, email, dob, age, location, bio, role)
--   values (
--     'THE-AUTH-USER-UUID',
--     'Admin Name',
--     'admin',
--     'admin@mallucupid.com',
--     '1990-01-01',
--     36,
--     'Kochi',
--     'MalluCupid Administrator',
--     'admin'
--   );
--
-- IMPORTANT: The `role` column defaults to 'user'.
-- Only set role='admin' via SQL / backend. Never from frontend.
-- =====================================================
