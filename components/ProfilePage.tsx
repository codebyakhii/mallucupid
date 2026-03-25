
import React, { useState, useRef } from 'react';
import { Profile } from '../types';
import { searchPlaces } from '../lib/location';
import { uploadProfileImage, updateUserProfile } from '../lib/auth';

interface ProfilePageProps {
  userProfile: Profile;
  onUpdate: (profile: Profile) => void;
  onNavigate: (view: any) => void;
  isPro: boolean;
  onGetPro: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userProfile, onUpdate, onNavigate, isPro, onGetPro }) => {
  const [profile, setProfile] = useState({ ...userProfile, images: (userProfile.images && userProfile.images.length > 0) ? userProfile.images : (userProfile.imageUrl ? [userProfile.imageUrl] : []) });
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [uploadState, setUploadState] = useState<{ status: 'idle' | 'uploading' | 'success' | 'error'; message: string; }>({ status: 'idle', message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [showMenuIndex, setShowMenuIndex] = useState<number | null>(null);
  const [locationResults, setLocationResults] = useState<Array<{ display: string; city: string; state: string; country: string }>>([]);
  const [showLocResults, setShowLocResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const triggerFileSelect = () => {
    if (profile.images.length >= 10) {
      setUploadState({ status: 'error', message: 'Maximum 10 photos allowed' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadState({ status: 'error', message: 'Invalid file type. Use jpg, png, or webp' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadState({ status: 'error', message: 'File too large. Maximum 10mb' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
      return;
    }

    try {
      setUploadState({ status: 'uploading', message: 'Uploading photo...' });
      const imageUrl = await uploadProfileImage(userProfile.id, file);
      const updatedImages = [...profile.images, imageUrl];
      const updatedProfile = await updateUserProfile(userProfile.id, {
        images: updatedImages,
        image_url: updatedImages[0] || '',
      });
      setProfile(prev => ({ ...prev, images: updatedImages, imageUrl: updatedImages[0] || '' }));
      setCurrentImgIndex(updatedImages.length - 1);
      onUpdate({ ...profile, images: updatedImages, imageUrl: updatedImages[0] || '' });
      setUploadState({ status: 'success', message: 'Photo uploaded' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 1500);
    } catch (error: any) {
      setUploadState({ status: 'error', message: error.message || 'Upload failed' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
    }
  };

  const handleDeletePhoto = async () => {
    if (deleteIndex === null) return;
    if (profile.images.length <= 1) {
      setShowDeleteModal(false);
      setDeleteIndex(null);
      setUploadState({ status: 'error', message: 'You must have at least 1 photo' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
      return;
    }

    try {
      setUploadState({ status: 'uploading', message: 'Deleting photo...' });
      setShowDeleteModal(false);
      const updatedImages = profile.images.filter((_, i) => i !== deleteIndex);
      await updateUserProfile(userProfile.id, {
        images: updatedImages,
        image_url: updatedImages[0] || '',
      });
      setProfile(prev => ({ ...prev, images: updatedImages, imageUrl: updatedImages[0] || '' }));
      setCurrentImgIndex(Math.min(currentImgIndex, updatedImages.length - 1));
      onUpdate({ ...profile, images: updatedImages, imageUrl: updatedImages[0] || '' });
      setUploadState({ status: 'success', message: 'Photo deleted' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 1500);
    } catch (error: any) {
      setUploadState({ status: 'error', message: error.message || 'Delete failed' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
    }
    setDeleteIndex(null);
  };

  const handleReorderPhoto = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= profile.images.length) return;
    try {
      setUploadState({ status: 'uploading', message: 'Reordering...' });
      setShowMenuIndex(null);
      const updatedImages = [...profile.images];
      const [moved] = updatedImages.splice(fromIndex, 1);
      updatedImages.splice(toIndex, 0, moved);
      await updateUserProfile(userProfile.id, {
        images: updatedImages,
        image_url: updatedImages[0] || '',
      });
      setProfile(prev => ({ ...prev, images: updatedImages, imageUrl: updatedImages[0] || '' }));
      setCurrentImgIndex(toIndex);
      onUpdate({ ...profile, images: updatedImages, imageUrl: updatedImages[0] || '' });
      setUploadState({ status: 'success', message: 'Photo reordered' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 1200);
    } catch (error: any) {
      setUploadState({ status: 'error', message: error.message || 'Reorder failed' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
    }
  };

  const handleSaveProfile = async () => {
    setShowConfirmModal(false);
    setIsSaving(true);
    try {
      const updatedProfile = await updateUserProfile(userProfile.id, {
        username: profile.username,
        location: profile.location,
        bio: profile.bio,
      });
      onUpdate({ ...profile, ...updatedProfile });
      setUploadState({ status: 'success', message: 'Profile saved' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 1500);
    } catch (error: any) {
      setUploadState({ status: 'error', message: error.message || 'Save failed' });
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 2500);
    }
    setIsSaving(false);
  };

  const prevImage = () => { if (currentImgIndex > 0) setCurrentImgIndex(currentImgIndex - 1); };
  const nextImage = () => { if (currentImgIndex < profile.images.length - 1) setCurrentImgIndex(currentImgIndex + 1); };

  return (
    <div className="h-full overflow-y-auto bg-[#fdf8f5] pb-40" onClick={() => { if (showMenuIndex !== null) setShowMenuIndex(null); }}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />

      {/* Photo viewer */}
      <div className="relative h-[55vh] w-full bg-gray-200">
        {profile.images.length > 0 ? (
          <img src={profile.images[currentImgIndex]} className="w-full h-full object-cover" alt="Profile" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm font-medium">No photos yet</p>
          </div>
        )}

        {/* Image pagination dots */}
        {profile.images.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4 z-20">
            {profile.images.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full" style={{ background: i === currentImgIndex ? '#fff' : 'rgba(255,255,255,0.35)', maxWidth: '60px' }} />
            ))}
          </div>
        )}

        {/* Left arrow */}
        {currentImgIndex > 0 && (
          <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition-transform z-10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}

        {/* Right arrow */}
        {currentImgIndex < profile.images.length - 1 && (
          <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition-transform z-10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        {/* Pro badge */}
        {isPro && (
          <div className="absolute top-6 right-4 bg-yellow-400 text-black px-3 py-1.5 rounded-full font-bold text-[10px] uppercase shadow-lg border-2 border-white flex items-center gap-1.5 z-20">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
            Pro member
          </div>
        )}

        {/* Three-dot menu */}
        {profile.images.length > 0 && (
          <div className="absolute top-6 left-4 z-30">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenuIndex(showMenuIndex === currentImgIndex ? null : currentImgIndex); }}
              className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>

            {/* Dropdown menu */}
            {showMenuIndex === currentImgIndex && (
              <div className="absolute top-11 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[180px] z-40" onClick={(e) => e.stopPropagation()}>
                {currentImgIndex > 0 && (
                  <button onClick={() => handleReorderPhoto(currentImgIndex, 0)} className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                    Set as first photo
                  </button>
                )}
                {currentImgIndex > 0 && (
                  <button onClick={() => handleReorderPhoto(currentImgIndex, currentImgIndex - 1)} className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    Move left
                  </button>
                )}
                {currentImgIndex < profile.images.length - 1 && (
                  <button onClick={() => handleReorderPhoto(currentImgIndex, currentImgIndex + 1)} className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    Move right
                  </button>
                )}
                <button
                  onClick={() => { setDeleteIndex(currentImgIndex); setShowDeleteModal(true); setShowMenuIndex(null); }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  Delete photo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom bar: counter + upload */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-10">
          <div className="bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-[10px] font-bold">
            {profile.images.length > 0 ? `${currentImgIndex + 1} / ${profile.images.length}` : '0'} photos
          </div>
          <button
            onClick={triggerFileSelect}
            disabled={uploadState.status === 'uploading'}
            className="w-12 h-12 bg-[#FF4458] text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        {/* Upload/status overlay */}
        {uploadState.status !== 'idle' && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl">
              {uploadState.status === 'uploading' && (
                <div className="w-5 h-5 border-2 border-[#FF4458] border-t-transparent rounded-full animate-spin" />
              )}
              {uploadState.status === 'success' && (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              )}
              {uploadState.status === 'error' && (
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              )}
              <span className={`text-sm font-semibold ${uploadState.status === 'error' ? 'text-red-600' : uploadState.status === 'success' ? 'text-green-600' : 'text-gray-700'}`}>
                {uploadState.message}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Photo thumbnails grid */}
      {profile.images.length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {profile.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentImgIndex(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === currentImgIndex ? 'border-[#FF4458] shadow-md' : 'border-transparent opacity-60'}`}
              >
                <img src={img} className="w-full h-full object-cover" alt="" draggable={false} />
              </button>
            ))}
            {profile.images.length < 10 && (
              <button
                onClick={triggerFileSelect}
                className="flex-shrink-0 w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('secretGallery')}
            className="py-4 bg-purple-600 text-white rounded-2xl font-bold text-xs shadow-lg active:scale-95 transition-all"
          >
            Secret gallery
          </button>
          <button
            onClick={() => onNavigate('exclusiveRoom')}
            className="py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-2xl font-bold text-xs shadow-lg active:scale-95 transition-all"
          >
            Exclusive room
          </button>
        </div>

        {!isPro && (
          <button
            onClick={onGetPro}
            className="w-full py-4 bg-black text-white rounded-2xl flex items-center justify-center gap-2 font-bold text-xs shadow-xl"
          >
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
            Upgrade to pro
          </button>
        )}

        {/* Profile fields */}
        <div className="space-y-5 pt-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Username</label>
            <input type="text" name="username" value={profile.username} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-3.5 px-4 font-medium text-sm outline-none focus:border-[#FF4458] transition-colors" />
          </div>

          <div className="relative">
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Location</label>
            <input
              type="text"
              value={profile.location}
              onChange={async (e) => {
                setProfile({...profile, location: e.target.value});
                if (e.target.value.length >= 2) {
                  const results = await searchPlaces(e.target.value);
                  setLocationResults(results);
                  setShowLocResults(true);
                } else { setShowLocResults(false); }
              }}
              className="w-full bg-white border border-gray-200 rounded-xl py-3.5 px-4 font-medium text-sm outline-none focus:border-[#FF4458] transition-colors"
              placeholder="Search your city..."
            />
            {showLocResults && locationResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl z-50 shadow-xl max-h-48 overflow-y-auto">
                {locationResults.map((loc, i) => (
                  <button key={i} type="button" onClick={() => { setProfile({...profile, location: loc.display}); setShowLocResults(false); }}
                    className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    {loc.display}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Biography</label>
            <textarea name="bio" value={profile.bio} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-3.5 px-4 font-medium text-sm h-28 resize-none outline-none focus:border-[#FF4458] transition-colors" />
          </div>
        </div>

        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={isSaving}
          className="w-full py-4 bg-[#FF4458] text-white rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all mt-6 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
          ) : (
            'Save changes'
          )}
        </button>
      </div>

      {/* Save confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
          <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Save changes?</h3>
            <p className="text-sm text-gray-500 mb-6">Your profile updates will be visible to other users.</p>
            <div className="space-y-2.5">
              <button onClick={handleSaveProfile} className="w-full py-3.5 bg-[#FF4458] text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform">Confirm save</button>
              <button onClick={() => setShowConfirmModal(false)} className="w-full py-3.5 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowDeleteModal(false); setDeleteIndex(null); }} />
          <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete photo?</h3>
            <p className="text-sm text-gray-500 mb-6">This photo will be permanently removed from your profile.</p>
            <div className="space-y-2.5">
              <button onClick={handleDeletePhoto} className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform">Delete</button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteIndex(null); }} className="w-full py-3.5 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
