
import React, { useState, useRef } from 'react';
import { Profile } from '../types';
import { KERALA_LOCATIONS } from '../constants';

interface ProfilePageProps {
  userProfile: Profile;
  onUpdate: (profile: Profile) => void;
  onNavigate: (view: any) => void;
  isPro: boolean;
  onGetPro: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userProfile, onUpdate, onNavigate, isPro, onGetPro }) => {
  const [profile, setProfile] = useState({ ...userProfile, images: userProfile.images || [userProfile.imageUrl] });
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [uploadState, setUploadState] = useState<{
    status: 'idle' | 'uploading' | 'success' | 'error';
    progress: number;
    message: string;
  }>({ status: 'idle', progress: 0, message: '' });
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const triggerFileSelect = () => {
    if (profile.images.length >= 10) {
      setUploadState({ status: 'error', progress: 0, message: 'Max 10 photos' });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadState({ status: 'error', progress: 0, message: 'Invalid file type. Use JPG, PNG, or WEBP' });
      setTimeout(() => setUploadState({ status: 'idle', progress: 0, message: '' }), 2000);
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadState({ status: 'error', progress: 0, message: 'File too large. Max 10MB' });
      setTimeout(() => setUploadState({ status: 'idle', progress: 0, message: '' }), 2000);
      return;
    }

    try {
      setUploadState({ status: 'uploading', progress: 0, message: 'Uploading...' });
      
      // Demo: use local file preview
      const imageUrl = URL.createObjectURL(file);
      // Simulate upload progress
      for (let p = 20; p <= 100; p += 20) {
        await new Promise(r => setTimeout(r, 150));
        setUploadState({ status: 'uploading', progress: p, message: `Uploading... ${p}%` });
      }

      // Add to profile images
      const updatedImages = [...profile.images, imageUrl];
      setProfile(prev => ({ ...prev, images: updatedImages }));
      setUploadState({ status: 'success', progress: 100, message: 'Uploaded!' });
      setTimeout(() => setUploadState({ status: 'idle', progress: 0, message: '' }), 1500);
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadState({ status: 'error', progress: 0, message: error.message || 'Upload failed' });
      setTimeout(() => setUploadState({ status: 'idle', progress: 0, message: '' }), 2000);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#fdf8f5] pb-40">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      <div className="relative h-[55vh] w-full bg-gray-100">
        <img src={profile.images[currentImgIndex]} className="w-full h-full object-cover" alt="Profile" />
        
        {isPro && (
          <div className="absolute top-6 right-6 bg-yellow-400 text-black px-4 py-2 rounded-full font-black text-[10px] uppercase shadow-lg border-2 border-white flex items-center gap-2">
            <span>👑</span> PRO MEMBER
          </div>
        )}

        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white text-[9px] font-black uppercase">
            {currentImgIndex + 1} / {profile.images.length} Photos
          </div>
          <button 
            onClick={triggerFileSelect} 
            className="w-16 h-16 bg-red-500 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        {uploadState.status !== 'idle' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-10 text-center z-50">
             <p className="text-white text-[10px] font-black uppercase tracking-[0.2em]">{uploadState.message}</p>
          </div>
        )}
      </div>

      <div className="p-8 space-y-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button 
            onClick={() => onNavigate('secretGallery')}
            className="py-5 bg-purple-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all"
          >
            🔒 Secret Gallery
          </button>
          <button 
            onClick={() => onNavigate('exclusiveRoom')}
            className="py-5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all"
          >
            👑 Exclusive Room
          </button>
        </div>

        {!isPro && (
          <button 
            onClick={onGetPro}
            className="w-full py-5 bg-black text-white rounded-[2rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] shadow-2xl animate-pulse"
          >
            <span className="text-xl">👑</span> UPGRADE TO PRO • ₹99
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onNavigate('secretGallery')} className="py-4 bg-white border border-orange-100 rounded-2xl flex items-center justify-center gap-2 text-gray-700 font-black uppercase text-[10px]">Gallery</button>
          <button onClick={() => onNavigate('exclusiveRoom')} className="py-4 bg-white border border-orange-100 rounded-2xl flex items-center justify-center gap-2 text-gray-700 font-black uppercase text-[10px]">Room</button>
        </div>

        <div className="space-y-6 pt-6">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Username</label>
            <input type="text" name="username" value={profile.username} onChange={handleChange} className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none" />
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Location</label>
            <select name="location" value={profile.location} onChange={handleChange} className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm">
              {KERALA_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Biography</label>
            <textarea name="bio" value={profile.bio} onChange={handleChange} className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-medium text-sm h-32 resize-none" />
          </div>
        </div>

        <button onClick={() => setShowConfirmModal(true)} className="w-full py-5 bg-[#006400] text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all mt-8">Apply Changes</button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
          <div className="relative bg-white rounded-[2.5rem] p-10 w-full max-sm shadow-2xl text-center">
            <h2 className="text-xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Save Changes?</h2>
            <button onClick={() => { onUpdate(profile); setShowConfirmModal(false); }} className="w-full py-4 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg">Confirm Save</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
