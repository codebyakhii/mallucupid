
import React, { useState, useEffect } from 'react';
import { Profile, SubscriptionRecord, SecretContent } from '../types';

interface ExclusiveRoomViewProps {
  targetProfile: Profile;
  onBack: () => void;
  subscriptions: SubscriptionRecord[];
  onSubscribe: (roomId: string) => void;
}

const ExclusiveRoomView: React.FC<ExclusiveRoomViewProps> = ({ targetProfile, onBack, subscriptions, onSubscribe }) => {
  const [contents, setContents] = useState<SecretContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubModal, setShowSubModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const roomId = `room-${targetProfile.id}`;
  const isSubscribed = subscriptions.some(s => s.roomId === roomId && s.expiry > Date.now());

  useEffect(() => {
    // Demo: no backend, empty room
    setIsLoading(false);
  }, [targetProfile.id]);

  const handlePay = async () => {
    setIsSubmitting(true);
    // Demo: simulate subscription
    await new Promise(r => setTimeout(r, 500));
    onSubscribe(roomId);
    setShowSubModal(false);
    setIsSubmitting(false);
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-full flex flex-col bg-[#fdf8f5] overflow-y-auto pb-40">
      <header className="p-6 bg-white flex items-center justify-between sticky top-0 z-40 shadow-sm border-b border-orange-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400">←</button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter">Exclusive Room</h2>
            <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mt-0.5">Premium Subscription</p>
          </div>
        </div>
        {!isSubscribed && (
          <button onClick={() => setShowSubModal(true)} className="px-5 py-2 bg-black text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">Subscribe</button>
        )}
      </header>

      {!isSubscribed ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-8"><span className="text-5xl">👑</span></div>
          <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Access Locked</h3>
          <p className="text-sm font-medium text-gray-500 mb-8 px-4">Subscribe to unlock all premium content.</p>
          <button onClick={() => setShowSubModal(true)} className="w-full py-5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl">Unlock Access</button>
        </div>
      ) : (
        <div className="p-6 grid grid-cols-2 gap-6">
          {contents.map(item => (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden shadow-xl border-2 border-white">
                <img src={item.url} className="w-full h-full object-cover" />
              </div>
              <div className="px-1">
                <p className="text-[10px] font-black uppercase text-gray-800 tracking-tight truncate">{item.name}</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase">{item.metadata}</p>
              </div>
            </div>
          ))}
          {contents.length === 0 && <p className="col-span-2 text-center py-20 text-gray-300 font-black uppercase text-[10px]">No premium content posted yet</p>}
        </div>
      )}

      {showSubModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSubModal(false)}></div>
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter mb-4">Subscribe Now</h2>
            <button 
              onClick={handlePay}
              disabled={isSubmitting}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Subscription'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExclusiveRoomView;
