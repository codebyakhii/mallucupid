
import React, { useState, useMemo } from 'react';
import { Profile } from '../types';

interface DiscoverProps {
  users: Profile[];
  onLike: (profile: Profile) => void;
  onDislike: () => void;
  onShowDetails: (profile: Profile) => void;
  blockedIds: string[];
  currentUser: Profile;
  activeRequests: string[];
}

const Discover: React.FC<DiscoverProps> = ({ users, onLike, onDislike, onShowDetails, blockedIds, currentUser, activeRequests }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const filteredProfiles = useMemo(() => {
    return users.filter(p => {
      if (p.id === currentUser.id) return false;
      if (blockedIds.includes(p.id)) return false;
      if (p.status === 'blocked') return false; // Ensure blocked users don't show
      
      const matchesLookingFor = currentUser.lookingFor === 'All' || currentUser.lookingFor === p.gender + 's' || (p.gender === 'Men' && currentUser.lookingFor === 'Men') || (p.gender === 'Women' && currentUser.lookingFor === 'Women');
      const matchesMe = p.lookingFor === 'All' || p.lookingFor === currentUser.gender + 's' || (currentUser.gender === 'Men' && p.lookingFor === 'Men') || (currentUser.gender === 'Women' && p.lookingFor === 'Women');
      
      return matchesLookingFor && matchesMe;
    });
  }, [users, blockedIds, currentUser, activeRequests]);

  const currentProfile = filteredProfiles[currentIndex];
  const isRequested = currentProfile ? activeRequests.includes(currentProfile.id) : false;

  const toTitleCase = (str: string) => str.toLowerCase().replace(/(^|\s)\S/g, L => L.toUpperCase());

  if (!currentProfile) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center bg-[#fffafa]">
        <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-8 shadow-inner shadow-rose-100/50"><span className="text-5xl">💝</span></div>
        <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-800">New Matches Soon</h2>
        <p className="text-[11px] font-bold text-rose-300 uppercase tracking-[0.2em] mt-3">We're finding your perfect malayali match</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 bg-[#fffafa]">
      <div className="flex-1 relative rounded-[3.5rem] overflow-hidden shadow-[0_20px_50px_rgba(255,182,193,0.3)] bg-gray-100 border-[3px] border-white">
        <img src={currentProfile.imageUrl} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-10">
          <div className="flex justify-between items-end">
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[12px] font-black text-white uppercase tracking-[0.1em]">@{currentProfile.username}, {currentProfile.age}</h2>
                {currentProfile.verified && (
                  <div className="bg-blue-500 rounded-full p-0.5">
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-[11px] font-bold text-white/60 tracking-tight">
                {toTitleCase(currentProfile.location)} • {toTitleCase(currentProfile.occupation)}
              </p>
            </div>
            <button onClick={() => onShowDetails(currentProfile)} className="w-14 h-14 bg-white/15 backdrop-blur-2xl border border-white/30 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6 py-10 px-2">
        <button 
          onClick={() => setCurrentIndex(prev => (prev + 1) % filteredProfiles.length)} 
          className="flex-1 py-5 bg-[#8B0000] text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-red-900/40 active:scale-95 transition-all"
        >
          Reject
        </button>
        <button 
          onClick={() => { if(!isRequested) onLike(currentProfile); }} 
          disabled={isRequested}
          className={`flex-1 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all ${isRequested ? 'bg-[#f0f4f8] text-[#a0aec0] shadow-sm' : 'bg-[#006400] text-white shadow-2xl shadow-green-900/30 active:scale-95'}`}
        >
          {isRequested ? 'Requested' : 'Connect'}
        </button>
      </div>
    </div>
  );
};

export default Discover;
