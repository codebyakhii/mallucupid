
import React, { useState } from 'react';
import { Profile } from '../types';

interface UserDetailsProps {
  profile: Profile;
  onBack: () => void;
  onUnfriend: (id: string) => void;
  onBlock: (id: string) => void;
  onReport: (id: string, reason: string) => void;
  onOpenSecretGallery: () => void;
  onOpenExclusiveRoom: () => void;
  onChat: () => void;
  onConnect: (id: string) => void;
  isLinked: boolean;
  isPending: boolean;
  isPro: boolean;
  onGetPro: () => void;
}

const UserDetails: React.FC<UserDetailsProps> = ({ 
  profile, onBack, onUnfriend, onBlock, onReport, onOpenSecretGallery, onOpenExclusiveRoom, onChat, onConnect, isLinked, isPending, isPro, onGetPro 
}) => {
  const [imgIdx, setImgIdx] = useState(0);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showProDialog, setShowProDialog] = useState(false);

  const handleChatClick = () => {
    if (!isLinked) {
      setShowConnectDialog(true);
      return;
    }
    if (!isPro) {
      setShowProDialog(true);
      return;
    }
    onChat();
  };

  const toTitleCase = (str: string) => str.toLowerCase().replace(/(^|\s)\S/g, L => L.toUpperCase());

  return (
    <div className="h-full flex flex-col bg-[#fdf8f5] overflow-y-auto pb-40">
      <div className="relative h-[65vh] w-full bg-gray-200">
        <img src={profile.images[imgIdx]} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        <button onClick={onBack} className="absolute top-6 left-6 w-12 h-12 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white z-10"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
        
        <div className="absolute bottom-10 left-8 right-8 text-white">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-[10px] font-black tracking-widest uppercase text-white/90">@{profile.username}, {profile.age}</h1>
            {profile.verified && (
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-[9px] font-bold text-white/60 tracking-tight">
            <span>{toTitleCase(profile.location)}</span>
            <span>{profile.gender}</span>
            <span>{toTitleCase(profile.occupation)}</span>
          </div>
        </div>

        {profile.images.length > 1 && (
          <div className="absolute bottom-32 right-8 flex gap-2">
            <button onClick={() => setImgIdx(prev => (prev - 1 + profile.images.length) % profile.images.length)} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl">←</button>
            <button onClick={() => setImgIdx(prev => (prev + 1) % profile.images.length)} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl">→</button>
          </div>
        )}
      </div>

      <div className="p-8 space-y-8">
        <div className="flex gap-4">
          <button 
            onClick={handleChatClick}
            className={`flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-transform ${isLinked ? 'bg-red-500' : 'bg-gray-400'}`}
          >
            {isPro ? 'Chat Now' : 'Chat (Pro Only)'}
          </button>
          <button onClick={onOpenSecretGallery} className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-transform">Secret Gallery</button>
        </div>

        <button onClick={onOpenExclusiveRoom} className="w-full py-5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-[0.98] transition-all">Exclusive Room</button>

        <div>
          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 px-1">Biography</h3>
          <p className="text-sm font-medium text-gray-700 leading-relaxed italic px-1">"{profile.bio}"</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm"><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Goal</p><p className="text-xs font-bold text-gray-800">{profile.relationshipGoal}</p></div>
          <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm"><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Looking For</p><p className="text-xs font-bold text-gray-800">{profile.lookingFor}</p></div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-8 border-t border-orange-100">
          <button onClick={() => onUnfriend(profile.id)} disabled={!isLinked} className={`py-4 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm transition-all ${isLinked ? 'bg-[#006400] text-white active:scale-95' : 'bg-gray-100 text-gray-300'}`}>Unfriend</button>
          <button onClick={() => onBlock(profile.id)} className="py-4 bg-[#FFD700] text-black rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm active:scale-95 transition-transform">Block</button>
          <button onClick={() => onReport(profile.id, "Report")} className="py-4 bg-[#FF0000] text-white rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm active:scale-95 transition-transform">Report</button>
        </div>
      </div>

      {showConnectDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowConnectDialog(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Connect First</h3>
            <p className="text-sm font-medium text-gray-500 mb-8 px-4">You must be friends with <span className="font-black">@{profile.username}</span> to chat.</p>
            <button 
              onClick={() => { onConnect(profile.id); setShowConnectDialog(false); }}
              disabled={isPending}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all ${isPending ? 'bg-gray-100 text-gray-400' : 'bg-[#006400] text-white active:scale-95'}`}
            >
              {isPending ? 'Request Pending' : 'Send Connection Request'}
            </button>
          </div>
        </div>
      )}

      {showProDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowProDialog(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-600">
               <span className="text-3xl">👑</span>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-gray-800">Pro Feature</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">Private chatting is exclusive to <span className="text-gray-800">Pro Members</span>.</p>
            <div className="space-y-3">
              <button 
                onClick={() => { onGetPro(); setShowProDialog(false); }}
                className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
              >
                Get Pro • ₹99 / Month
              </button>
              <button onClick={() => setShowProDialog(false)} className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px]">Maybe Later</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetails;
