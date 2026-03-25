
import React, { useState, useEffect } from 'react';
import { Profile, SecretContent, PurchaseRecord } from '../types';

interface SecretGalleryViewProps {
  targetProfile: Profile;
  onBack: () => void;
  purchases: PurchaseRecord[];
  onPurchase: (contentId: string) => void;
}

const SecretGalleryView: React.FC<SecretGalleryViewProps> = ({ targetProfile, onBack, purchases, onPurchase }) => {
  const [items, setItems] = useState<SecretContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    // Demo: no backend, empty gallery
    setIsLoading(false);
  }, [targetProfile.id]);

  const handlePay = async (item: SecretContent) => {
    setProcessingId(item.id);
    // Demo: simulate payment
    await new Promise(r => setTimeout(r, 800));
    onPurchase(item.id);
    setProcessingId(null);
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#006400] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-full flex flex-col bg-[#fdf8f5] overflow-y-auto pb-40">
      <header className="p-6 bg-white flex items-center gap-4 sticky top-0 z-40 shadow-sm">
        <button onClick={onBack} className="text-gray-400">←</button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter">Secret Gallery</h2>
          <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-0.5">@{targetProfile.username}'s Collection</p>
        </div>
      </header>

      <div className="p-6 grid grid-cols-2 gap-6">
        {items.map(item => {
          const isPaid = purchases.some(p => p.contentId === item.id);
          return (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-xl bg-gray-200">
                <img src={item.url} className={`w-full h-full object-cover transition-all duration-700 ${!isPaid ? 'blur-[80px] brightness-50 scale-150' : ''}`} />
                {!isPaid && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <button 
                      onClick={() => handlePay(item)} 
                      disabled={processingId === item.id}
                      className="w-full py-3 bg-red-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
                    >
                      {processingId === item.id ? 'Processing...' : `Unlock ₹${item.amount}`}
                    </button>
                  </div>
                )}
              </div>
              <div className="px-1">
                <p className="text-[10px] font-black uppercase text-gray-800 tracking-tight truncate w-full">{item.name}</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase">{item.metadata}</p>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="col-span-2 text-center py-20 text-gray-300 font-black uppercase text-[10px]">Gallery is empty</p>}
      </div>
    </div>
  );
};

export default SecretGalleryView;
