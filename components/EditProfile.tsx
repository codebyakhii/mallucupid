import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Profile, Lifestyle, View } from '../types';
import { uploadProfileImage, updateUserProfile, deleteProfileImage, signOut } from '../lib/auth';
import { searchPlaces, getCurrentPosition, reverseGeocode } from '../lib/location';

interface EditProfileProps {
  userProfile: Profile;
  onUpdate: (profile: Profile) => void;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

// ─── CONSTANTS ──────────────────────────────────────────────────

const INTEREST_OPTIONS = [
  'Travel', 'Music', 'Cooking', 'Fitness', 'Art', 'Photography',
  'Dancing', 'Gaming', 'Movies', 'Reading', 'Yoga', 'Hiking',
  'Camping', 'Swimming', 'Cycling', 'Running', 'Meditation',
  'Fashion', 'Technology', 'Foodie', 'Netflix', 'Coffee',
  'Dogs', 'Cats', 'Nature', 'Beach', 'Mountains', 'Comedy',
  'Anime', 'Sports', 'Cricket', 'Football', 'Volunteering',
  'Astrology', 'Poetry', 'Gardening', 'Singing', 'Writing',
];

const LIFESTYLE_OPTIONS: Record<keyof Lifestyle, string[]> = {
  drinking: ['Never', 'Socially', 'Frequently', 'Sober'],
  smoking: ['Never', 'Socially', 'Regularly', 'Trying to quit'],
  workout: ['Never', 'Sometimes', 'Often', 'Daily'],
  pets: ['Dog', 'Cat', 'Fish', 'Bird', 'Reptile', 'None', 'All of them'],
  diet: ['Vegetarian', 'Vegan', 'Non-vegetarian', 'Pescatarian', 'Anything'],
};

const GENDER_OPTIONS = ['Men', 'Women', 'Transman', 'Transwoman', 'Other'];
const ORIENTATION_OPTIONS = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Queer', 'Pansexual'];
const PRONOUN_OPTIONS = ['He/Him', 'She/Her', 'They/Them', 'He/They', 'She/They', 'Other'];
const GOAL_OPTIONS = ['Longterm Partner', 'Short term', 'FWB', 'Any', 'New Friends'];
const SHOW_ME_OPTIONS = ['Men', 'Women', 'Everyone'];

// ─── TOAST ──────────────────────────────────────────────────────

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'loading'; visible: boolean }> = ({ message, type, visible }) => {
  if (!visible) return null;
  const bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-gray-800';
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] animate-[fadeIn_0.2s_ease-out]">
      <div className={`${bg} text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-medium`}>
        {type === 'loading' && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {type === 'success' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        {type === 'error' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>}
        {message}
      </div>
    </div>
  );
};

// ─── SECTION CARD ───────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className || ''}`}>
    <div className="px-5 pt-5 pb-2">
      <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
    </div>
    <div className="px-5 pb-5">
      {children}
    </div>
  </div>
);

// ─── MAIN COMPONENT ─────────────────────────────────────────────

