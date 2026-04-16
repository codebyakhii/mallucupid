import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [blurred, setBlurred] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: setup } = await supabase
      .from('private_gallery_setup')
      .select('id')
      .eq('user_id', targetProfile.id)
      .maybeSingle();
    setHasSetup(!!setup);

    const { data: content } = await supabase
      .from('private_gallery_content')
      .select('*')
      .eq('owner_id', targetProfile.id)
      .order('created_at', { ascending: false });
    setItems(content || []);

    const { data: purchases } = await supabase
      .from('private_gallery_purchases')
      .select('content_id')
      .eq('buyer_id', currentUserId);
    const pIds = new Set((purchases || []).map(p => p.content_id));
    setPurchasedIds(pIds);

    setLoading(false);
  }, [targetProfile.id, currentUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Screenshot / Screen Recording Prevention ─────────────
  useEffect(() => {
    // Blur content when tab loses focus (screen recording / screenshot detection)
    const handleVisibility = () => {
      setBlurred(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Prevent keyboard shortcuts for screenshots
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'))) {
        e.preventDefault();
        setBlurred(true);
        setTimeout(() => setBlurred(false), 1500);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  // Prevent right-click / long-press on media
  const preventContext = (e: React.MouseEvent) => { e.preventDefault(); };

  if (loading) return (
    <div className="h-full bg-[#fdf8f5] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-[#fdf8f5] overflow-y-auto pb-40"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
      onContextMenu={preventContext}
    >
      <header className="p-6 bg-white flex items-center gap-4 sticky top-0 z-40 shadow-sm border-b border-orange-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter">Private gallery</h2>
          <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest mt-0.5">@{targetProfile.username}'s collection</p>
        </div>
      </header>

      {/* Blur overlay when tab loses focus */}
      {blurred && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
            </div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Content Protected</p>
            <p className="text-white/50 text-xs mt-2">Return to the app to view</p>
          </div>
        </div>
      )}

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
                  <div className="relative aspect-[16/9] bg-gray-100" onContextMenu={preventContext}>
                    {item.type === 'image' ? (
                      <img
                        src={item.file_url}
                        className={`w-full h-full object-cover transition-all duration-700 ${!isPaid ? 'blur-[40px] brightness-50 scale-110' : ''}`}
                        alt={item.head_note}
                        draggable={false}
                        style={{ pointerEvents: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
                      />
                    ) : (
                      <video
                        src={item.file_url}
                        className={`w-full h-full object-cover transition-all duration-700 ${!isPaid ? 'blur-[40px] brightness-50 scale-110' : ''}`}
                        controls={isPaid}
                        controlsList="nodownload noremoteplayback"
                        disablePictureInPicture
                        playsInline
                        muted={!isPaid}
                        onContextMenu={preventContext}
                      />
                    )}
                    {/* Transparent shield overlay to intercept screenshot tools on paid content */}
                    {isPaid && (
                      <div className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }} />
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
                        <button className="px-6 py-2 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          Unlocked
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
