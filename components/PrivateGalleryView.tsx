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
  bundle_urls: string[];
  bundle_count: number;
  head_note: string;
  amount: number;
  duration: number | null;
  created_at: string;
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const PrivateGalleryView: React.FC<PrivateGalleryViewProps> = ({ targetProfile, currentUserId, onBack }) => {
  const [items, setItems] = useState<GalleryContent[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [hasSetup, setHasSetup] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');

  // Secure viewer state
  const [viewerItem, setViewerItem] = useState<GalleryContent | null>(null);
  const [viewerIdx, setViewerIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerTouchRef = useRef<{ x: number; y: number } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: setup } = await supabase.from('private_gallery_setup').select('id').eq('user_id', targetProfile.id).maybeSingle();
    setHasSetup(!!setup);

    const { data: content } = await supabase.from('private_gallery_content').select('*').eq('owner_id', targetProfile.id).order('created_at', { ascending: false });
    setItems((content || []).map((c: any) => ({
      ...c,
      bundle_urls: c.bundle_urls || [],
      bundle_count: c.bundle_count || (c.bundle_urls?.length ? c.bundle_urls.length + 1 : 1),
      duration: c.duration ?? null,
    })));

    const { data: purchases } = await supabase.from('private_gallery_purchases').select('content_id').eq('buyer_id', currentUserId);
    setPurchasedIds(new Set((purchases || []).map(p => p.content_id)));
    setLoading(false);
  }, [targetProfile.id, currentUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Screenshot / Screen Recording Prevention ─────
  useEffect(() => {
    const handleVisibility = () => setBlurred(document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);

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
        buyer_id: currentUserId, content_id: item.id, amount: item.amount,
      });
      if (error) throw error;
      setPurchasedIds(prev => new Set([...prev, item.id]));
    } catch (err: any) { alert(err.message || 'Payment failed'); }
    setProcessingId(null);
  };

  const preventContext = (e: React.MouseEvent) => { e.preventDefault(); };
  const getViewerUrls = (item: GalleryContent): string[] => [item.file_url, ...(item.bundle_urls || [])];

  const imageCount = items.filter(i => i.type === 'image').length;
  const videoCount = items.filter(i => i.type === 'video').length;
  const filteredItems = filter === 'all' ? items : items.filter(i => i.type === filter);

  if (loading) return (
    <div className="h-full bg-[#fdf8f5] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-[#fdf8f5] overflow-hidden"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
      onContextMenu={preventContext}>

      {/* Header */}
      <header className="px-5 py-4 bg-white flex items-center gap-3 sticky top-0 z-40 shadow-sm border-b border-orange-100 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 -ml-2 text-gray-400 active:scale-75 transition-transform">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h2 className="text-lg font-black uppercase tracking-tighter">Private gallery</h2>
          <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mt-0.5">@{targetProfile.username}'s collection</p>
        </div>
      </header>

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-50 flex-shrink-0">
          {(['all', 'image', 'video'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${filter === f ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
              {f === 'all' ? 'All' : f === 'image' ? `Photos (${imageCount})` : `Videos (${videoCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Content Protected overlay */}
      {blurred && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
            </div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Content Protected</p>
            <p className="text-white/50 text-xs mt-2">Return to the app to view</p>
          </div>
        </div>
      )}

      {/* Content grid - 2 columns */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-28">
        {!hasSetup || filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center opacity-40 mt-8">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="font-black uppercase text-[10px] tracking-widest">Gallery is empty</p>
            <p className="text-[9px] font-medium mt-1">This user hasn't added any content yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredItems.map(item => {
              const isPaid = purchasedIds.has(item.id);
              return (
                <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-orange-50"
                  onClick={() => { if (isPaid) { setViewerItem(item); setViewerIdx(0); } }}
                  onContextMenu={preventContext}>
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-gray-100">
                    {item.type === 'image' ? (
                      <img src={item.file_url} draggable={false}
                        className={`w-full h-full object-cover transition-all duration-700 ${!isPaid ? 'blur-[30px] brightness-50 scale-110' : ''}`}
                        alt="" style={{ pointerEvents: 'none', WebkitUserDrag: 'none' } as React.CSSProperties} />
                    ) : (
                      <video src={item.file_url} muted
                        className={`w-full h-full object-cover transition-all duration-700 ${!isPaid ? 'blur-[30px] brightness-50 scale-110' : ''}`}
                        onContextMenu={preventContext} />
                    )}
                    {/* Type badge */}
                    <div className="absolute top-1.5 left-1.5">
                      <span className="bg-black/60 text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {item.type}
                      </span>
                    </div>
                    {/* Bundle count */}
                    {item.type === 'image' && item.bundle_count > 1 && (
                      <div className="absolute top-1.5 right-1.5">
                        <span className="bg-blue-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full">{item.bundle_count} 📷</span>
                      </div>
                    )}
                    {/* Video duration */}
                    {item.type === 'video' && item.duration != null && item.duration > 0 && (
                      <div className="absolute bottom-1.5 right-1.5">
                        <span className="bg-black/70 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">{formatDuration(item.duration)}</span>
                      </div>
                    )}
                    {/* Lock overlay for unpaid */}
                    {!isPaid && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-[11px] font-bold text-gray-800 truncate leading-tight">{item.head_note}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] font-black text-purple-600">₹{item.amount}</span>
                      {isPaid ? (
                        <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase">Unlocked</span>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handlePay(item); }} disabled={processingId === item.id}
                          className="px-3 py-1 bg-purple-600 text-white rounded-full text-[8px] font-black uppercase active:scale-95 transition-transform flex items-center gap-1 min-w-[70px] justify-center">
                          {processingId === item.id ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Pay & view'}
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

      {/* ══ SECURE VIEWER (paid content) ══ */}
      {viewerItem && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
          onContextMenu={(e) => e.preventDefault()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 z-10 flex-shrink-0">
            <button onClick={() => { setViewerItem(null); setViewerIdx(0); }}
              className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            {viewerItem.type === 'image' && viewerItem.bundle_count > 1 && (
              <span className="text-white/60 text-xs font-bold">{viewerIdx + 1} / {getViewerUrls(viewerItem).length}</span>
            )}
            <div className="w-10" />
          </div>
          {/* Content */}
          <div className="flex-1 flex items-center justify-center px-4 overflow-hidden"
            onTouchStart={(e) => { viewerTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
            onTouchEnd={(e) => {
              if (!viewerTouchRef.current || viewerItem.bundle_count <= 1) return;
              const dx = e.changedTouches[0].clientX - viewerTouchRef.current.x;
              const urls = getViewerUrls(viewerItem);
              if (dx < -50) setViewerIdx(prev => Math.min(urls.length - 1, prev + 1));
              else if (dx > 50) setViewerIdx(prev => Math.max(0, prev - 1));
              viewerTouchRef.current = null;
            }}>
            {viewerItem.type === 'image' ? (
              <img src={getViewerUrls(viewerItem)[viewerIdx]} className="max-w-full max-h-full object-contain" alt="" draggable={false}
                style={{ pointerEvents: 'none' } as React.CSSProperties}
                onClick={(e) => {
                  if (viewerItem.bundle_count <= 1) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const urls = getViewerUrls(viewerItem);
                  const tapX = e.clientX - rect.left;
                  if (tapX < rect.width * 0.4) setViewerIdx(prev => Math.max(0, prev - 1));
                  else if (tapX > rect.width * 0.6) setViewerIdx(prev => Math.min(urls.length - 1, prev + 1));
                }}
              />
            ) : (
              <video src={viewerItem.file_url} className="max-w-full max-h-full" controls controlsList="nodownload noremoteplayback"
                disablePictureInPicture playsInline autoPlay onContextMenu={(e) => e.preventDefault()} />
            )}
          </div>
          {/* Bundle dots */}
          {viewerItem.type === 'image' && viewerItem.bundle_count > 1 && (
            <div className="flex justify-center gap-1.5 py-4 flex-shrink-0">
              {getViewerUrls(viewerItem).map((_, i) => (
                <button key={i} onClick={() => setViewerIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === viewerIdx ? 'bg-white scale-125' : 'bg-white/30'}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrivateGalleryView;