const EditProfile: React.FC<EditProfileProps> = ({ userProfile, onUpdate, onNavigate, onLogout }) => {
  // ── State ──
  const [profile, setProfile] = useState<Profile>(() => ({
    ...userProfile,
    images: (userProfile.images?.length > 0) ? userProfile.images : (userProfile.imageUrl ? [userProfile.imageUrl] : []),
    lifestyle: userProfile.lifestyle || { drinking: '', smoking: '', workout: '', pets: '', diet: '' },
  }));
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading'; visible: boolean }>({ message: '', type: 'success', visible: false });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePhotoIndex, setDeletePhotoIndex] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [locationResults, setLocationResults] = useState<Array<{ display: string; city: string; state: string; country: string }>>([]);
  const [showLocResults, setShowLocResults] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'loading') => {
    setToast({ message, type, visible: true });
    if (type !== 'loading') {
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2200);
    }
  }, []);

  const hideToast = useCallback(() => setToast(prev => ({ ...prev, visible: false })), []);

  // ── Update helpers ──
  const updateField = (field: string, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };
  const updateLifestyle = (key: keyof Lifestyle, value: string) => {
    setProfile(prev => ({ ...prev, lifestyle: { ...prev.lifestyle, [key]: value } }));
  };
  const toggleInterest = (interest: string) => {
    setProfile(prev => {
      const has = prev.interests.includes(interest);
      if (has) return { ...prev, interests: prev.interests.filter(i => i !== interest) };
      if (prev.interests.length >= 15) return prev;
      return { ...prev, interests: [...prev.interests, interest] };
    });
  };

  // ── Photo handlers ──
  const triggerUpload = () => {
    if (profile.images.length >= 9) {
      showToast('Maximum 9 photos allowed', 'error');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Use jpg, png, or webp format', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large (max 10mb)', 'error');
      return;
    }

    try {
      showToast('Uploading photo...', 'loading');
      const url = await uploadProfileImage(userProfile.id, file);
      const updatedImages = [...profile.images, url];
      await updateUserProfile(userProfile.id, { images: updatedImages, image_url: updatedImages[0] || '' });
      setProfile(prev => ({ ...prev, images: updatedImages, imageUrl: updatedImages[0] || '' }));
      setCurrentPhotoIndex(updatedImages.length - 1);
      onUpdate({ ...profile, images: updatedImages, imageUrl: updatedImages[0] || '' });
      showToast('Photo uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    }
  };

  const handleDeletePhoto = async () => {
    if (deletePhotoIndex === null) return;
    if (profile.images.length <= 1) {
      setShowDeleteModal(false);
      setDeletePhotoIndex(null);
      showToast('You need at least 1 photo', 'error');
      return;
    }

    try {
      setShowDeleteModal(false);
      showToast('Deleting photo...', 'loading');
      try { await deleteProfileImage(profile.images[deletePhotoIndex]); } catch {}
      const updatedImages = profile.images.filter((_, i) => i !== deletePhotoIndex);
      await updateUserProfile(userProfile.id, { images: updatedImages, image_url: updatedImages[0] || '' });
      setProfile(prev => ({ ...prev, images: updatedImages, imageUrl: updatedImages[0] || '' }));
      setCurrentPhotoIndex(Math.min(currentPhotoIndex, updatedImages.length - 1));
      onUpdate({ ...profile, images: updatedImages, imageUrl: updatedImages[0] || '' });
      showToast('Photo deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
    setDeletePhotoIndex(null);
  };

  const handleReorderPhoto = async (from: number, to: number) => {
    if (to < 0 || to >= profile.images.length) return;
    try {
      setShowPhotoMenu(false);
      showToast('Reordering...', 'loading');
      const updated = [...profile.images];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      await updateUserProfile(userProfile.id, { images: updated, image_url: updated[0] || '' });
      setProfile(prev => ({ ...prev, images: updated, imageUrl: updated[0] || '' }));
      setCurrentPhotoIndex(to);
      onUpdate({ ...profile, images: updated, imageUrl: updated[0] || '' });
      showToast('Photo reordered', 'success');
    } catch (err: any) {
      showToast(err.message || 'Reorder failed', 'error');
    }
  };

  // ── Location ──
  const handleLocationSearch = async (query: string) => {
    updateField('location', query);
    if (query.length >= 2) {
      const results = await searchPlaces(query);
      setLocationResults(results);
      setShowLocResults(true);
    } else {
      setShowLocResults(false);
    }
  };

  const handleDetectLocation = async () => {
    try {
      setIsDetectingLocation(true);
      const pos = await getCurrentPosition();
      const result = await reverseGeocode(pos.lat, pos.lon);
      updateField('location', result.display);
      updateField('latitude', pos.lat);
      updateField('longitude', pos.lon);
      showToast('Location detected', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not detect location', 'error');
    }
    setIsDetectingLocation(false);
  };

  // ── Save all ──
  const handleSave = async () => {
    if (!profile.name.trim()) { showToast('Name is required', 'error'); return; }
    if (!profile.bio.trim() || profile.bio.trim().length < 10) { showToast('Bio must be at least 10 characters', 'error'); return; }
    if (!profile.location.trim()) { showToast('Location is required', 'error'); return; }

    try {
      setIsSaving(true);
      showToast('Saving profile...', 'loading');
      const updated = await updateUserProfile(userProfile.id, {
        full_name: profile.name,
        username: profile.username,
        bio: profile.bio,
        gender: profile.gender,
        orientation: profile.orientation,
        pronouns: profile.pronouns,
        relationship_goal: profile.relationshipGoal,
        interests: profile.interests,
        lifestyle: profile.lifestyle,
        job_title: profile.jobTitle,
        company: profile.company,
        education: profile.education,
        location: profile.location,
        latitude: profile.latitude,
        longitude: profile.longitude,
        show_me: profile.showMe,
        age_min: profile.ageMin,
        age_max: profile.ageMax,
        max_distance: profile.maxDistance,
        show_age: profile.showAge,
        show_distance: profile.showDistance,
        show_orientation: profile.showOrientation,
        occupation: profile.occupation,
      });
      onUpdate({ ...profile, ...updated });
      showToast('Profile saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    }
    setIsSaving(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      onLogout();
    } catch {}
  };

  // ── Render ──
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-[#fff5f5] via-white to-white pb-36" onClick={() => { setShowPhotoMenu(false); setShowLocResults(false); }}>
      <Toast {...toast} />
      <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} />

      {/* ════════ 1. HEADER ════════ */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-5 py-3.5">
          <h1 className="text-[22px] font-bold text-gray-900">Edit profile</h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white rounded-full font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-[420px] mx-auto px-4 pt-4 space-y-4">

        {/* ════════ 2. PHOTO MANAGER ════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Main photo viewer */}
          <div className="relative aspect-[3/4] bg-gray-100">
            {profile.images.length > 0 ? (
              <img src={profile.images[currentPhotoIndex]} className="w-full h-full object-cover" alt="Profile" draggable={false} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.04l-.821 1.316z"/><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                <p className="text-sm font-medium">Add your first photo</p>
              </div>
            )}

            {/* Pagination dots */}
            {profile.images.length > 1 && (
              <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
                {profile.images.map((_, i) => (
                  <div key={i} className="flex-1 h-[3px] rounded-full transition-colors" style={{ background: i === currentPhotoIndex ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                ))}
              </div>
            )}

            {/* Left arrow */}
            {currentPhotoIndex > 0 && (
              <button onClick={() => setCurrentPhotoIndex(i => i - 1)} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/25 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition z-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
            )}

            {/* Right arrow */}
            {currentPhotoIndex < profile.images.length - 1 && (
              <button onClick={() => setCurrentPhotoIndex(i => i + 1)} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/25 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition z-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            )}

            {/* Three-dot menu */}
            {profile.images.length > 0 && (
              <div className="absolute top-8 right-3 z-30">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowPhotoMenu(!showPhotoMenu); }}
                  className="w-9 h-9 bg-black/25 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                {showPhotoMenu && (
                  <div className="absolute top-11 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    {currentPhotoIndex > 0 && (
                      <button onClick={() => handleReorderPhoto(currentPhotoIndex, 0)} className="w-full px-4 py-3 text-left text-[13px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                        Set as main photo
                      </button>
                    )}
                    {currentPhotoIndex > 0 && (
                      <button onClick={() => handleReorderPhoto(currentPhotoIndex, currentPhotoIndex - 1)} className="w-full px-4 py-3 text-left text-[13px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        Move left
                      </button>
                    )}
                    {currentPhotoIndex < profile.images.length - 1 && (
                      <button onClick={() => handleReorderPhoto(currentPhotoIndex, currentPhotoIndex + 1)} className="w-full px-4 py-3 text-left text-[13px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                        Move right
                      </button>
                    )}
                    <button
                      onClick={() => { setDeletePhotoIndex(currentPhotoIndex); setShowDeleteModal(true); setShowPhotoMenu(false); }}
                      className="w-full px-4 py-3 text-left text-[13px] font-semibold text-red-500 hover:bg-red-50 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      Delete photo
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Photo counter + upload button */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end z-10">
              <div className="bg-black/35 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[11px] font-bold">
                {profile.images.length > 0 ? `${currentPhotoIndex + 1} / ${profile.images.length}` : '0'} photos
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); triggerUpload(); }}
                className="w-11 h-11 bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              </button>
            </div>
          </div>

          {/* Thumbnail grid */}
          <div className="p-3">
            <div className="grid grid-cols-5 gap-2">
              {profile.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPhotoIndex(i)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${i === currentPhotoIndex ? 'border-[#FD267A] shadow-md scale-[1.03]' : 'border-transparent opacity-60'}`}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" draggable={false} />
                </button>
              ))}
              {profile.images.length < 9 && (
                <button
                  onClick={(e) => { e.stopPropagation(); triggerUpload(); }}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-[#FD267A] hover:text-[#FD267A] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 text-center">Upload up to 9 photos. First photo is your main profile picture.</p>
          </div>
        </div>

        {/* ════════ 3. BIO ════════ */}
        <Section title="About me">
          <textarea
            value={profile.bio}
            onChange={(e) => { if (e.target.value.length <= 500) updateField('bio', e.target.value); }}
            placeholder="Write something interesting about yourself..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-sm font-medium h-28 resize-none outline-none focus:border-[#FD267A] transition-colors placeholder:text-gray-400"
          />
          <p className="text-[11px] text-gray-400 mt-1.5 text-right">{profile.bio.length} / 500</p>
        </Section>

        {/* ════════ 4. BASIC INFO ════════ */}
        <Section title="Basic info">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Name</label>
              <input type="text" value={profile.name} onChange={(e) => updateField('name', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:border-[#FD267A] transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Username</label>
              <input type="text" value={profile.username} onChange={(e) => updateField('username', e.target.value.toLowerCase())} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:border-[#FD267A] transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Date of birth</label>
                <input type="text" value={profile.dob} readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium text-gray-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Age</label>
                <input type="text" value={profile.age} readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium text-gray-500 cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Gender</label>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map(g => (
                  <button key={g} onClick={() => updateField('gender', g)}
                    className={`px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all ${profile.gender === g ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Sexual orientation</label>
              <div className="flex flex-wrap gap-2">
                {ORIENTATION_OPTIONS.map(o => (
                  <button key={o} onClick={() => updateField('orientation', o)}
                    className={`px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all ${profile.orientation === o ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >{o}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Pronouns</label>
              <div className="flex flex-wrap gap-2">
                {PRONOUN_OPTIONS.map(p => (
                  <button key={p} onClick={() => updateField('pronouns', p)}
                    className={`px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all ${profile.pronouns === p ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >{p}</button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ════════ 5. INTERESTS ════════ */}
        <Section title="Interests">
          <p className="text-[11px] text-gray-400 mb-3">Select up to 15 interests ({profile.interests.length}/15)</p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map(interest => {
              const selected = profile.interests.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all border ${selected ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ════════ 6. LIFESTYLE ════════ */}
        <Section title="Lifestyle">
          <div className="space-y-5">
            {(Object.entries(LIFESTYLE_OPTIONS) as [keyof Lifestyle, string[]][]).map(([key, options]) => (
              <div key={key}>
                <label className="text-[11px] font-semibold text-gray-500 mb-2 block capitalize">
                  {key === 'workout' ? 'Exercise' : key}
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => updateLifestyle(key, profile.lifestyle[key] === opt ? '' : opt)}
                      className={`px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all border ${profile.lifestyle[key] === opt ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ════════ 7. WORK & EDUCATION ════════ */}
        <Section title="Work & education">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Job title</label>
              <input type="text" value={profile.jobTitle} onChange={(e) => updateField('jobTitle', e.target.value)} placeholder="e.g. Software Engineer" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:border-[#FD267A] transition-colors placeholder:text-gray-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Company</label>
              <input type="text" value={profile.company} onChange={(e) => updateField('company', e.target.value)} placeholder="e.g. Google" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:border-[#FD267A] transition-colors placeholder:text-gray-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Education</label>
              <input type="text" value={profile.education} onChange={(e) => updateField('education', e.target.value)} placeholder="e.g. IIT Delhi" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:border-[#FD267A] transition-colors placeholder:text-gray-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Occupation</label>
              <input type="text" value={profile.occupation} onChange={(e) => updateField('occupation', e.target.value)} placeholder="e.g. Designer" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:border-[#FD267A] transition-colors placeholder:text-gray-400" />
            </div>
          </div>
        </Section>

        {/* ════════ 8. RELATIONSHIP GOALS ════════ */}
        <Section title="Relationship goals">
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map(goal => (
              <button
                key={goal}
                onClick={() => updateField('relationshipGoal', goal)}
                className={`px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all ${profile.relationshipGoal === goal ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {goal}
              </button>
            ))}
          </div>
        </Section>

        {/* ════════ 9. LOCATION SETTINGS ════════ */}
        <Section title="Location">
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={profile.location}
                onChange={(e) => handleLocationSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Search your city..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 pr-11 text-sm font-medium outline-none focus:border-[#FD267A] transition-colors placeholder:text-gray-400"
              />
              <svg className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              {showLocResults && locationResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl z-50 shadow-xl max-h-48 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  {locationResults.map((loc, i) => (
                    <button key={i} type="button" onClick={() => { updateField('location', loc.display); setShowLocResults(false); }}
                      className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 border-b border-gray-50 last:border-0 text-gray-700">
                      {loc.display}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              className="w-full py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isDetectingLocation ? (
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-[#FD267A]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
              )}
              {isDetectingLocation ? 'Detecting...' : 'Use current location'}
            </button>
          </div>
        </Section>

        {/* ════════ 10. DISCOVERY SETTINGS ════════ */}
        <Section title="Discovery settings">
          <div className="space-y-6">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-2 block">Show me</label>
              <div className="flex gap-2">
                {SHOW_ME_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => updateField('showMe', opt)}
                    className={`flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-all ${profile.showMe === opt ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Age range slider */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[11px] font-semibold text-gray-500">Age range</label>
                <span className="text-[13px] font-bold text-gray-800">{profile.ageMin} - {profile.ageMax}</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-gray-400 w-8">Min</span>
                  <input
                    type="range"
                    min={18}
                    max={80}
                    value={profile.ageMin}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      updateField('ageMin', Math.min(v, profile.ageMax - 1));
                    }}
                    className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#FD267A]"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-gray-400 w-8">Max</span>
                  <input
                    type="range"
                    min={18}
                    max={80}
                    value={profile.ageMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      updateField('ageMax', Math.max(v, profile.ageMin + 1));
                    }}
                    className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#FD267A]"
                  />
                </div>
              </div>
            </div>

            {/* Distance slider */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[11px] font-semibold text-gray-500">Maximum distance</label>
                <span className="text-[13px] font-bold text-gray-800">{profile.maxDistance} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={160}
                value={profile.maxDistance}
                onChange={(e) => updateField('maxDistance', parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#FD267A]"
              />
            </div>
          </div>
        </Section>

        {/* ════════ 11. VERIFICATION ════════ */}
        <Section title="Verification">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              {profile.verified ? (
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
              ) : (
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-800">{profile.verified ? 'Verified' : 'Not verified'}</p>
                <p className="text-[11px] text-gray-400">{profile.verified ? 'Your identity has been confirmed' : 'Verify to get the blue badge'}</p>
              </div>
            </div>
            {!profile.verified && (
              <button
                onClick={() => onNavigate('verification')}
                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[12px] font-bold active:scale-95 transition-transform"
              >
                Verify
              </button>
            )}
          </div>
        </Section>

        {/* ════════ 12. VISIBILITY CONTROLS ════════ */}
        <Section title="Privacy">
          <div className="space-y-1">
            {[
              { field: 'showAge', label: 'Show my age', desc: 'Display your age on your profile' },
              { field: 'showDistance', label: 'Show my distance', desc: 'Show how far you are from others' },
              { field: 'showOrientation', label: 'Show orientation', desc: 'Display your sexual orientation' },
            ].map(({ field, label, desc }) => (
              <div key={field} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-[11px] text-gray-400">{desc}</p>
                </div>
                <button
                  onClick={() => updateField(field, !(profile as any)[field])}
                  className={`w-12 h-7 rounded-full transition-colors relative ${(profile as any)[field] ? 'bg-gradient-to-r from-[#FD267A] to-[#FF6036]' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${(profile as any)[field] ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* ════════ 13. ACCOUNT ACTIONS ════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => onNavigate('blockedUsers')}
            className="w-full px-5 py-4 text-left flex items-center justify-between border-b border-gray-50 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              <span className="text-sm font-semibold text-gray-700">Blocked users</span>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
          <button
            onClick={() => onNavigate('bankAccount')}
            className="w-full px-5 py-4 text-left flex items-center justify-between border-b border-gray-50 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
              <span className="text-sm font-semibold text-gray-700">Bank account</span>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
          <button
            onClick={() => onNavigate('earnings')}
            className="w-full px-5 py-4 text-left flex items-center justify-between border-b border-gray-100 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span className="text-sm font-semibold text-gray-700">Earnings</span>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        {/* Logout + Delete account */}
        <div className="space-y-3 pb-6">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-4 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 active:scale-[0.98] transition-all"
          >
            Log out
          </button>
          <button
            onClick={() => setShowDeleteAccountModal(true)}
            className="w-full py-4 bg-white border border-red-200 rounded-2xl text-sm font-bold text-red-500 active:scale-[0.98] transition-all"
          >
            Delete account
          </button>
        </div>

      </div>

      {/* ══ DELETE PHOTO MODAL ══ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowDeleteModal(false); setDeletePhotoIndex(null); }} />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete this photo?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="space-y-2.5">
              <button onClick={handleDeletePhoto} className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform">Delete</button>
              <button onClick={() => { setShowDeleteModal(false); setDeletePhotoIndex(null); }} className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOGOUT MODAL ══ */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] shadow-2xl text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Log out?</h3>
            <p className="text-sm text-gray-500 mb-6">You can always log back in anytime.</p>
            <div className="space-y-2.5">
              <button onClick={handleLogout} className="w-full py-3.5 bg-gradient-to-r from-[#FD267A] to-[#FF6036] text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform">Log out</button>
              <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE ACCOUNT MODAL ══ */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteAccountModal(false)} />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete account?</h3>
            <p className="text-sm text-gray-500 mb-6">All your data, photos, and matches will be permanently lost. This cannot be undone.</p>
            <div className="space-y-2.5">
              <button onClick={() => setShowDeleteAccountModal(false)} className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Keep my account</button>
              <button onClick={() => { setShowDeleteAccountModal(false); showToast('Contact support to delete your account', 'error'); }} className="w-full py-3.5 text-red-500 font-bold text-sm">Delete anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfile;
