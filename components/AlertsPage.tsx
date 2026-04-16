
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AlertsPageProps {
  currentUserId: string;
  isVerified: boolean;
  allUsers: Profile[];
  onConnectionAccepted: () => void;
}

interface DbConnectionRequest {
  id: string;
  from_id: string;
  to_id: string;
  status: string;
  created_at: string;
}

interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  from_user_id: string | null;
  text: string;
  read: boolean;
  related_id: string | null;
  created_at: string;
}

const AlertsPage: React.FC<AlertsPageProps> = ({ currentUserId, isVerified, allUsers, onConnectionAccepted }) => {
  const [pendingRequests, setPendingRequests] = useState<DbConnectionRequest[]>([]);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getProfile = useCallback((userId: string): Profile | undefined => {
    return allUsers.find(u => u.id === userId);
  }, [allUsers]);

  const fetchData = useCallback(async () => {
    try {
      const [reqRes, notifRes] = await Promise.all([
        supabase
          .from('connection_requests')
          .select('*')
          .eq('to_id', currentUserId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (reqRes.data) setPendingRequests(reqRes.data);
      if (notifRes.data) setNotifications(notifRes.data);
    } catch {} finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchData();

    const reqChannel = supabase
      .channel('alerts-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connection_requests', filter: `to_id=eq.${currentUserId}` }, () => { fetchData(); })
      .subscribe();

    const notifChannel = supabase
      .channel('alerts-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, () => { fetchData(); })
      .subscribe();

    return () => {
      supabase.removeChannel(reqChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [currentUserId, fetchData]);

  useEffect(() => {
    const markRead = async () => {
      await supabase.from('notifications').update({ read: true }).eq('user_id', currentUserId).eq('read', false);
    };
    const timer = setTimeout(markRead, 1500);
    return () => clearTimeout(timer);
  }, [currentUserId]);

  const handleAccept = async (requestId: string) => {
    if (!isVerified) {
      alert('You must verify your profile before accepting connection requests.');
      return;
    }
    setLoadingId(requestId);
    try {
      const { error } = await supabase.rpc('accept_connection_request', { request_id: requestId });
      if (error) throw error;
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      onConnectionAccepted();
    } catch (err: any) {
      alert(err.message || 'Failed to accept request');
    }
    setLoadingId(null);
  };

  const handleReject = async (requestId: string) => {
    setLoadingId(requestId);
    try {
      const { error } = await supabase.rpc('reject_connection_request', { request_id: requestId });
      if (error) throw error;
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    }
    setLoadingId(null);
  };

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#fdf8f5]">
        <div className="w-10 h-10 border-3 border-[#FF4458] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#fdf8f5] pb-32 px-6 pt-6">
      <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-tighter">Alerts</h2>

      {/* Connection Requests Section */}
      <div className="mb-8">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Connection requests</h3>
        <div className="space-y-4">
          {pendingRequests.map(req => {
            const fromProfile = getProfile(req.from_id);
            if (!fromProfile) return null;
            const isActioning = loadingId === req.id;
            return (
              <div key={req.id} className="bg-white p-4 rounded-3xl shadow-sm border border-orange-50 flex items-center gap-4">
                <img src={fromProfile.imageUrl || ''} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none mb-1">@{fromProfile.username}</p>
                  <p className="text-xs font-medium text-gray-500">Wants to connect with you</p>
                  <p className="text-[9px] text-gray-300 font-bold tracking-widest mt-0.5">{formatTime(req.created_at)}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={isActioning}
                      className="flex-1 py-2 bg-[#006400] text-white text-[9px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isActioning ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={isActioning}
                      className="flex-1 py-2 bg-[#8B0000] text-white text-[9px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isActioning ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {pendingRequests.length === 0 && (
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-40 px-2 italic">No new requests</p>
          )}
        </div>
      </div>

      {/* Notifications Section */}
      <div>
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Notifications</h3>
        <div className="space-y-3">
          {notifications.length === 0 && (
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-40 px-2 italic">No notifications yet</p>
          )}
          {notifications.map(n => {
            const fromProfile = n.from_user_id ? getProfile(n.from_user_id) : null;
            return (
              <div key={n.id} className={`p-5 rounded-3xl flex items-start gap-4 border border-orange-50/50 ${n.read ? 'bg-white/60' : 'bg-white'}`}>
                <div className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${
                  n.type === 'payout' ? 'bg-[#006400]' :
                  n.type === 'acceptance' ? 'bg-blue-500' :
                  n.type === 'request' ? 'bg-orange-400' :
                  'bg-pink-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600">
                    {fromProfile && <span className="font-black text-gray-800">@{fromProfile.username} </span>}
                    {n.text}
                  </p>
                  <span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mt-1 block">
                    {formatTime(n.created_at)}
                  </span>
                </div>
                {!n.read && <div className="w-2 h-2 bg-[#FF4458] rounded-full flex-shrink-0 mt-2" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;
