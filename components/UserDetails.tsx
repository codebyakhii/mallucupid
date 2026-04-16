
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface UserDetailsProps {
  profile: Profile;
  currentUser: Profile;
  currentUserId: string;
  onBack: () => void;
  onOpenPrivateGallery: () => void;
  onChat: () => void;
  isPro: boolean;
  onGetPro: () => void;
  onConnectionChange: () => void;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const UserDetails: React.FC<UserDetailsProps> = ({
  profile, currentUser, currentUserId, onBack, onOpenPrivateGallery, onChat, isPro, onGetPro, onConnectionChange
}) => {
  const [imgIdx, setImgIdx] = useState(0);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showProDialog, setShowProDialog] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isLinked, setIsLinked] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const toTitleCase = (str: string) => str.toLowerCase().replace(/(^|\s)\S/g, L => L.toUpperCase());

  const allImages = [profile.imageUrl, ...(profile.images || [])].filter(Boolean).slice(0, 9);

  const distance = useMemo(() => {
    if (currentUser.latitude != null && currentUser.longitude != null && profile.latitude != null && profile.longitude != null) {
      return Math.round(haversineKm(currentUser.latitude, currentUser.longitude, profile.latitude, profile.longitude));
    }
    return null;
  }, [currentUser.latitude, currentUser.longitude, profile.latitude, profile.longitude]);

  const sharedInterests = useMemo(() => {
    const mySet = new Set((currentUser.interests || []).map(i => i.toLowerCase()));
    return (profile.interests || []).filter(i => mySet.has(i.toLowerCase()));
  }, [currentUser.interests, profile.interests]);

  const isRecentlyActive = profile.lastActive
    ? (Date.now() - new Date(profile.lastActive).getTime()) < 15 * 60 * 1000
    : false;

  useEffect(() => {
    const checkStatus = async () => {
      const { data: connData } = await supabase
        .from('connection_requests')
        .select('*')
        .or(`and(from_id.eq.${currentUserId},to_id.eq.${profile.id}),and(from_id.eq.${profile.id},to_id.eq.${currentUserId})`)
        .limit(1)
        .maybeSingle();

      if (connData) {
        setIsLinked(connData.status === 'accepted');
        setIsPending(connData.status === 'pending' && connData.from_id === currentUserId);
      } else {
        setIsLinked(false);
        setIsPending(false);
      }

      const { data: blockData } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', profile.id)
        .maybeSingle();
      setIsBlocked(!!blockData);
    };
    checkStatus();
  }, [currentUserId, profile.id]);

  const handleConnect = async () => {
    setActionLoading('connect');
    try {
      const { error } = await supabase.from('connection_requests').insert({
        from_id: currentUserId,
        to_id: profile.id,
        status: 'pending',
      });
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'request',
        from_user_id: currentUserId,
        text: 'sent you a connection request',
      });
      setIsPending(true);
      onConnectionChange();
    } catch (err: any) {
      alert(err.message || 'Failed to send request');
    }
    setActionLoading(null);
  };

  const handleUnfriend = async () => {
    setActionLoading('unfriend');
    try {
      const { error } = await supabase
        .from('connection_requests')
        .delete()
        .or(`and(from_id.eq.${currentUserId},to_id.eq.${profile.id}),and(from_id.eq.${profile.id},to_id.eq.${currentUserId})`);
      if (error) throw error;
      setIsLinked(false);
      setIsPending(false);
      onConnectionChange();
    } catch (err: any) {
      alert(err.message || 'Failed to unfriend');
    }
    setActionLoading(null);
  };

  const handleBlock = async () => {
    setActionLoading('block');
    try {
      const { error } = await supabase.from('blocked_users').insert({
        blocker_id: currentUserId,
        blocked_id: profile.id,
      });
      if (error) throw error;
      await supabase
        .from('connection_requests')
        .delete()
        .or(`and(from_id.eq.${currentUserId},to_id.eq.${profile.id}),and(from_id.eq.${profile.id},to_id.eq.${currentUserId})`);
      setIsBlocked(true);
      setIsLinked(false);
      setIsPending(false);
      onConnectionChange();
    } catch (err: any) {
      alert(err.message || 'Failed to block user');
    }
    setActionLoading(null);
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setActionLoading('report');
    try {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: currentUserId,
        target_id: profile.id,
        reason: reportReason.trim(),
      });
      if (error) throw error;
      setShowReportModal(false);
      setReportReason('');
      alert('Report submitted successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    }
    setActionLoading(null);
  };

  const handleChatClick = () => {
    if (!isLinked) { setShowConnectDialog(true); return; }
    if (!isPro) { setShowProDialog(true); return; }
    onChat();
  };

  const lifestyle = profile.lifestyle;
  const lifestyleItems = lifestyle ? [
    lifestyle.drinking && { label: 'Drinking', value: lifestyle.drinking, icon: '🍷' },
    lifestyle.smoking && { label: 'Smoking', value: lifestyle.smoking, icon: '🚬' },
    lifestyle.workout && { label: 'Workout', value: lifestyle.workout, icon: '💪' },
    lifestyle.pets && { label: 'Pets', value: lifestyle.pets, icon: '🐾' },
    lifestyle.diet && { label: 'Diet', value: lifestyle.diet, icon: '🥗' },
  ].filter(Boolean) as { label: string; value: string; icon: string }[] : [];

  return (
    <div className="h-full flex flex-col bg-[#fdf8f5] overflow-y-auto pb-40">
      {/* ─── Hero Photo Section ────────────────────────────── */}
      <div className="relative w-full aspect-[3/4] bg-gray-200 flex-shrink-0">
        <img
          src={allImages[imgIdx] || profile.imageUrl}
          className="w-full h-full object-cover"
          alt={profile.name}
          draggable={false}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const tapX = e.clientX - rect.left;
            if (allImages.length <= 1) return;
            if (tapX < rect.width * 0.35) setImgIdx(prev => Math.max(0, prev - 1));
            else if (tapX > rect.width * 0.65) setImgIdx(prev => Math.min(allImages.length - 1, prev + 1));
          }}
        />

        {/* Image pagination bars */}
        {allImages.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4 z-20">
            {allImages.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full transition-all duration-200" style={{ background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.35)', maxWidth: '60px' }} />
            ))}
          </div>
        )}

        {/* Back button */}
        <button onClick={onBack} className="absolute top-6 left-5 w-11 h-11 bg-black/25 backdrop-blur-md rounded-full flex items-center justify-center text-white z-30 active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[28px] font-black text-white leading-tight truncate">{toTitleCase(profile.name)}, {profile.age}</h1>
            {profile.verified && (
              <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
            )}
            {isRecentlyActive && (
              <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0 border-2 border-white shadow-sm" title="Recently active" />
            )}
          </div>

          {/* Job / Company */}
          {(profile.jobTitle || profile.company || profile.occupation) && (
            <p className="text-sm text-white/80 font-semibold truncate mb-1">
              {profile.jobTitle
                ? `${toTitleCase(profile.jobTitle)}${profile.company ? ` at ${toTitleCase(profile.company)}` : ''}`
                : toTitleCase(profile.occupation)
              }
            </p>
          )}

          {/* Location + Distance */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-white/50 font-medium">📍 {toTitleCase(profile.location)}</p>
            {distance != null && (
              <span className="text-xs text-white/40 font-medium">• {distance < 1 ? '<1' : distance} km away</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Content Sections ──────────────────────────────── */}
      <div className="px-6 py-6 space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleChatClick}
            className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 ${
              isLinked ? 'bg-[#006400] text-white' : 'bg-gray-200 text-gray-500'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0M21 12c0 1.2-.504 2.362-1.006 3.232-.502.87-1.215 1.697-1.994 2.328V21l-2.707-1.354A8.97 8.97 0 0112 20c-4.97 0-9-3.582-9-8s4.03-8 9-8 9 3.582 9 8z" /></svg>
            {isPro ? 'Chat' : 'Chat (Pro)'}
          </button>
          <button
            onClick={onOpenPrivateGallery}
            className="flex-1 py-3.5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            Private Gallery
          </button>
        </div>

        {/* Relationship Goal Badge */}
        {profile.relationshipGoal && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-pink-50 text-pink-600 text-xs font-bold px-4 py-2 rounded-full border border-pink-100">
              💕 Looking for {profile.relationshipGoal}
            </span>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="bg-white rounded-2xl p-5 border border-orange-50 shadow-sm">
            <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3">About me</h3>
            <p className="text-sm font-medium text-gray-700 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Gender</p>
            <p className="text-xs font-bold text-gray-800">{profile.gender}</p>
          </div>
          {profile.orientation && profile.showOrientation && (
            <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Orientation</p>
              <p className="text-xs font-bold text-gray-800">{profile.orientation}</p>
            </div>
          )}
          {profile.pronouns && (
            <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Pronouns</p>
              <p className="text-xs font-bold text-gray-800">{profile.pronouns}</p>
            </div>
          )}
          {profile.education && (
            <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Education</p>
              <p className="text-xs font-bold text-gray-800 truncate">{profile.education}</p>
            </div>
          )}
          <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Looking for</p>
            <p className="text-xs font-bold text-gray-800">{profile.lookingFor}</p>
          </div>
          {profile.occupation && (
            <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Occupation</p>
              <p className="text-xs font-bold text-gray-800 truncate">{toTitleCase(profile.occupation)}</p>
            </div>
          )}
        </div>

        {/* Interests */}
        {(profile.interests || []).length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-orange-50 shadow-sm">
            <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest, i) => {
                const isShared = sharedInterests.some(s => s.toLowerCase() === interest.toLowerCase());
                return (
                  <span
                    key={i}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                      isShared
                        ? 'bg-green-50 text-green-600 border-green-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {isShared && '✦ '}{interest}
                  </span>
                );
              })}
            </div>
            {sharedInterests.length > 0 && (
              <p className="text-[10px] text-green-500 font-bold mt-3">{sharedInterests.length} shared interest{sharedInterests.length > 1 ? 's' : ''}</p>
            )}
          </div>
        )}

        {/* Lifestyle */}
        {lifestyleItems.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-orange-50 shadow-sm">
            <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3">Lifestyle</h3>
            <div className="grid grid-cols-2 gap-3">
              {lifestyleItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{item.label}</p>
                    <p className="text-xs font-bold text-gray-700">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manage Actions */}
        <div className="pt-4 border-t border-orange-100">
          <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-4 px-1">Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleUnfriend}
              disabled={!isLinked || actionLoading === 'unfriend'}
              className={`py-3.5 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm transition-all flex items-center justify-center ${
                isLinked ? 'bg-[#006400] text-white active:scale-95' : 'bg-gray-100 text-gray-300'
              }`}
            >
              {actionLoading === 'unfriend' ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Unfriend'}
            </button>
            <button
              onClick={handleBlock}
              disabled={isBlocked || actionLoading === 'block'}
              className={`py-3.5 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm active:scale-95 transition-transform flex items-center justify-center ${
                isBlocked ? 'bg-gray-200 text-gray-400' : 'bg-[#FFD700] text-black'
              }`}
            >
              {actionLoading === 'block' ? <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : isBlocked ? 'Blocked' : 'Block'}
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              disabled={actionLoading === 'report'}
              className="py-3.5 bg-[#FF0000] text-white rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm active:scale-95 transition-transform flex items-center justify-center"
            >
              Report
            </button>
          </div>
        </div>
      </div>

      {/* ─── Connect First Dialog ─────────────────────────── */}
      {showConnectDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowConnectDialog(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Connect first</h3>
            <p className="text-sm font-medium text-gray-500 mb-8 px-4">You must be friends with <span className="font-black">@{profile.username}</span> to chat.</p>
            <button
              onClick={() => { handleConnect(); setShowConnectDialog(false); }}
              disabled={isPending || actionLoading === 'connect'}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all flex items-center justify-center gap-2 ${
                isPending ? 'bg-gray-100 text-gray-400' : 'bg-[#006400] text-white active:scale-95'
              }`}
            >
              {actionLoading === 'connect' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isPending ? 'Request pending' : 'Send connection request'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Pro Dialog ───────────────────────────────────── */}
      {showProDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowProDialog(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-3xl">👑</span></div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-gray-800">Pro feature</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">Private chatting is exclusive to <span className="text-gray-800">Pro members</span>.</p>
            <div className="space-y-3">
              <button onClick={() => { onGetPro(); setShowProDialog(false); }} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform">Get Pro • ₹99 / month</button>
              <button onClick={() => setShowProDialog(false)} className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px]">Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Report Modal ─────────────────────────────────── */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowReportModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-4 text-gray-800 text-center">Report @{profile.username}</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-5 text-sm font-medium outline-none focus:border-[#FF4458] transition-colors h-28 resize-none placeholder:text-gray-400"
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowReportModal(false)} className="flex-1 py-3.5 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancel</button>
              <button
                onClick={handleReport}
                disabled={!reportReason.trim() || actionLoading === 'report'}
                className="flex-1 py-3.5 bg-[#FF0000] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {actionLoading === 'report' ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetails;
