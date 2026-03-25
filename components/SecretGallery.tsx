
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SecretContent, Profile } from '../types';

interface SecretGalleryProps {
  isOwner: boolean;
  onBack: () => void;
  targetProfile?: Profile;
}

const SecretGallery: React.FC<SecretGalleryProps> = ({ isOwner, onBack, targetProfile }) => {
  const [items, setItems] = useState<SecretContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'none' | 'image' | 'video'>('none');
  const [formData, setFormData] = useState({ name: '', amount: 189, file: null as File | null, previewUrl: '' });
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    // Demo: no backend, start with empty gallery
    setIsLoading(false);
  }, [targetProfile]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  }, [items, currentPage]);

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ 
        ...formData, 
        file, 
        previewUrl: URL.createObjectURL(file) 
      });
    }
  };

  const handleUpload = async () => {
    if (!formData.file || !formData.name) return;
    
    try {
      setUploadProgress(10);
      // Demo: simulate upload with local preview
      const url = formData.previewUrl || URL.createObjectURL(formData.file);
      await new Promise(r => {
        let p = 10;
        const interval = setInterval(() => { p += 20; setUploadProgress(p); if (p >= 100) { clearInterval(interval); r(null); } }, 200);
      });
      const newItem: SecretContent = { id: `sc-${Date.now()}`, name: formData.name, url, amount: formData.amount, type: uploadType === 'image' ? 'image' : 'video', description: uploadType === 'image' ? '1 Image' : `${(formData.file.size / 1024 / 1024).toFixed(1)} MB` };
      setItems([newItem, ...items]);
      setUploadProgress(0);
      setUploadType('none');
      setFormData({ name: '', amount: 189, file: null, previewUrl: '' });
    } catch (err) {
      console.error('Upload error', err);
      setUploadProgress(0);
      alert('Upload failed');
    }
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  if (isLoading) {
    return (
      <div className="h-full bg-white flex flex-col items-center justify-center p-10 space-y-4">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Syncing Gallery...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-hidden">
      <header className="p-6 bg-white border-b border-orange-100 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-none">Secret Gallery</h1>
            <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mt-1.5">
              {isOwner ? "Owner Mode" : `@${targetProfile?.username}'s Secret Room`}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-40 p-6">
        {isOwner && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
              onClick={() => { setUploadType('image'); setTimeout(() => fileInputRef.current?.click(), 100); }}
              className="aspect-[2/1] bg-white border-2 border-dashed border-red-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-red-400 active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-[9px] font-black uppercase tracking-widest">Add Photo</span>
            </button>
            <button 
              onClick={() => { setUploadType('video'); setTimeout(() => fileInputRef.current?.click(), 100); }}
              className="aspect-[2/1] bg-white border-2 border-dashed border-red-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-red-400 active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z" /></svg>
              <span className="text-[9px] font-black uppercase tracking-widest">Add Video</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {paginatedItems.map((item) => {
            const isUnlocked = isOwner || purchasedIds.includes(item.id);
            return (
              <div key={item.id} className="group flex flex-col gap-2">
                <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden shadow-xl bg-gray-200 border-2 border-white">
                  <img 
                    src={item.url} 
                    className={`w-full h-full object-cover transition-all duration-1000 ${!isUnlocked ? 'blur-[60px] scale-150 brightness-50' : ''}`}
                    alt={item.name}
                  />
                  
                  {isOwner && (
                    <div className="absolute top-4 right-4 z-10">
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="w-8 h-8 bg-[#8B0000] text-white rounded-full flex items-center justify-center shadow-lg active:scale-75 transition-transform"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}

                  {!isUnlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      <div className="w-12 h-12 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-center mb-4 border border-white/20">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <button 
                        onClick={() => {} /* handled via purchase flow */}
                        className="w-full py-3 bg-[#006400] text-white text-[9px] font-black uppercase tracking-widest rounded-2xl shadow-2xl active:scale-95 transition-all"
                      >
                        Unlock ₹{item.amount}
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-1 flex justify-between items-center">
                   <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight truncate">{item.name}</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">{item.metadata}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept={uploadType === 'video' ? 'video/*' : 'image/*'} 
        onChange={handleFileChange} 
      />

      {uploadType !== 'none' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setUploadType('none')} />
          <div className="relative bg-white rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Add to Gallery</h3>
              <button onClick={() => setUploadType('none')} className="text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Gallery Selection Preview Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden flex flex-col items-center justify-center cursor-pointer group hover:border-red-400 transition-colors"
              >
                {formData.previewUrl ? (
                  uploadType === 'image' ? (
                    <img src={formData.previewUrl} className="w-full h-full object-cover" />
                  ) : (
                    <video src={formData.previewUrl} className="w-full h-full object-cover" muted />
                  )
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-400 mb-2 shadow-sm group-hover:text-red-500 transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tap to Select From Gallery</span>
                  </>
                )}
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Content Title</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-sm outline-none uppercase placeholder-gray-300"
                  placeholder="Enter content title..."
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[9px] font-black uppercase text-gray-400">Price</label>
                  <span className="text-[10px] font-black text-gray-800">₹{formData.amount}</span>
                </div>
                <input 
                  type="range" min="49" max="999" step="10"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: parseInt(e.target.value)})}
                  className="w-full accent-red-500"
                />
              </div>
            </div>

            {uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] font-black uppercase text-red-500">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1 bg-red-50 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <button 
              onClick={handleUpload}
              disabled={!formData.file || !formData.name || uploadProgress > 0}
              className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-30"
            >
              Post Content
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretGallery;
