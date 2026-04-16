import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface PrivateGalleryProps {
  currentUser: Profile;
  onBack: () => void;
}

interface GallerySetup {
  id: string;
  name: string;
  dob: string;
  email: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
}

interface GalleryContent {
  id: string;
  type: 'image' | 'video';
  file_url: string;
  head_note: string;
  amount: number;
  created_at: string;
}

const PrivateGallery: React.FC<PrivateGalleryProps> = ({ currentUser, onBack }) => {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GalleryContent[]>([]);

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    name: currentUser.name || '',
    dob: currentUser.dob || '',
    email: currentUser.email || '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    bank_name: '',
    terms_accepted: false,
  });
  const [setupLoading, setSetupLoading] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [headNote, setHeadNote] = useState('');
  const [amount, setAmount] = useState(99);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check setup status + fetch content
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: setup } = await supabase
      .from('private_gallery_setup')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    setIsSetup(!!setup);

    if (setup) {
      const { data: content } = await supabase
        .from('private_gallery_content')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false });
      setItems(content || []);
    }
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSetupSubmit = async () => {
    if (!setupForm.terms_accepted) return;
    if (!setupForm.account_holder_name.trim() || !setupForm.account_number.trim() || !setupForm.ifsc_code.trim() || !setupForm.bank_name.trim()) {
      alert('Please fill all bank details');
      return;
    }

    setSetupLoading(true);
    try {
      const { error } = await supabase.from('private_gallery_setup').insert({
        user_id: currentUser.id,
        name: setupForm.name,
        dob: setupForm.dob,
        email: setupForm.email,
        account_holder_name: setupForm.account_holder_name.trim(),
        account_number: setupForm.account_number.trim(),
        ifsc_code: setupForm.ifsc_code.trim().toUpperCase(),
        bank_name: setupForm.bank_name.trim(),
        terms_accepted: true,
      });
      if (error) throw error;
      setIsSetup(true);
    } catch (err: any) {
      alert(err.message || 'Setup failed');
    }
    setSetupLoading(false);
  };

  const handleFileSelect = (type: 'image' | 'video') => {
    setUploadType(type);
    setUploadFile(null);
    setUploadPreview('');
    setHeadNote('');
    setAmount(99);
    setShowUploadModal(true);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !headNote.trim()) return;

    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop() || 'bin';
      const path = `${currentUser.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from('private-gallery')
        .upload(path, uploadFile, { upsert: false });
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from('private-gallery').getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from('private_gallery_content').insert({
        owner_id: currentUser.id,
        type: uploadType,
        file_url: fileUrl,
        head_note: headNote.trim().slice(0, 100),
        amount: amount,
      });
      if (dbError) throw dbError;

      setShowUploadModal(false);
      setUploadFile(null);
      setUploadPreview('');
      setHeadNote('');
      setAmount(99);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await supabase.from('private_gallery_content').delete().eq('id', id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {}
    setDeletingId(null);
  };

  if (loading) return (
    <div className="h-full bg-[#fdf8f5] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-[10px] font-black uppercase text-purple-500 tracking-[0.2em]">Loading gallery...</p>
    </div>
  );

  // ─── SETUP FORM ────────────────────────────────
  if (!isSetup) {
    return (
      <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto pb-32">
        <header className="p-6 bg-white border-b border-orange-100 flex items-center gap-4 sticky top-0 z-30 shadow-sm">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Private gallery</h1>
            <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mt-0.5">Setup required</p>
          </div>
        </header>

        <div className="p-6 space-y-5">
          <div className="bg-white rounded-3xl p-6 border border-orange-50 shadow-sm space-y-5">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Your details</h3>

            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Name</label>
              <input type="text" value={setupForm.name} readOnly className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-500 outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Date of birth</label>
              <input type="text" value={setupForm.dob} readOnly className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-500 outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Email</label>
              <input type="text" value={setupForm.email} readOnly className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-500 outline-none" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-orange-50 shadow-sm space-y-5">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Bank details</h3>

            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Account holder name</label>
              <input
                type="text"
                value={setupForm.account_holder_name}
                onChange={(e) => setSetupForm({ ...setupForm, account_holder_name: e.target.value })}
                placeholder="Full name as on bank account"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Account number</label>
              <input
                type="text"
                value={setupForm.account_number}
                onChange={(e) => setSetupForm({ ...setupForm, account_number: e.target.value.replace(/\D/g, '') })}
                placeholder="Enter account number"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">IFSC code</label>
              <input
                type="text"
                value={setupForm.ifsc_code}
                onChange={(e) => setSetupForm({ ...setupForm, ifsc_code: e.target.value.toUpperCase().slice(0, 11) })}
                placeholder="e.g. SBIN0001234"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300 uppercase"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Bank name</label>
              <input
                type="text"
                value={setupForm.bank_name}
                onChange={(e) => setSetupForm({ ...setupForm, bank_name: e.target.value })}
                placeholder="e.g. State Bank of India"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 px-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setupForm.terms_accepted}
              onChange={(e) => setSetupForm({ ...setupForm, terms_accepted: e.target.checked })}
              className="mt-0.5 w-5 h-5 accent-purple-600 rounded"
            />
            <span className="text-xs font-medium text-gray-600 leading-relaxed">
              I accept the <span className="font-black text-gray-800">terms & policies</span> for creating a private gallery on Mallu Cupid
            </span>
          </label>

          <button
            onClick={handleSetupSubmit}
            disabled={!setupForm.terms_accepted || !setupForm.account_holder_name.trim() || !setupForm.account_number.trim() || !setupForm.ifsc_code.trim() || !setupForm.bank_name.trim() || setupLoading}
            className="w-full py-4.5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {setupLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Submit'}
          </button>
        </div>
      </div>
    );
  }

  // ─── GALLERY MANAGEMENT (POST-SETUP) ──────────────
  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-hidden">
      <header className="p-6 bg-white border-b border-orange-100 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-none">Private gallery</h1>
            <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mt-1">Owner mode • {items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-40 p-6">
        {/* Upload buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => handleFileSelect('image')}
            className="aspect-[2/1] bg-white border-2 border-dashed border-purple-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-purple-400 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Add photo</span>
          </button>
          <button
            onClick={() => handleFileSelect('video')}
            className="aspect-[2/1] bg-white border-2 border-dashed border-purple-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-purple-400 active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Add video</span>
          </button>
        </div>

        {/* Content grid */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center opacity-40">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="font-black uppercase text-xs tracking-widest">No content yet</p>
            <p className="text-[10px] font-medium mt-1">Add photos or videos to start earning</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-orange-50">
                <div className="relative aspect-[16/9] bg-gray-100">
                  {item.type === 'image' ? (
                    <img src={item.file_url} className="w-full h-full object-cover" alt={item.head_note} />
                  ) : (
                    <video src={item.file_url} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="bg-black/60 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-sm">
                      {item.type}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="absolute top-3 right-3 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-75 transition-transform"
                  >
                    {deletingId === item.id
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    }
                  </button>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-800 truncate">{item.head_note}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="bg-purple-50 text-purple-600 text-xs font-black px-4 py-1.5 rounded-full ml-3 whitespace-nowrap">
                    ₹{item.amount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={uploadType === 'video' ? 'video/*' : 'image/*'}
        onChange={handleFileChange}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !uploading && setShowUploadModal(false)} />
          <div className="relative bg-white rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Add {uploadType}</h3>
              <button onClick={() => !uploading && setShowUploadModal(false)} className="text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors"
            >
              {uploadPreview ? (
                uploadType === 'image'
                  ? <img src={uploadPreview} className="w-full h-full object-cover" />
                  : <video src={uploadPreview} className="w-full h-full object-cover" muted />
              ) : (
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tap to select {uploadType}</span>
              )}
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 mb-1.5 block">Head note <span className="text-gray-300">({headNote.length}/100)</span></label>
              <input
                type="text"
                value={headNote}
                onChange={(e) => setHeadNote(e.target.value.slice(0, 100))}
                placeholder="Describe your content..."
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400">Price</label>
                <span className="text-sm font-black text-gray-800">₹{amount}</span>
              </div>
              <input
                type="range" min="29" max="999" step="10"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-[8px] font-bold text-gray-300 mt-1">
                <span>₹29</span>
                <span>₹999</span>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={!uploadFile || !headNote.trim() || uploading}
              className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {uploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</> : 'Post content'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateGallery;
