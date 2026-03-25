
import React from 'react';
import { Profile } from '../types';

interface BlockedUsersPageProps {
  blockedIds: string[];
  onUnblock: (profileId: string) => void;
  onBack: () => void;
  allUsers: Profile[];
}

const BlockedUsersPage: React.FC<BlockedUsersPageProps> = ({ blockedIds, onUnblock, onBack, allUsers }) => {
  const blockedProfiles = allUsers.filter(p => blockedIds.includes(p.id));

  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto pb-32">
      <header className="p-6 flex items-center gap-4 border-b border-orange-100 bg-white sticky top-0 z-30 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Blocked Accounts</h1>
      </header>

      <div className="p-6">
        {blockedProfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            <p className="font-black uppercase text-xs tracking-widest">No blocked accounts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {blockedProfiles.map(p => (
              <div key={p.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-orange-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={p.imageUrl} className="w-14 h-14 rounded-2xl object-cover border border-orange-50" />
                  <div>
                    <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">@{p.username}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.location}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onUnblock(p.id)}
                  className="px-6 py-2 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockedUsersPage;
