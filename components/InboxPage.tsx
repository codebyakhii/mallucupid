
import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';

interface ConversationPreview {
  friend: Profile;
  lastMessage: {
    id: string;
    text: string | null;
    media_type: 'image' | 'video' | null;
    is_once_view: boolean;
    sender_id: string;
    status: 'sent' | 'delivered' | 'read';
    created_at: string;
  };
  unreadCount: number;
}

interface InboxPageProps {
  currentUser: Profile;
  friends: Profile[];
  onSelectChat: (profile: Profile) => void;
  onDeleteChat: (profileId: string) => void;
  isPro: boolean;
  onGetPro: () => void;
}

const InboxPage: React.FC<InboxPageProps> = ({ currentUser, friends, onSelectChat, onDeleteChat, isPro, onGetPro }) => {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProDialog, setShowProDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── FETCH CONVERSATIONS ───────────────────────
  const fetchConversations = async () => {
    // Get all messages involving current user
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (!msgs) { setLoading(false); return; }

    // Group by conversation partner
    const convMap = new Map<string, { lastMsg: any; unread: number }>();

    for (const msg of msgs) {
      const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(partnerId)) {
        const unread = msg.sender_id !== currentUser.id && msg.status !== 'read' ? 1 : 0;
        convMap.set(partnerId, { lastMsg: msg, unread });
      } else {
        const existing = convMap.get(partnerId)!;
        if (msg.sender_id !== currentUser.id && msg.status !== 'read') {
          existing.unread += 1;
        }
      }
    }

    // Map to ConversationPreview
    const convs: ConversationPreview[] = [];
    // Fetch profiles for all partners we have conversations with
    const partnerIds = Array.from(convMap.keys());

    // Try to use already-loaded friends first, fetch missing ones
    const knownProfiles = new Map(friends.map(f => [f.id, f]));

    const missingIds = partnerIds.filter(id => !knownProfiles.has(id));
    if (missingIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', missingIds);

      if (profiles) {
        for (const p of profiles) {
          knownProfiles.set(p.id, {
            id: p.id, name: p.full_name, username: p.username, email: p.email,
            age: p.age, dob: p.dob, location: p.location, bio: p.bio,
            interests: p.interests || [], imageUrl: p.image_url || '', images: p.images || [],
            occupation: p.occupation || '', gender: p.gender, verified: p.verified || false,
            relationshipGoal: p.relationship_goal, lookingFor: p.looking_for,
            orientation: p.orientation, pronouns: p.pronouns || '',
            lifestyle: p.lifestyle || { drinking: '', smoking: '', workout: '', pets: '', diet: '' },
            jobTitle: p.job_title || '', company: p.company || '', education: p.education || '',
            latitude: p.latitude ?? null, longitude: p.longitude ?? null,
            showMe: p.show_me || 'Everyone', ageMin: p.age_min ?? 18, ageMax: p.age_max ?? 50,
            maxDistance: p.max_distance ?? 50, showAge: p.show_age ?? true,
            showDistance: p.show_distance ?? true, showOrientation: p.show_orientation ?? true,
            role: p.role || 'user', status: p.status || 'active',
            balance: p.balance || 0, proExpiry: p.pro_expiry ? new Date(p.pro_expiry).getTime() : undefined,
          } as Profile);
        }
      }
    }

    for (const [partnerId, { lastMsg, unread }] of convMap.entries()) {
      const friend = knownProfiles.get(partnerId);
      if (!friend) continue;
      convs.push({
        friend,
        lastMessage: {
          id: lastMsg.id,
          text: lastMsg.text,
          media_type: lastMsg.media_type,
          is_once_view: lastMsg.is_once_view,
          sender_id: lastMsg.sender_id,
          status: lastMsg.status,
          created_at: lastMsg.created_at,
        },
        unreadCount: unread,
      });
    }

    // Sort by latest message
    convs.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
    setConversations(convs);
    setLoading(false);
  };

  useEffect(() => { fetchConversations(); }, [currentUser.id]);

  // ─── REALTIME: NEW MESSAGES UPDATE INBOX ───────
  useEffect(() => {
    const channel = supabase
      .channel('inbox-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` },
        () => { fetchConversations(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => { fetchConversations(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser.id]);

  const handleChatSelect = (friend: Profile) => {
    if (!isPro) { setShowProDialog(true); return; }
    onSelectChat(friend);
  };

  const handleDeleteChat = async (friendId: string) => {
    // Soft delete — insert into chat_deletions
    await supabase.from('chat_deletions').upsert({
      user_id: currentUser.id,
      other_user_id: friendId,
      deleted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,other_user_id' });
    setConversations(prev => prev.filter(c => c.friend.id !== friendId));
    setShowDeleteConfirm(null);
    onDeleteChat(friendId);
  };

  const getLastMessagePreview = (conv: ConversationPreview) => {
    const isMe = conv.lastMessage.sender_id === currentUser.id;
    const prefix = isMe ? 'You: ' : '';

    if (conv.lastMessage.is_once_view) {
      return `${prefix}${conv.lastMessage.media_type === 'video' ? '🎬' : '📷'} View once`;
    }
    if (conv.lastMessage.media_type === 'image') return `${prefix}📷 Photo`;
    if (conv.lastMessage.media_type === 'video') return `${prefix}🎥 Video`;
    if (conv.lastMessage.text) return `${prefix}${conv.lastMessage.text}`;
    return `${prefix}Message`;
  };

  const getTimeLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const filteredConversations = searchQuery
    ? conversations.filter(c =>
        c.friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.friend.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <div className="h-full bg-[#fdf8f5] flex flex-col overflow-y-auto pb-32">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-black text-gray-800">Messages</h2>
          {conversations.some(c => c.unreadCount > 0) && (
            <span className="bg-[#FF4458] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              {conversations.reduce((sum, c) => sum + c.unreadCount, 0)} new
            </span>
          )}
        </div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-5">Private & Secure</p>

        {/* Search */}
        <div className="relative mb-5">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white rounded-full pl-10 pr-4 py-2.5 text-sm font-medium border border-gray-100 focus:outline-none focus:ring-2 focus:ring-red-100 placeholder-gray-400"
          />
        </div>

        {/* Conversation List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-[3px] border-gray-200 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h2.387c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
            </div>
            <p className="text-sm font-bold text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-300 mt-1">Start a conversation from someone's profile</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((conv) => (
              <div key={conv.friend.id} className="relative">
                <div
                  onClick={() => handleChatSelect(conv.friend)}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl active:bg-gray-50 transition-colors cursor-pointer"
                >
                  {/* Avatar with online indicator */}
                  <div className="relative flex-shrink-0">
                    <img src={conv.friend.imageUrl} className="w-14 h-14 rounded-full object-cover" />
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-[#fdf8f5]" />
                    {/* Once-view ring */}
                    {conv.lastMessage.is_once_view && !conv.lastMessage.text && conv.lastMessage.sender_id !== currentUser.id && (
                      <div className="absolute inset-0 rounded-full border-2 border-purple-500 animate-pulse" />
                    )}
                  </div>

                  {/* Message preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                          {conv.friend.name}
                        </p>
                        {conv.friend.verified && (
                          <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[11px] flex-shrink-0 ${conv.unreadCount > 0 ? 'text-[#FF4458] font-bold' : 'text-gray-400'}`}>
                        {getTimeLabel(conv.lastMessage.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-[13px] truncate pr-2 ${conv.unreadCount > 0 ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
                        {getLastMessagePreview(conv)}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Read receipts for your sent messages */}
                        {conv.lastMessage.sender_id === currentUser.id && (
                          conv.lastMessage.status === 'read' ? (
                            <div className="flex -space-x-1">
                              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                          ) : conv.lastMessage.status === 'delivered' ? (
                            <div className="flex -space-x-1">
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                          ) : (
                            <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          )
                        )}
                        {/* Unread badge */}
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 bg-[#FF4458] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Long press delete (simulated with button) */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(conv.friend.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-400 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
          <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Chat?</h3>
            <p className="text-xs text-gray-500 mb-6">This will remove the conversation from your inbox.</p>
            <div className="space-y-2.5">
              <button onClick={() => handleDeleteChat(showDeleteConfirm)} className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform">Delete</button>
              <button onClick={() => setShowDeleteConfirm(null)} className="w-full py-3.5 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Dialog */}
      {showProDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowProDialog(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF4458] to-[#FF7854] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Pro Required</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-8">Private messaging is exclusively available for Pro members.</p>
            <button
              onClick={() => { onGetPro(); setShowProDialog(false); }}
              className="w-full py-4 bg-gradient-to-r from-[#FF4458] to-[#FF7854] text-white rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-transform"
            >
              Unlock Pro Messaging
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
