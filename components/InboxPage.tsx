
import React, { useState } from 'react';
import { Profile, Message } from '../types';

interface InboxPageProps {
  currentUser: Profile;
  friends: Profile[];
  messages: Message[];
  onSelectChat: (profile: Profile) => void;
  onDeleteChat: (profileId: string) => void;
  isPro: boolean;
  onGetPro: () => void;
}

const InboxPage: React.FC<InboxPageProps> = ({ currentUser, friends, messages, onSelectChat, onDeleteChat, isPro, onGetPro }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showProDialog, setShowProDialog] = useState(false);

  const handleChatSelect = (friend: Profile) => {
    if (!isPro) {
      setShowProDialog(true);
      return;
    }
    onSelectChat(friend);
  };

  const activeChats = friends.map(friend => {
    const chatMessages = messages.filter(m => 
      (m.senderId === currentUser.id && m.receiverId === friend.id) ||
      (m.senderId === friend.id && m.receiverId === currentUser.id)
    );
    
    if (chatMessages.length === 0) return null;

    const lastMsg = [...chatMessages].sort((a, b) => b.timestamp - a.timestamp)[0];
    
    return {
      friend,
      lastMsg,
      timestamp: lastMsg.timestamp
    };
  }).filter(Boolean) as any[];

  const sortedChats = activeChats.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="h-full bg-[#fdf8f5] flex flex-col overflow-y-auto pb-32">
      <div className="p-6">
        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter mb-2">Inbox</h2>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">Secure Conversations</p>

        {sortedChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-30">
            <p className="text-sm font-black uppercase tracking-widest">Inbox Empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedChats.map(({ friend, lastMsg }) => (
              <div key={friend.id} className="relative group">
                <div 
                  onClick={() => handleChatSelect(friend)}
                  className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-orange-50 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <img src={friend.imageUrl} className="w-14 h-14 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="text-[10px] font-black text-gray-800 uppercase truncate">@{friend.username}</p>
                      <span className="text-[8px] font-bold text-gray-400">
                        {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-medium truncate italic leading-tight">
                      {lastMsg.text || 'Shared media'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showProDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowProDialog(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Pro Membership Required</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">Private messaging is only available to Pro Users.</p>
            <button 
              onClick={() => { onGetPro(); setShowProDialog(false); }}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-[10px] shadow-xl"
            >
              Unlock Pro • ₹99
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
