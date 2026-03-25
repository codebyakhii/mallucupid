-- =====================================================
-- EDIT PROFILE MIGRATION
-- Adds new columns for the full edit profile page
-- Run in Supabase SQL Editor
-- =====================================================

-- Add new columns to profiles table
alter table public.profiles add column if not exists pronouns text default '';
alter table public.profiles add column if not exists lifestyle jsonb default '{}';
alter table public.profiles add column if not exists job_title text default '';
alter table public.profiles add column if not exists company text default '';
alter table public.profiles add column if not exists education text default '';
alter table public.profiles add column if not exists latitude double precision default null;
alter table public.profiles add column if not exists longitude double precision default null;
alter table public.profiles add column if not exists show_me text default 'Everyone';
alter table public.profiles add column if not exists age_min integer default 18;
alter table public.profiles add column if not exists age_max integer default 50;
alter table public.profiles add column if not exists max_distance integer default 50;
alter table public.profiles add column if not exists show_age boolean default true;
alter table public.profiles add column if not exists show_distance boolean default true;
alter table public.profiles add column if not exists show_orientation boolean default true;
