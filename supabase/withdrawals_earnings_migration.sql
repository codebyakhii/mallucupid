-- =====================================================
-- WITHDRAWALS & EARNINGS MIGRATION
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. WITHDRAWALS TABLE
create table if not exists public.withdrawals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null check (amount >= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'held')),
  admin_notes text default null,
  processed_at timestamptz default null,
  created_at timestamptz default now()
);

alter table public.withdrawals enable row level security;

-- Users can view their own withdrawals
create policy "Users can view own withdrawals"
  on public.withdrawals for select
  using (auth.uid() = user_id or public.is_admin());

-- Users can insert their own withdrawal requests
create policy "Users can insert own withdrawals"
  on public.withdrawals for insert
  with check (auth.uid() = user_id);

-- Only admins can update withdrawals (approve/reject/hold)
create policy "Admins can update withdrawals"
  on public.withdrawals for update
  using (public.is_admin());

-- 2. EARNINGS TABLE
create table if not exists public.earnings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  from_user_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('gallery_purchase', 'tip', 'other')),
  amount numeric(10,2) not null check (amount > 0),
  description text default '',
  related_id uuid default null,
  created_at timestamptz default now()
);

alter table public.earnings enable row level security;

-- Users can view their own earnings
create policy "Users can view own earnings"
  on public.earnings for select
  using (auth.uid() = user_id or public.is_admin());

-- System can insert earnings (via service role or triggers)
create policy "Authenticated users can insert earnings"
  on public.earnings for insert
  with check (true);

-- 3. Add payout_info column to profiles if bank_info doesn't have all fields
-- bank_info jsonb already exists in profiles, we'll use that as-is
