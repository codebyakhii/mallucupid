import { supabase } from './supabase';
import type { Profile } from '../types';

// ─── SIGNUP ────────────────────────────────────────────────────
// Step 1: Create auth user with Supabase Auth
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

// Step 2: After OTP verification, save full profile to `profiles` table
export async function createUserProfile(authUserId: string, profileData: {
  full_name: string;
  username: string;
  email: string;
  dob: string;
  age: number;
  location: string;
  bio: string;
  gender: string;
  looking_for: string;
  orientation: string;
  relationship_goal: string;
  images: string[];
}) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: authUserId,
      full_name: profileData.full_name,
      username: profileData.username,
      email: profileData.email,
      dob: profileData.dob,
      age: profileData.age,
      location: profileData.location,
      bio: profileData.bio,
      gender: profileData.gender,
      looking_for: profileData.looking_for,
      orientation: profileData.orientation,
      relationship_goal: profileData.relationship_goal,
      images: profileData.images,
      image_url: profileData.images[0] || '',
      role: 'user',
      status: 'active',
      verified: false,
      balance: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─── EMAIL VERIFICATION (OTP) ──────────────────────────────────
export async function verifyOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function resendSignupOtp(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });
  if (error) throw new Error(error.message);
}

// ─── LOGIN ─────────────────────────────────────────────────────
export async function loginWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ─── FETCH PROFILE ─────────────────────────────────────────────
export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;

  return mapDbToProfile(data);
}

// Fetch all active profiles (for discover page, admin, etc.)
export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []).map(mapDbToProfile);
}

// Map DB row to frontend Profile type
function mapDbToProfile(row: any): Profile {
  return {
    id: row.id,
    name: row.full_name,
    username: row.username,
    email: row.email,
    age: row.age,
    dob: row.dob,
    location: row.location,
    bio: row.bio,
    interests: row.interests || [],
    imageUrl: row.image_url || '',
    images: row.images || [],
    occupation: row.occupation || '',
    gender: row.gender as Profile['gender'],
    verified: row.verified || false,
    relationshipGoal: row.relationship_goal as Profile['relationshipGoal'],
    lookingFor: row.looking_for as Profile['lookingFor'],
    orientation: row.orientation as Profile['orientation'],
    role: row.role || 'user',
    status: row.status || 'active',
    balance: row.balance || 0,
    proExpiry: row.pro_expiry ? new Date(row.pro_expiry).getTime() : undefined,
    bankInfo: row.bank_info || undefined,
    verificationDocs: row.verification_docs || undefined,
  };
}

// ─── FORGOT PASSWORD ───────────────────────────────────────────
export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw new Error(error.message);
}

// ─── SESSION ───────────────────────────────────────────────────
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// ─── PROFILE UPDATES ──────────────────────────────────────────
export async function updateUserProfile(userId: string, updates: Partial<Record<string, any>>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapDbToProfile(data);
}

// ─── IMAGE UPLOAD TO SUPABASE STORAGE ──────────────────────────
export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data: { publicUrl } } = supabase.storage
    .from('profile-images')
    .getPublicUrl(fileName);

  return publicUrl;
}
