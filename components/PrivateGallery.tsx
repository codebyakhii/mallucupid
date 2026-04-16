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
  duration: number | null;
  created_at: string;
}

// ─── TOAST ──────────────────────────────────────────────────────

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'loading'; visible: boolean }> = ({ message, type, visible }) => {
  if (!visible) return null;
  const bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-gray-800';
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] animate-[fadeIn_0.2s_ease-out]">
      <div className={`${bg} text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-medium`}>
        {type === 'loading' && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {type === 'success' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        {type === 'error' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>}
        {message}
      </div>
    </div>
  );
};

// ─── HELPER: Format duration ────────────────────────────────────

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─── HELPER: Get video duration ─────────────────────────────────

const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────

const PrivateGallery: React.FC<PrivateGalleryProps> = ({ currentUser, onBack }) => {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GalleryContent[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading'; visible: boolean }>({ message: '', type: 'success', visible: false });

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
  const [amount, setAmount] = useState('99');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // Edit state
  const [editItem, setEditItem] = useState<GalleryContent | null>(null);
  const [editHeadNote, setEditHeadNote] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'loading') => {
    setToast({ message, type, visible: true });
    if (type !== 'loading') {
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2200);
    }
  }, []);

  // Count helpers
  const imageCount = items.filter(i => i.type === 'image').length;
  const videoCount = items.filter(i => i.type === 'video').length;

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
      setItems((content || []).map((c: any) => ({ ...c, duration: c.duration ?? null })));
    }
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSetupSubmit = async () => {
    if (!setupForm.terms_accepted) return;
    if (!setupForm.account_holder_name.trim() || !setupForm.account_number.trim() || !setupForm.ifsc_code.trim() || !setupForm.bank_name.trim()) {
      showToast('Please fill all bank details', 'error');
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
      showToast('Gallery setup complete', 'success');
    } catch (err: any) {
      showToast(err.message || 'Setup failed', 'error');
    }
    setSetupLoading(false);
  };

  const handleFileSelect = (type: 'image' | 'video') => {
    if (type === 'image' && imageCount >= 15) {
      showToast('Maximum 15 images allowed', 'error');
      return;
    }
    if (type === 'video' && videoCount >= 5) {
      showToast('Maximum 5 videos allowed', 'error');
      return;
    }
    setUploadType(type);
    setUploadFile(null);
    setUploadPreview('');
    setHeadNote('');
    setAmount('99');
    setUploadProgress(0);
    setVideoDuration(null);
    setShowUploadModal(true);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Validate file type
    if (uploadType === 'image') {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        showToast('Use jpg, png, or webp format', 'error');
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast('Image too large (max 15MB)', 'error');
        return;
      }
    } else {
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov)$/i)) {
        showToast('Use mp4, webm, or mov format', 'error');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        showToast('Video too large (max 100MB)', 'error');
        return;
      }
      // Auto-detect video duration
      const dur = await getVideoDuration(file);
      setVideoDuration(dur);
    }

    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!uploadFile || !headNote.trim()) return;

    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount < 30 || parsedAmount > 9999) {
      showToast('Price must be between ₹30 and ₹9999', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const ext = uploadFile.name.split('.').pop() || 'bin';
      const path = `${currentUser.id}/${Date.now()}.${ext}`;

      // Upload with progress tracking via XMLHttpRequest
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/private-gallery/${path}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('x-upsert', 'false');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const resp = JSON.parse(xhr.responseText);
              reject(new Error(resp.message || resp.error || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));

        xhr.send(uploadFile);
      });

      const { data: urlData } = supabase.storage.from('private-gallery').getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const insertData: any = {
        owner_id: currentUser.id,
        type: uploadType,
        file_url: fileUrl,
        head_note: headNote.trim().slice(0, 100),
        amount: parsedAmount,
      };
      if (uploadType === 'video' && videoDuration) {
        insertData.duration = Math.round(videoDuration);
      }

      const { error: dbError } = await supabase.from('private_gallery_content').insert(insertData);
      if (dbError) throw dbError;

      setShowUploadModal(false);
      setUploadFile(null);
      setUploadPreview('');
      setHeadNote('');
      setAmount('99');
      setUploadProgress(0);
      setVideoDuration(null);
      fetchData();
      showToast('Content uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const item = items.find(i => i.id === deleteConfirmId);
      if (item) {
        // Delete from storage
        try {
          const bucketUrl = supabase.storage.from('private-gallery').getPublicUrl('').data.publicUrl;
          const filePath = item.file_url.replace(bucketUrl, '');
          if (filePath) await supabase.storage.from('private-gallery').remove([filePath]);
        } catch {}
      }
      await supabase.from('private_gallery_content').delete().eq('id', deleteConfirmId);
      setItems(prev => prev.filter(i => i.id !== deleteConfirmId));
      showToast('Deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
    setDeleteConfirmId(null);
    setDeleting(false);
  };

  const handleEditOpen = (item: GalleryContent) => {
    setEditItem(item);
    setEditHeadNote(item.head_note);
    setEditAmount(String(item.amount));
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    const parsedAmount = parseInt(editAmount);
    if (isNaN(parsedAmount) || parsedAmount < 30 || parsedAmount > 9999) {
      showToast('Price must be between ₹30 and ₹9999', 'error');
      return;
    }
    if (!editHeadNote.trim()) {
      showToast('Head note is required', 'error');
      return;
    }

    setEditSaving(true);
    try {
      const { error } = await supabase.from('private_gallery_content').update({
        head_note: editHeadNote.trim().slice(0, 100),
        amount: parsedAmount,
      }).eq('id', editItem.id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, head_note: editHeadNote.trim().slice(0, 100), amount: parsedAmount } : i));
      setEditItem(null);
      showToast('Updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
    setEditSaving(false);
  };

  // ── AMOUNT INPUT HANDLER ──
  const handleAmountChange = (val: string, setter: (v: string) => void) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (cleaned === '' || (parseInt(cleaned) <= 9999)) {
      setter(cleaned);
    }
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
        <Toast {...toast} />
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
                type="text" value={setupForm.account_holder_name}
                onChange={(e) => setSetupForm({ ...setupForm, account_holder_name: e.target.value })}
                placeholder="Full name as on bank account"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Account number</label>
              <input
                type="text" value={setupForm.account_number}
                onChange={(e) => setSetupForm({ ...setupForm, account_number: e.target.value.replace(/\D/g, '') })}
                placeholder="Enter account number"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">IFSC code</label>
              <input
                type="text" value={setupForm.ifsc_code}
                onChange={(e) => setSetupForm({ ...setupForm, ifsc_code: e.target.value.toUpperCase().slice(0, 11) })}
                placeholder="e.g. SBIN0001234"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300 uppercase"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Bank name</label>
              <input
                type="text" value={setupForm.bank_name}
                onChange={(e) => setSetupForm({ ...setupForm, bank_name: e.target.value })}
                placeholder="e.g. State Bank of India"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 px-2 cursor-pointer">
            <input
              type="checkbox" checked={setupForm.terms_accepted}
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
            className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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
      <Toast {...toast} />
      <header className="p-6 bg-white border-b border-orange-100 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-none">Private gallery</h1>
            <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mt-1">
              {imageCount}/15 photos • {videoCount}/5 videos
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-40 p-6">
        {/* Upload buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => handleFileSelect('image')}
            disabled={imageCount >= 15}
            className="aspect-[2/1] bg-white border-2 border-dashed border-purple-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-purple-400 active:scale-95 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Add photo</span>
            <span className="text-[8px] font-bold text-gray-400">{imageCount}/15</span>
          </button>
          <button
            onClick={() => handleFileSelect('video')}
            disabled={videoCount >= 5}
            className="aspect-[2/1] bg-white border-2 border-dashed border-purple-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-purple-400 active:scale-95 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Add video</span>
            <span className="text-[8px] font-bold text-gray-400">{videoCount}/5</span>
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
                <div className={`relative bg-gray-100 ${item.type === 'image' ? 'aspect-[4/5]' : 'aspect-[9/16] max-h-[400px]'}`}>
                  {item.type === 'image' ? (
                    <img src={item.file_url} className="w-full h-full object-cover" alt={item.head_note} />
                  ) : (
                    <video src={item.file_url} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="bg-black/60 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-sm">
                      {item.type}
                    </span>
                    {item.type === 'video' && item.duration != null && item.duration > 0 && (
                      <span className="bg-black/60 text-white text-[8px] font-black px-3 py-1 rounded-full backdrop-blur-sm">
                        {formatDuration(item.duration)}
                      </span>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={() => handleEditOpen(item)}
                      className="w-8 h-8 bg-white/90 text-gray-700 rounded-full flex items-center justify-center shadow-lg active:scale-75 transition-transform backdrop-blur-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-75 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
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
        accept={uploadType === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' : 'image/jpeg,image/png,image/webp'}
        onChange={handleFileChange}
      />

      {/* ══ UPLOAD MODAL ══ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !uploading && setShowUploadModal(false)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Add {uploadType}</h3>
                <button onClick={() => !uploading && setShowUploadModal(false)} className="text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* File preview area — Instagram dimensions */}
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors ${
                  uploadType === 'image' ? 'aspect-[4/5]' : 'aspect-[9/16] max-h-[350px]'
                }`}
              >
                {uploadPreview ? (
                  uploadType === 'image'
                    ? <img src={uploadPreview} className="w-full h-full object-cover" />
                    : <video src={uploadPreview} className="w-full h-full object-cover" muted />
                ) : (
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tap to select {uploadType}</span>
                    <p className="text-[8px] text-gray-300 mt-1">
                      {uploadType === 'image' ? '1080 × 1350 (Instagram photo)' : '1080 × 1920 (Instagram Reels)'}
                    </p>
                  </div>
                )}
              </div>

              {/* Video duration display */}
              {uploadType === 'video' && videoDuration != null && videoDuration > 0 && (
                <div className="flex items-center gap-2 bg-purple-50 px-4 py-2.5 rounded-xl">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs font-bold text-purple-600">Duration: {formatDuration(videoDuration)}</span>
                </div>
              )}

              {/* Head note */}
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-1.5 block">Head note <span className="text-gray-300">({headNote.length}/100)</span></label>
                <input
                  type="text" value={headNote}
                  onChange={(e) => setHeadNote(e.target.value.slice(0, 100))}
                  placeholder="Describe your content..."
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
                />
              </div>

              {/* Price — text input */}
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-1.5 block">Price (INR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value, setAmount)}
                    placeholder="30 - 9999"
                    className="w-full px-5 py-3.5 pl-9 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
                  />
                </div>
                <p className="text-[8px] text-gray-400 mt-1.5">Minimum ₹30 • Maximum ₹9,999</p>
              </div>

              {/* Upload progress bar */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Uploading</span>
                    <span className="text-sm font-black text-purple-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!uploadFile || !headNote.trim() || uploading || !amount || parseInt(amount) < 30 || parseInt(amount) > 9999}
                className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading {uploadProgress}%</>
                ) : (
                  'Post content'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT MODAL ══ */}
      {editItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !editSaving && setEditItem(null)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Edit content</h3>
              <button onClick={() => !editSaving && setEditItem(null)} className="text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className={`w-full bg-gray-100 rounded-2xl overflow-hidden ${editItem.type === 'image' ? 'aspect-[4/5]' : 'aspect-[9/16] max-h-[250px]'}`}>
              {editItem.type === 'image' ? (
                <img src={editItem.file_url} className="w-full h-full object-cover" />
              ) : (
                <video src={editItem.file_url} className="w-full h-full object-cover" controls />
              )}
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 mb-1.5 block">Head note <span className="text-gray-300">({editHeadNote.length}/100)</span></label>
              <input
                type="text" value={editHeadNote}
                onChange={(e) => setEditHeadNote(e.target.value.slice(0, 100))}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm outline-none focus:border-purple-400 transition-colors"
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 mb-1.5 block">Price (INR)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editAmount}
                  onChange={(e) => handleAmountChange(e.target.value, setEditAmount)}
                  className="w-full px-5 py-3.5 pl-9 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm outline-none focus:border-purple-400 transition-colors"
                />
              </div>
              <p className="text-[8px] text-gray-400 mt-1.5">Minimum ₹30 • Maximum ₹9,999</p>
            </div>

            <button
              onClick={handleEditSave}
              disabled={editSaving || !editHeadNote.trim() || !editAmount || parseInt(editAmount) < 30 || parseInt(editAmount) > 9999}
              className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {editSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRMATION MODAL ══ */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete this content?</h3>
            <p className="text-sm text-gray-500 mb-6">This will permanently remove the content and it cannot be recovered.</p>
            <div className="space-y-2.5">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateGallery;
