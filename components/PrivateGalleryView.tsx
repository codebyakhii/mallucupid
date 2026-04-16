import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface PrivateGalleryViewProps {
  targetProfile: Profile;
  currentUserId: string;
  onBack: () => void;
}

interface GalleryContent {
  id: string;
  type: 'image' | 'video';
  file_url: string;
  head_note: string;
  amount: number;
  created_at: string;
}

const PrivateGalleryView: React.FC<PrivateGalleryViewProps> = ({ targetProfile, currentUserId, onBack }) => {
  const [items, setItems] = useState<GalleryContent[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [hasSetup, setHasSetup] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Check if target user has gallery setup
    const { data: setup } = await supabase
      .from('private_gallery_setup')
      .select('id')
      .eq('user_id', targetProfile.id)
      .maybeSingle();
    setHasSetup(!!setup);

    // Fetch content
    const { data: content } = await supabase
      .from('private_gallery_content')
      .select('*')
      .eq('owner_id', targetProfile.id)
      .order('created_at', { ascending: false });
    setItems(content || []);

    // Fetch current user's purchases for this gallery
    const { data: purchases } = await supabase
      .from('private_gallery_purchases')
      .select('content_id')
      .eq('buyer_id', currentUserId);
    const pIds = new Set((purchases || []).map(p => p.content_id));
    setPurchasedIds(pIds);

    setLoading(false);
  }, [targetProfile.id, currentUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePay = async (item: GalleryContent) => {
    setProcessingId(item.id);
    try {
      const { error } = await supabase.from('private_gallery_purchases').insert({
        buyer_id: currentUserId,
        content_id: item.id,
        amount: item.amount,
      });
      if (error) throw error;
      setPurchasedIds(prev => new Set([...prev, item.id]));
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    }
    setProcessingId(null);
  };

  if (loading) return (
    <div className="h-full bg-[#fdf8f5] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#fdf8f5] overflow-y-auto pb-40">
      <header className="p-6 bg-white flex items-center gap-4 sticky top-0 z-40 shadow-sm border-b border-orange-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter">Private gallery</h2>
          <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest mt-0.5">@{targetProfile.username}'s collection</p>
        </div>
      </header>

      <div className="p-6">
        {!hasSetup || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
            <svg className="w-14 h-14 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="font-black uppercase text-xs tracking-widest">Gallery is empty</p>
            <p className="text-[10px] font-medium mt-1">This user hasn't added any content yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => {
              const isPaid = purchasedIds.has(item.id);
              return (
                <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-orange-50">
                  <div className="relative aspect-[16/9] bg-gray-100">
                    {item.type === 'image' ? (
                      <img
                        src={item.file_url}
                        className={`w-full h-full object-cover transition-all duration-700 ${!isPaid ? 'blur-[40px] brightness-50 scale-110' : ''}`}
                        alt={item.head_note}
                      />
                    ) : (
                      <video
                        src={item.file_url}
                        className={`w-full h-full object-cover transition-all duration-700 ${!isPaid ? 'blur-[40px] brightness-50 scale-110' : ''}`}
                        controls={isPaid}
                        muted={!isPaid}
                      />
                    )}
                    {!isPaid && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className="bg-black/60 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-sm">
                        {item.type}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-sm font-black text-gray-800 mb-3 line-clamp-2">{item.head_note}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-600">₹{item.amount}</span>
                      {isPaid ? (
                        <button
                          className="px-6 py-2 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest"
                        >
                          View
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePay(item)}
                          disabled={processingId === item.id}
                          className="px-6 py-2 bg-purple-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform flex items-center gap-1.5 min-w-[120px] justify-center"
                        >
                          {processingId === item.id
                            ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : 'Pay & watch'
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivateGalleryView;
