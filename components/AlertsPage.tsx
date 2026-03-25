
import React, { useState, useEffect } from 'react';
import { Notification, Profile } from '../types';

interface AlertsPageProps {
  notifications: Notification[];
  onAccept: (notifId: string, profile: Profile) => void;
}

const AlertsPage: React.FC<AlertsPageProps> = ({ notifications: propNotifications, onAccept }) => {
  const [notifications, setNotifications] = useState<Notification[]>(propNotifications);

  useEffect(() => {
    setNotifications(propNotifications);
  }, [propNotifications]);

  const handleRequest = (id: string, action: 'accepted' | 'rejected', profile?: Profile) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: action } : n));
    if (action === 'accepted' && profile) {
      onAccept(id, profile);
    }
  };

  const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#fdf8f5] pb-32 px-6 pt-6">
      <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-tighter">Alerts</h2>

      {/* Connection Requests Section */}
      <div className="mb-8">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Connection Requests</h3>
        <div className="space-y-4">
          {sortedNotifications.filter(n => n.type === 'request' && n.status === 'pending').map(n => (
            <div key={n.id} className="bg-white p-4 rounded-3xl shadow-sm border border-orange-50 flex items-center gap-4">
              <img src={n.profile?.imageUrl} className="w-14 h-14 rounded-2xl object-cover" />
              <div className="flex-1">
                <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none mb-1">@{n.profile?.username}</p>
                <p className="text-xs font-medium text-gray-500">{n.text}</p>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => handleRequest(n.id, 'accepted', n.profile)}
                    className="flex-1 py-2 bg-[#006400] text-white text-[9px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-transform"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => handleRequest(n.id, 'rejected')}
                    className="flex-1 py-2 bg-[#8B0000] text-white text-[9px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-transform"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
          {sortedNotifications.filter(n => n.type === 'request' && n.status === 'pending').length === 0 && (
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-40 px-2 italic">No new requests.</p>
          )}
        </div>
      </div>

      {/* Notifications Section */}
      <div>
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Notifications</h3>
        <div className="space-y-3">
          {sortedNotifications.filter(n => n.type !== 'request' || n.status !== 'pending').map(n => (
            <div key={n.id} className="bg-white/60 p-5 rounded-3xl flex items-start gap-4 border border-orange-50/50">
              <div className={`w-2.5 h-2.5 mt-1.5 rounded-full ${n.type === 'payout' ? 'bg-[#006400]' : 'bg-pink-400'}`} />
              <div className="flex-1">
                <p className={`text-xs font-medium ${n.type === 'payout' ? 'text-gray-800' : 'text-gray-600'}`}>
                  {n.type === 'request' ? (
                    <span>You {n.status} <span className="font-black">@{n.profile?.username}'s</span> request.</span>
                  ) : n.text}
                </p>
                <span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mt-1 block">
                  {formatTime(n.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;
