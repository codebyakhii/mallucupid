
import React, { useState, useRef, useEffect } from 'react';
import { SecretContent, Subscriber } from '../types';

interface ExclusiveRoomPageProps {
  onBack: () => void;
}

const ExclusiveRoomPage: React.FC<ExclusiveRoomPageProps> = ({ onBack }) => {
  const [price, setPrice] = useState(399);
  const [tempPrice, setTempPrice] = useState('399');
  const [priceError, setPriceError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [contents, setContents] = useState<SecretContent[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image');
  const [formData, setFormData] = useState({ name: '', file: null as File | null, previewUrl: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Demo: start with empty room data
  }, []);

  const handlePriceUpdate = async () => {
    const numeric = parseInt(tempPrice);
    if (isNaN(numeric) || numeric < 99) {
      setPriceError('Minimum value is ₹99');
      return;
    }
    setPrice(numeric);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const openUploadModal = (type: 'image' | 'video') => {
    setUploadType(type);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFormData({ ...formData, file, previewUrl: URL.createObjectURL(file) });
  };

  const confirmUpload = async () => {
    if (!formData.file || !formData.name) return;
    
    try {
      setUploadProgress(1);
      const fileUrl = formData.previewUrl || URL.createObjectURL(formData.file);
      // Simulate upload progress
      await new Promise(r => {
        let p = 1;
        const interval = setInterval(() => { p += 20; setUploadProgress(p); if (p >= 100) { clearInterval(interval); r(null); } }, 200);
      });
      const newContent: SecretContent = { id: `rc-${Date.now()}`, name: formData.name, url: fileUrl, amount: price, type: uploadType, description: `${(formData.file.size / 1024 / 1024).toFixed(1)} MB ${uploadType}` };
      setContents([newContent, ...contents]);
      setUploadProgress(0);
      setIsModalOpen(false);
      setFormData({ name: '', file: null, previewUrl: '' });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Upload failed');
      setUploadProgress(0);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#fdf8f5] overflow-y-auto pb-40">
      <header className="p-6 bg-white flex items-center gap-4 sticky top-0 z-40 border-b border-orange-50 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-xl font-black uppercase tracking-tighter">Room Manager</h2>
      </header>

      <div className="p-8 space-y-10">
        <section className="bg-black rounded-[2.5rem] p-10 text-white shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-6">Subscription Price</p>
          <div className="flex flex-col gap-4">
            <input 
              type="number" 
              value={tempPrice}
              onChange={(e) => setTempPrice(e.target.value)}
              className="w-full bg-white/10 border-2 border-white/20 rounded-3xl py-5 px-6 text-3xl font-black outline-none"
            />
            {priceError && <p className="text-red-400 text-[10px] font-black uppercase">{priceError}</p>}
            <button onClick={handlePriceUpdate} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] shadow-xl">Update Price</button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => openUploadModal('image')} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-red-100 rounded-[2.5rem] gap-3 text-red-500">
            <span className="text-[10px] font-black uppercase tracking-widest">Add Image</span>
          </button>
          <button onClick={() => openUploadModal('video')} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-red-100 rounded-[2.5rem] gap-3 text-red-500">
            <span className="text-[10px] font-black uppercase tracking-widest">Add Video</span>
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Subscribers ({subscribers.length})</h3>
          <div className="space-y-3">
            {subscribers.length === 0 ? <p className="text-center py-10 opacity-30 text-[10px] font-black uppercase">No subscribers yet</p> : subscribers.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-[2rem] border border-orange-50 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <img src={s.imageUrl} className="w-10 h-10 rounded-full object-cover" />
                  <p className="text-[10px] font-black uppercase tracking-widest">@{s.username}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept={uploadType === 'video' ? 'video/*' : 'image/*'} onChange={handleFileChange} />

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 space-y-6">
            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Add to Room</h3>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-sm outline-none uppercase"
              placeholder="Content Name"
            />
            <button onClick={confirmUpload} className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">Post Content</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExclusiveRoomPage;
