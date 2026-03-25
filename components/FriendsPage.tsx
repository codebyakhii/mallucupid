
import React, { useState } from 'react';
import { Profile } from '../types';

interface FriendsPageProps {
  linkedProfiles: Profile[];
  onShowDetails: (profile: Profile) => void;
  onBlock: (profileId: string) => void;
}

const FriendsPage: React.FC<FriendsPageProps> = ({ linkedProfiles, onShowDetails, onBlock }) => {
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);

  const toTitleCase = (str: string) => str.toLowerCase().replace(/(^|\s)\S/g, L => L.toUpperCase());

  return (
    <div className="p-6 h-full overflow-y-auto pb-32 bg-[#fdf8f5]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Friends</h2>
        <span className="bg-orange-100 text-orange-600 text-xs font-black px-3 py-1 rounded-full uppercase">
          {linkedProfiles.length} Linked
        </span>
      </div>
      
      {linkedProfiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          </div>
          <p className="font-black uppercase text-xs tracking-widest text-gray-400">No linked accounts yet.</p>
          <p className="text-[10px] font-bold mt-1">Start exploring to find your perfect match!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {linkedProfiles.map(p => (
            <div 
              key={p.id} 
              onClick={() => setSelectedFriend(p)}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 border-white active:scale-95 transition-transform cursor-pointer bg-gray-200"
            >
              <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.username} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-4">
                <span className="text-white font-black text-[10px] uppercase tracking-widest leading-none mb-0.5">@{p.username}, {p.age}</span>
                <span className="text-white/60 text-[8px] font-bold tracking-tight">{toTitleCase(p.location)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Management Modal */}
      {selectedFriend && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedFriend(null)}></div>
          <div className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in fade-in duration-300">
            <div className="text-center mb-8">
              <img src={selectedFriend.imageUrl} className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-orange-50" />
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-[10px] font-black text-gray-800 uppercase tracking-widest">@{selectedFriend.username}, {selectedFriend.age}</h2>
                {selectedFriend.verified && (
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-[9px] font-bold text-gray-400 tracking-tight">{toTitleCase(selectedFriend.location)} • {toTitleCase(selectedFriend.occupation)}</p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => { onShowDetails(selectedFriend); setSelectedFriend(null); }} 
                className="w-full py-4 bg-orange-50 text-orange-600 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform shadow-sm"
              >
                View Full Profile
              </button>
              <button 
                onClick={() => { onBlock(selectedFriend.id); setSelectedFriend(null); }} 
                className="w-full py-4 bg-[#8B0000] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform shadow-sm"
              >
                Block Account
              </button>
              <button 
                onClick={() => setSelectedFriend(null)} 
                className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendsPage;
