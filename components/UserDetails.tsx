
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface UserDetailsProps {
  profile: Profile;
  currentUserId: string;
  onBack: () => void;
  onOpenPrivateGallery: () => void;
  onChat: () => void;
  isPro: boolean;
  onGetPro: () => void;
  onConnectionChange: () => void;
}

const UserDetails: React.FC<UserDetailsProps> = ({
  profile, currentUserId, onBack, onOpenPrivateGallery, onChat, isPro, onGetPro, onConnectionChange
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

  // Check connection / block status from DB
  useEffect(() => {
    const checkStatus = async () => {
      // Check connection
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

      // Check if blocked
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

      // Create notification for recipient
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
      // Delete the connection request row
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

      // Also remove any existing connection
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
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-[9px] font-bold text-white/60 tracking-tight">
            <span>{toTitleCase(profile.location)}</span>
            <span>{profile.gender}</span>
            {profile.occupation && <span>{toTitleCase(profile.occupation)}</span>}
          </div>
        </div>

        {profile.images.length > 1 && (
          <div className="absolute bottom-32 right-8 flex gap-2">
            <button onClick={() => setImgIdx(prev => (prev - 1 + profile.images.length) % profile.images.length)} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl">\u2190</button>
            <button onClick={() => setImgIdx(prev => (prev + 1) % profile.images.length)} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl">\u2192</button>
          </div>
        )}
      </div>

      <div className="p-8 space-y-8">
        <div className="flex gap-4">
          <button
            onClick={handleChatClick}
            className={`flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-transform ${isLinked ? 'bg-red-500' : 'bg-gray-400'}`}
          >
            {isPro ? 'Chat now' : 'Chat (Pro only)'}
          </button>
          <button onClick={onOpenPrivateGallery} className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-transform">Private gallery</button>
        </div>

        <div>
          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 px-1">Biography</h3>
          <p className="text-sm font-medium text-gray-700 leading-relaxed italic px-1">"{profile.bio}"</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm"><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Goal</p><p className="text-xs font-bold text-gray-800">{profile.relationshipGoal}</p></div>
          <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm"><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Looking for</p><p className="text-xs font-bold text-gray-800">{profile.lookingFor}</p></div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-8 border-t border-orange-100">
          <button
            onClick={handleUnfriend}
            disabled={!isLinked || actionLoading === 'unfriend'}
            className={`py-4 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm transition-all flex items-center justify-center ${isLinked ? 'bg-[#006400] text-white active:scale-95' : 'bg-gray-100 text-gray-300'}`}
          >
            {actionLoading === 'unfriend' ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Unfriend'}
          </button>
          <button
            onClick={handleBlock}
            disabled={isBlocked || actionLoading === 'block'}
            className={`py-4 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm active:scale-95 transition-transform flex items-center justify-center ${isBlocked ? 'bg-gray-200 text-gray-400' : 'bg-[#FFD700] text-black'}`}
          >
            {actionLoading === 'block' ? <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : isBlocked ? 'Blocked' : 'Block'}
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            disabled={actionLoading === 'report'}
            className="py-4 bg-[#FF0000] text-white rounded-xl font-black uppercase tracking-widest text-[8px] shadow-sm active:scale-95 transition-transform flex items-center justify-center"
          >
            Report
          </button>
        </div>
      </div>

      {/* Connect First Dialog */}
      {showConnectDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowConnectDialog(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Connect first</h3>
            <p className="text-sm font-medium text-gray-500 mb-8 px-4">You must be friends with <span className="font-black">@{profile.username}</span> to chat.</p>
            <button
              onClick={() => { handleConnect(); setShowConnectDialog(false); }}
              disabled={isPending || actionLoading === 'connect'}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all flex items-center justify-center gap-2 ${isPending ? 'bg-gray-100 text-gray-400' : 'bg-[#006400] text-white active:scale-95'}`}
            >
              {actionLoading === 'connect' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isPending ? 'Request pending' : 'Send connection request'}
            </button>
          </div>
        </div>
      )}

      {/* Pro Dialog */}
      {showProDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowProDialog(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-600"><span className="text-3xl">\uD83D\uDC51</span></div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-gray-800">Pro feature</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">Private chatting is exclusive to <span className="text-gray-800">Pro members</span>.</p>
            <div className="space-y-3">
              <button onClick={() => { onGetPro(); setShowProDialog(false); }} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform">Get Pro \u2022 \u20B999 / month</button>
              <button onClick={() => setShowProDialog(false)} className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px]">Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
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
