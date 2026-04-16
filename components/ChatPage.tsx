
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  is_once_view: boolean;
  once_view_opened: boolean;
  once_view_opened_at: string | null;
  once_view_expires_at: string | null;
  status: 'sent' | 'delivered' | 'read';
  delivered_at: string | null;
  read_at: string | null;
  reply_to_id: string | null;
  created_at: string;
  deleted_for_sender: boolean;
  deleted_for_receiver: boolean;
  deleted_for_everyone: boolean;
  deleted_at: string | null;
}

interface ChatPageProps {
  targetProfile: Profile;
  onBack: () => void;
  currentUserId: string;
}

const ChatPage: React.FC<ChatPageProps> = ({ targetProfile, onBack, currentUserId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [onceViewMode, setOnceViewMode] = useState(false);
  const [viewingOnceMedia, setViewingOnceMedia] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingMedia, setViewingMedia] = useState<ChatMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, peerTyping, scrollToBottom]);

  // ─── FETCH MESSAGES ────────────────────────────
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetProfile.id}),and(sender_id.eq.${targetProfile.id},receiver_id.eq.${currentUserId})`
        )
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
      setLoading(false);

      await supabase.rpc('mark_messages_delivered', {
        p_sender_id: targetProfile.id,
        p_receiver_id: currentUserId,
      });
      setTimeout(async () => {
        await supabase.rpc('mark_messages_read', {
          p_sender_id: targetProfile.id,
          p_receiver_id: currentUserId,
        });
      }, 500);
    };

    fetchMessages();
  }, [currentUserId, targetProfile.id]);

  // ─── REALTIME SUBSCRIPTION ─────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${[currentUserId, targetProfile.id].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUserId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          if (msg.sender_id === targetProfile.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            supabase.rpc('mark_messages_read', { p_sender_id: targetProfile.id, p_receiver_id: currentUserId });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing-${[currentUserId, targetProfile.id].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'typing_indicators', filter: `receiver_id=eq.${currentUserId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setPeerTyping(false);
          } else {
            const row = payload.new as any;
            if (row.sender_id === targetProfile.id) {
              setPeerTyping(true);
              setTimeout(() => setPeerTyping(false), 4000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [currentUserId, targetProfile.id]);

  // ─── TYPING INDICATOR ─────────────────────────
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      supabase.from('typing_indicators').upsert({
        sender_id: currentUserId,
        receiver_id: targetProfile.id,
        started_at: new Date().toISOString(),
      }, { onConflict: 'sender_id,receiver_id' });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      supabase.from('typing_indicators').delete().match({ sender_id: currentUserId, receiver_id: targetProfile.id });
    }, 3000);
  }, [isTyping, currentUserId, targetProfile.id]);

  useEffect(() => {
    return () => {
      supabase.from('typing_indicators').delete().match({ sender_id: currentUserId, receiver_id: targetProfile.id });
    };
  }, [currentUserId, targetProfile.id]);

  // ─── SEND TEXT MESSAGE ─────────────────────────
  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    setReplyTo(null);
    setIsTyping(false);
    supabase.from('typing_indicators').delete().match({ sender_id: currentUserId, receiver_id: targetProfile.id });

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId, sender_id: currentUserId, receiver_id: targetProfile.id, text,
      media_url: null, media_type: null, is_once_view: false, once_view_opened: false,
      once_view_opened_at: null, once_view_expires_at: null, status: 'sent',
      delivered_at: null, read_at: null, reply_to_id: replyTo?.id || null, created_at: new Date().toISOString(),
      deleted_for_sender: false, deleted_for_receiver: false, deleted_for_everyone: false, deleted_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: currentUserId, receiver_id: targetProfile.id, text, reply_to_id: replyTo?.id || null })
      .select().single();

    if (data) setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    else if (error) setMessages((prev) => prev.filter((m) => m.id !== tempId));
  };

  // ─── UPLOAD & SEND MEDIA ──────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('File too large. Maximum 50MB.'); return; }

    setIsUploading(true);
    setUploadProgress(10);
    setShowMediaMenu(false);
    const isOnce = onceViewMode;
    setOnceViewMode(false);

    const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
    const ext = file.name.split('.').pop() || (mediaType === 'image' ? 'jpg' : 'mp4');
    const bucket = isOnce ? 'chat-once-view' : 'chat-media';
    const filePath = `${currentUserId}/${Date.now()}.${ext}`;

    try {
      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw uploadError;
      setUploadProgress(70);

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      setUploadProgress(90);

      const { data, error } = await supabase
        .from('messages')
        .insert({ sender_id: currentUserId, receiver_id: targetProfile.id, media_url: urlData.publicUrl, media_type: mediaType, is_once_view: isOnce })
        .select().single();

      if (data) setMessages((prev) => [...prev, data]);
      if (error) throw error;
      setUploadProgress(100);
    } catch {
      alert('Failed to send media. Please try again.');
    } finally {
      setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 500);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── OPEN ONCE-VIEW MEDIA ─────────────────────
  const handleOpenOnceView = async (msg: ChatMessage) => {
    if (msg.sender_id === currentUserId || msg.once_view_opened) return;
    setViewingOnceMedia(msg);
    await supabase.rpc('open_once_view_message', { p_message_id: msg.id });
    setMessages((prev) =>
      prev.map((m) => m.id === msg.id ? { ...m, once_view_opened: true, once_view_opened_at: new Date().toISOString(), status: 'read' } : m)
    );
  };

  // ─── DELETE HANDLERS ───────────────────────────
  const handleDeleteForMe = async (msg: ChatMessage) => {
    const isSender = msg.sender_id === currentUserId;
    const field = isSender ? 'deleted_for_sender' : 'deleted_for_receiver';
    await supabase.from('messages').update({ [field]: true, deleted_at: new Date().toISOString() }).eq('id', msg.id);
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, [field]: true, deleted_at: new Date().toISOString() } : m));
    setSelectedMessage(null);
  };

  const handleDeleteForEveryone = async (msg: ChatMessage) => {
    if (msg.sender_id !== currentUserId) return;
    await supabase.from('messages').update({ deleted_for_everyone: true, deleted_at: new Date().toISOString() }).eq('id', msg.id);
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, deleted_for_everyone: true, deleted_at: new Date().toISOString() } : m));
    setSelectedMessage(null);
  };

  // ─── LONG PRESS HANDLER ───────────────────────
  const handleTouchStart = (msg: ChatMessage) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMessage(msg);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // ─── VISIBLE MESSAGES (filter deleted) ─────────
  const visibleMessages = messages.filter((m) => {
    if (m.deleted_for_everyone) return false;
    const isSender = m.sender_id === currentUserId;
    if (isSender && m.deleted_for_sender) return false;
    if (!isSender && m.deleted_for_receiver) return false;
    return true;
  });

  // ─── STATUS ICONS ─────────────────────────────
  const StatusIcon: React.FC<{ status: string; isMine: boolean }> = ({ status, isMine }) => {
    if (!isMine) return null;
    if (status === 'read') return (
      <div className="flex -space-x-1">
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
    );
    if (status === 'delivered') return (
      <div className="flex -space-x-1">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
    );
    return <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
  };

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const shouldShowDate = (index: number) => {
    if (index === 0) return true;
    return new Date(visibleMessages[index].created_at).toDateString() !== new Date(visibleMessages[index - 1].created_at).toDateString();
  };

  const getReplyMessage = (replyId: string | null) => replyId ? messages.find((m) => m.id === replyId) || null : null;

  const handleSwipeReply = (msg: ChatMessage) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 bg-[#fdf8f5] flex flex-col z-[100] select-none">
      <div className="absolute inset-0 pointer-events-none z-[200] opacity-[0.02] overflow-hidden flex flex-wrap gap-20 p-10 rotate-12">
        {Array.from({ length: 60 }).map((_, i) => (
          <span key={i} className="text-4xl font-black uppercase whitespace-nowrap text-gray-500">Mallu Cupid</span>
        ))}
      </div>

      {/* ─── HEADER ──────────────────────────── */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 gap-3 z-[150]">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-500 active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <img src={targetProfile.imageUrl} className="w-9 h-9 rounded-full object-cover" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm font-bold text-gray-900 truncate">{targetProfile.name}</p>
              {targetProfile.verified && (
                <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-medium">
              {peerTyping ? <span className="text-green-500 font-semibold">typing...</span> : 'Active now'}
            </p>
          </div>
        </div>
      </header>

      {/* ─── MESSAGES AREA ───────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1 z-[100]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-[3px] border-gray-200 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center py-6 mb-4">
              <img src={targetProfile.imageUrl} className="w-20 h-20 rounded-full object-cover mb-3" />
              <p className="font-bold text-gray-900 text-base">{targetProfile.name}</p>
              <p className="text-xs text-gray-400">@{targetProfile.username} · Mallu Cupid</p>
              <p className="text-[10px] text-gray-300 mt-2 text-center max-w-[200px]">
                Messages are private between you and {targetProfile.name.split(' ')[0]}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                <p className="text-[9px] text-gray-300 font-medium">Messages are end-to-end encrypted</p>
              </div>
            </div>

            {visibleMessages.map((m, index) => {
              const isMine = m.sender_id === currentUserId;
              const replyMsg = getReplyMessage(m.reply_to_id);
              const isOnceView = m.is_once_view;
              const isOnceViewExpired = isOnceView && m.once_view_opened && m.once_view_expires_at && new Date(m.once_view_expires_at) < new Date();

              return (
                <React.Fragment key={m.id}>
                  {shouldShowDate(index) && (
                    <div className="flex justify-center py-3">
                      <span className="text-[10px] font-semibold text-gray-400 bg-white/80 px-4 py-1 rounded-full shadow-sm">{getDateLabel(m.created_at)}</span>
                    </div>
                  )}

                  {/* Once-view: unopened by receiver */}
                  {isOnceView && !isMine && !m.once_view_opened && !isOnceViewExpired ? (
                    <div className="flex justify-start mb-2">
                      <button onClick={() => handleOpenOnceView(m)} className="flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-3.5 rounded-full shadow-lg active:scale-95 transition-transform">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                          {m.media_type === 'video' ? (
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-white text-xs font-bold">{m.media_type === 'video' ? 'Video' : 'Photo'}</p>
                          <p className="text-white/70 text-[10px]">Tap to view · Once</p>
                        </div>
                      </button>
                    </div>
                  ) : isOnceView && (m.once_view_opened || isMine) ? (
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
                      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full border ${isMine ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" /></svg>
                        <span className="text-xs text-gray-400 font-medium">
                          {isOnceViewExpired ? 'Media expired' : isMine ? (m.once_view_opened ? 'Opened' : 'Sent · View once') : 'Opened'}
                        </span>
                        <StatusIcon status={m.status} isMine={isMine} />
                      </div>
                    </div>
                  ) : (
                    // Normal message bubble
                    <div
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}
                      onDoubleClick={() => handleSwipeReply(m)}
                      onTouchStart={() => handleTouchStart(m)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchEnd}
                      onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(m); }}
                    >
                      <div className="max-w-[78%]">
                        {replyMsg && (
                          <div className={`mb-1 px-3 py-1.5 rounded-xl text-[10px] border-l-2 ${isMine ? 'bg-red-50 border-red-300 text-red-400 ml-auto' : 'bg-gray-50 border-gray-300 text-gray-400'}`} style={{ maxWidth: '90%' }}>
                            <p className="font-bold truncate">{replyMsg.sender_id === currentUserId ? 'You' : targetProfile.name.split(' ')[0]}</p>
                            <p className="truncate">{replyMsg.text || (replyMsg.media_type === 'image' ? '📷 Photo' : '🎥 Video')}</p>
                          </div>
                        )}
                        <div className={`px-4 py-2.5 rounded-3xl ${isMine ? 'bg-[#FF4458] text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'}`}>
                          {m.media_url && m.media_type === 'image' && (
                            <div onClick={() => setViewingMedia(m)} className="cursor-pointer">
                              <img
                                src={m.media_url}
                                className="rounded-2xl w-full max-w-[240px] h-auto max-h-[280px] object-cover mb-1"
                                loading="lazy"
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                              />
                            </div>
                          )}
                          {m.media_url && m.media_type === 'video' && (
                            <div onClick={() => setViewingMedia(m)} className="cursor-pointer">
                              <video
                                src={m.media_url}
                                playsInline
                                className="rounded-2xl w-full max-w-[240px] h-auto max-h-[280px] object-cover mb-1"
                                controlsList="nodownload"
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                              />
                            </div>
                          )}
                          {m.text && <p className="text-[14px] leading-relaxed break-words">{m.text}</p>}
                          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[9px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <StatusIcon status={m.status} isMine={isMine} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {peerTyping && (
              <div className="flex justify-start mb-2">
                <div className="bg-white border border-gray-100 px-4 py-3 rounded-3xl rounded-bl-md shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="flex justify-end mb-2">
                <div className="bg-white/90 backdrop-blur border border-red-100 px-5 py-3.5 rounded-3xl rounded-br-md w-48 shadow-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Sending...</span>
                    <span className="text-[10px] font-bold text-red-500">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1 bg-red-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 transition-all duration-300 rounded-full" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── ONCE-VIEW FULLSCREEN VIEWER ─────── */}
      {viewingOnceMedia && (
        <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center" onClick={() => setViewingOnceMedia(null)}>
          <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
              <p className="text-white text-xs font-bold">View once · Tap to close</p>
            </div>
          </div>
          {viewingOnceMedia.media_type === 'image' ? (
            <img
              src={viewingOnceMedia.media_url!}
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
            />
          ) : (
            <video
              src={viewingOnceMedia.media_url!}
              autoPlay
              playsInline
              className="max-w-full max-h-full object-contain"
              controlsList="nodownload"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
            />
          )}
        </div>
      )}

      {/* ─── FULLSCREEN MEDIA VIEWER ─────────── */}
      {viewingMedia && (
        <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center" onContextMenu={(e) => e.preventDefault()}>
          <button
            onClick={() => setViewingMedia(null)}
            className="absolute top-6 right-6 z-10 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {viewingMedia.media_type === 'image' ? (
            <img
              src={viewingMedia.media_url!}
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
            />
          ) : (
            <video
              src={viewingMedia.media_url!}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-full object-contain"
              controlsList="nodownload"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
            />
          )}
        </div>
      )}

      {/* ─── MESSAGE ACTION MENU ─────────────── */}
      {selectedMessage && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={() => setSelectedMessage(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl pb-8 pt-3 px-2 safe-area-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="px-3 pb-2 mb-2 border-b border-gray-100">
              <p className="text-xs text-gray-400 truncate">
                {selectedMessage.text || (selectedMessage.media_type === 'image' ? 'Photo' : selectedMessage.media_type === 'video' ? 'Video' : 'Message')}
              </p>
            </div>
            <button
              onClick={() => { handleSwipeReply(selectedMessage); setSelectedMessage(null); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
              <span className="text-sm font-medium text-gray-800">Reply</span>
            </button>
            <button
              onClick={() => handleDeleteForMe(selectedMessage)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              <span className="text-sm font-medium text-gray-800">Delete for me</span>
            </button>
            {selectedMessage.sender_id === currentUserId && (
              <button
                onClick={() => handleDeleteForEveryone(selectedMessage)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                <span className="text-sm font-medium text-red-500">Delete for everyone</span>
              </button>
            )}
            <button
              onClick={() => setSelectedMessage(null)}
              className="w-full flex items-center justify-center py-3.5 mt-2 rounded-xl bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-500">Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── REPLY PREVIEW BAR ───────────────── */}
      {replyTo && (
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center gap-3 z-[150]">
          <div className="w-1 h-10 bg-[#FF4458] rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-[#FF4458]">{replyTo.sender_id === currentUserId ? 'You' : targetProfile.name.split(' ')[0]}</p>
            <p className="text-xs text-gray-500 truncate">{replyTo.text || (replyTo.media_type === 'image' ? '📷 Photo' : '🎥 Video')}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 text-gray-400 active:scale-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ─── MEDIA MENU POPUP ────────────────── */}
      {showMediaMenu && (
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-3 z-[150]">
          <button onClick={() => { setOnceViewMode(false); fileInputRef.current?.click(); }}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-blue-50 active:scale-95 transition-transform">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
            <span className="text-[10px] font-bold text-blue-600">Photo/Video</span>
          </button>
          <button onClick={() => { setOnceViewMode(true); fileInputRef.current?.click(); }}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-purple-50 active:scale-95 transition-transform">
            <div className="relative">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
              <span className="absolute -top-1 -right-1 text-[8px]">1️⃣</span>
            </div>
            <span className="text-[10px] font-bold text-purple-600">View Once</span>
          </button>
          <button onClick={() => setShowMediaMenu(false)}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-gray-50 active:scale-95 transition-transform">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            <span className="text-[10px] font-bold text-gray-500">Cancel</span>
          </button>
        </div>
      )}

      {/* ─── INPUT BAR ───────────────────────── */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 safe-area-bottom z-[150]">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMediaMenu(!showMediaMenu)}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-transform flex-shrink-0">
            {showMediaMenu ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
            )}
          </button>
          <div className="flex-1">
            <input ref={inputRef} type="text" value={inputText}
              onChange={(e) => { setInputText(e.target.value); handleTyping(); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Message..."
              className="w-full bg-gray-100 rounded-full px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-100 placeholder-gray-400" />
          </div>
          {inputText.trim() ? (
            <button onClick={handleSendText} className="w-10 h-10 rounded-full bg-[#FF4458] flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          ) : (
            <button onClick={() => setShowMediaMenu(!showMediaMenu)} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition-transform flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
