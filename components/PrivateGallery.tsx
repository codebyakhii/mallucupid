import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface PrivateGalleryProps {
  currentUser: Profile;
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

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'loading'; visible: boolean }> = ({ message, type, visible }) => {
  if (!visible) return null;
  const bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-gray-800';
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999]">
      <div className={`${bg} text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-medium`}>
        {type === 'loading' && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {type === 'success' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        {type === 'error' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>}
        {message}
      </div>
    </div>
  );
};

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
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
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [showFabMenu, setShowFabMenu] = useState(false);

  // Setup form
  const [setupForm, setSetupForm] = useState({
    name: currentUser.name || '', dob: currentUser.dob || '', email: currentUser.email || '',
    account_holder_name: '', account_number: '', ifsc_code: '', bank_name: '', terms_accepted: false,
  });
  const [setupLoading, setSetupLoading] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
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

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Viewer state (owner views own content)
  const [viewerItem, setViewerItem] = useState<GalleryContent | null>(null);
  const [viewerIdx, setViewerIdx] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'loading') => {
    setToast({ message, type, visible: true });
    if (type !== 'loading') setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2200);
  }, []);

  const imageCount = items.filter(i => i.type === 'image').length;
  const videoCount = items.filter(i => i.type === 'video').length;
  const filteredItems = filter === 'all' ? items : items.filter(i => i.type === filter);

  // ─── FETCH DATA ──────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: setup } = await supabase.from('private_gallery_setup').select('*').eq('user_id', currentUser.id).maybeSingle();
    setIsSetup(!!setup);
    if (setup) {
      const { data: content } = await supabase.from('private_gallery_content').select('*').eq('owner_id', currentUser.id).order('created_at', { ascending: false });
      setItems((content || []).map((c: any) => ({
        ...c,
        bundle_urls: c.bundle_urls || [],
        bundle_count: c.bundle_count || (c.bundle_urls?.length ? c.bundle_urls.length + 1 : 1),
        duration: c.duration ?? null,
      })));
    }
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── SETUP ────────────────────────────────────────
  const handleSetupSubmit = async () => {
    if (!setupForm.terms_accepted) return;
    if (!setupForm.account_holder_name.trim() || !setupForm.account_number.trim() || !setupForm.ifsc_code.trim() || !setupForm.bank_name.trim()) {
      showToast('Please fill all bank details', 'error'); return;
    }
    setSetupLoading(true);
    try {
      const { error } = await supabase.from('private_gallery_setup').insert({
        user_id: currentUser.id, name: setupForm.name, dob: setupForm.dob, email: setupForm.email,
        account_holder_name: setupForm.account_holder_name.trim(), account_number: setupForm.account_number.trim(),
        ifsc_code: setupForm.ifsc_code.trim().toUpperCase(), bank_name: setupForm.bank_name.trim(), terms_accepted: true,
      });
      if (error) throw error;
      setIsSetup(true);
      showToast('Gallery setup complete', 'success');
    } catch (err: any) { showToast(err.message || 'Setup failed', 'error'); }
    setSetupLoading(false);
  };

  // ─── FILE SELECT (from FAB) ───────────────────────
  const handleOpenUpload = (type: 'image' | 'video') => {
    if (type === 'image' && imageCount >= 15) { showToast('Maximum 15 images allowed', 'error'); return; }
    if (type === 'video' && videoCount >= 5) { showToast('Maximum 5 videos allowed', 'error'); return; }
    setUploadType(type);
    setUploadFiles([]);
    setUploadPreviews([]);
    setHeadNote('');
    setAmount('99');
    setUploadProgress(0);
    setVideoDuration(null);
    setShowFabMenu(false);
    setShowUploadModal(true);
    setTimeout(() => fileInputRef.current?.click(), 200);
  };

  // ─── FILE CHANGE (supports multiple for images) ───
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (uploadType === 'image') {
      const maxAdd = 15 - uploadFiles.length;
      const toAdd = files.slice(0, maxAdd);
      const validFiles: File[] = [];
      const validPreviews: string[] = [];
      for (const file of toAdd) {
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) continue;
        if (file.size > 15 * 1024 * 1024) continue;
        validFiles.push(file);
        validPreviews.push(URL.createObjectURL(file));
      }
      if (validFiles.length === 0) { showToast('Invalid image files', 'error'); return; }
      setUploadFiles(prev => [...prev, ...validFiles]);
      setUploadPreviews(prev => [...prev, ...validPreviews]);
    } else {
      const file = files[0];
      if (!file) return;
      if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) && !file.name.match(/\.(mp4|webm|mov)$/i)) {
        showToast('Use mp4, webm, or mov format', 'error'); return;
      }
      if (file.size > 100 * 1024 * 1024) { showToast('Video too large (max 100MB)', 'error'); return; }
      const dur = await getVideoDuration(file);
      setVideoDuration(dur);
      setUploadFiles([file]);
      setUploadPreviews([URL.createObjectURL(file)]);
    }
  };

  const handleRemoveFile = (idx: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== idx));
    setUploadPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
  };

  const handleAddMoreFiles = () => {
    if (uploadFiles.length >= 15) { showToast('Maximum 15 photos per bundle', 'error'); return; }
    fileInputRef.current?.click();
  };

  // ─── UPLOAD (bundle-aware) ────────────────────────
  const uploadSingleFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/private-gallery/${path}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
      xhr.onload = () => { xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')); };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });
    const { data: urlData } = supabase.storage.from('private-gallery').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0 || !headNote.trim()) return;
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount < 30 || parsedAmount > 9999) {
      showToast('Price must be between ₹30 and ₹9999', 'error'); return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      if (uploadType === 'image') {
        // Upload all images
        const urls: string[] = [];
        for (let i = 0; i < uploadFiles.length; i++) {
          setUploadProgress(Math.round(((i) / uploadFiles.length) * 100));
          const url = await uploadSingleFile(uploadFiles[i]);
          urls.push(url);
        }
        setUploadProgress(100);

        const mainUrl = urls[0];
        const bundleUrls = urls.length > 1 ? urls.slice(1) : [];
        const { error } = await supabase.from('private_gallery_content').insert({
          owner_id: currentUser.id, type: 'image', file_url: mainUrl,
          bundle_urls: bundleUrls, bundle_count: urls.length,
          head_note: headNote.trim().slice(0, 100), amount: parsedAmount,
        });
        if (error) throw error;
      } else {
        // Single video upload
        const url = await uploadSingleFile(uploadFiles[0]);
        const insertData: any = {
          owner_id: currentUser.id, type: 'video', file_url: url,
          bundle_urls: [], bundle_count: 1,
          head_note: headNote.trim().slice(0, 100), amount: parsedAmount,
        };
        if (videoDuration) insertData.duration = Math.round(videoDuration);
        const { error } = await supabase.from('private_gallery_content').insert(insertData);
        if (error) throw error;
      }

      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadPreviews(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
      setHeadNote('');
      setAmount('99');
      fetchData();
      showToast('Content uploaded', 'success');
    } catch (err: any) { showToast(err.message || 'Upload failed', 'error'); }
    setUploading(false);
  };

  // ─── DELETE ───────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const item = items.find(i => i.id === deleteConfirmId);
      if (item) {
        try {
          const bucketUrl = supabase.storage.from('private-gallery').getPublicUrl('').data.publicUrl;
          const paths = [item.file_url, ...(item.bundle_urls || [])].map(u => u.replace(bucketUrl, '')).filter(Boolean);
          if (paths.length) await supabase.storage.from('private-gallery').remove(paths);
        } catch {}
      }
      await supabase.from('private_gallery_content').delete().eq('id', deleteConfirmId);
      setItems(prev => prev.filter(i => i.id !== deleteConfirmId));
      showToast('Deleted', 'success');
    } catch (err: any) { showToast(err.message || 'Delete failed', 'error'); }
    setDeleteConfirmId(null);
    setDeleting(false);
  };

  // ─── EDIT ─────────────────────────────────────────
  const handleEditOpen = (item: GalleryContent) => {
    setEditItem(item); setEditHeadNote(item.head_note); setEditAmount(String(item.amount));
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    const parsedAmount = parseInt(editAmount);
    if (isNaN(parsedAmount) || parsedAmount < 30 || parsedAmount > 9999) { showToast('Price: ₹30–₹9999', 'error'); return; }
    if (!editHeadNote.trim()) { showToast('Head note required', 'error'); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.from('private_gallery_content').update({ head_note: editHeadNote.trim().slice(0, 100), amount: parsedAmount }).eq('id', editItem.id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, head_note: editHeadNote.trim().slice(0, 100), amount: parsedAmount } : i));
      setEditItem(null);
      showToast('Updated', 'success');
    } catch (err: any) { showToast(err.message || 'Update failed', 'error'); }
    setEditSaving(false);
  };

  const handleAmountChange = (val: string, setter: (v: string) => void) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (cleaned === '' || parseInt(cleaned) <= 9999) setter(cleaned);
  };

  // ─── VIEWER: get all URLs for a content item ──────
  const getViewerUrls = (item: GalleryContent): string[] => {
    return [item.file_url, ...(item.bundle_urls || [])];
  };

  // ════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════

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
        <header className="p-5 bg-white border-b border-orange-100 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-75 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Private gallery</h1>
            <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mt-0.5">Setup required</p>
          </div>
        </header>

        <div className="p-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-orange-50 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Your details</h3>
            {[{ label: 'Name', value: setupForm.name }, { label: 'Date of birth', value: setupForm.dob }, { label: 'Email', value: setupForm.email }].map(f => (
              <div key={f.label}>
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block">{f.label}</label>
                <input type="text" value={f.value} readOnly className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-500 outline-none" />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-orange-50 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Bank details</h3>
            {[
              { key: 'account_holder_name', label: 'Account holder name', placeholder: 'Full name as on bank account' },
              { key: 'account_number', label: 'Account number', placeholder: 'Enter account number' },
              { key: 'ifsc_code', label: 'IFSC code', placeholder: 'e.g. SBIN0001234' },
              { key: 'bank_name', label: 'Bank name', placeholder: 'e.g. State Bank of India' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block">{f.label}</label>
                <input
                  type="text"
                  value={(setupForm as any)[f.key]}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (f.key === 'account_number') val = val.replace(/\D/g, '');
                    if (f.key === 'ifsc_code') val = val.toUpperCase().slice(0, 11);
                    setSetupForm(prev => ({ ...prev, [f.key]: val }));
                  }}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300"
                />
              </div>
            ))}
          </div>

          <label className="flex items-start gap-3 px-1 cursor-pointer">
            <input type="checkbox" checked={setupForm.terms_accepted} onChange={(e) => setSetupForm({ ...setupForm, terms_accepted: e.target.checked })} className="mt-0.5 w-5 h-5 accent-purple-600 rounded" />
            <span className="text-xs font-medium text-gray-600 leading-relaxed">I accept the <span className="font-black text-gray-800">terms & policies</span> for creating a private gallery</span>
          </label>

          <button onClick={handleSetupSubmit} disabled={!setupForm.terms_accepted || !setupForm.account_holder_name.trim() || !setupForm.account_number.trim() || !setupForm.ifsc_code.trim() || !setupForm.bank_name.trim() || setupLoading}
            className="w-full py-3.5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {setupLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Submit'}
          </button>
        </div>
      </div>
    );
  }

  // ─── GALLERY MANAGEMENT ────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-hidden relative">
      <Toast {...toast} />

      {/* Header */}
      <header className="px-5 py-4 bg-white border-b border-orange-100 flex items-center gap-3 z-50 shadow-sm flex-shrink-0">
        <button onClick={onBack} className="p-1.5 -ml-2 text-gray-400 active:scale-75 transition-transform">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tighter leading-none">Private gallery</h1>
          <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mt-0.5">{imageCount}/15 photos • {videoCount}/5 videos</p>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-50 flex-shrink-0">
        {(['all', 'image', 'video'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${filter === f ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
            {f === 'all' ? 'All' : f === 'image' ? `Photos (${imageCount})` : `Videos (${videoCount})`}
          </button>
        ))}
      </div>

      {/* Content grid - 2 columns */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-28">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center opacity-40 mt-8">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="font-black uppercase text-[10px] tracking-widest">No content yet</p>
            <p className="text-[9px] font-medium mt-1">Tap + to add photos or videos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-orange-50" onClick={() => { setViewerItem(item); setViewerIdx(0); }}>
                {/* Thumbnail */}
                <div className="relative aspect-square bg-gray-100">
                  {item.type === 'image' ? (
                    <img src={item.file_url} className="w-full h-full object-cover" alt="" draggable={false} />
                  ) : (
                    <video src={item.file_url} className="w-full h-full object-cover" muted />
                  )}
                  {/* Type badge */}
                  <div className="absolute top-1.5 left-1.5">
                    <span className="bg-black/60 text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {item.type}
                    </span>
                  </div>
                  {/* Bundle count badge */}
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
                  {/* Edit/Delete */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1" style={{ top: item.type === 'image' && item.bundle_count > 1 ? '26px' : '6px' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleEditOpen(item); }} className="w-6 h-6 bg-white/90 text-gray-700 rounded-full flex items-center justify-center shadow backdrop-blur-sm active:scale-75 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(item.id); }} className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center shadow active:scale-75 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <p className="text-[11px] font-bold text-gray-800 truncate leading-tight">{item.head_note}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] font-black text-purple-600">₹{item.amount}</span>
                    <span className="text-[8px] font-bold text-gray-400">{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FAB Upload Button ── */}
      <div className="absolute bottom-20 right-4 z-40">
        {showFabMenu && (
          <div className="absolute bottom-14 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-40 mb-2">
            <button onClick={() => handleOpenUpload('image')} className="w-full px-4 py-3 text-left text-xs font-bold text-gray-700 flex items-center gap-2.5 active:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Upload Photo
            </button>
            <div className="h-[1px] bg-gray-100" />
            <button onClick={() => handleOpenUpload('video')} className="w-full px-4 py-3 text-left text-xs font-bold text-gray-700 flex items-center gap-2.5 active:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Upload Video
            </button>
          </div>
        )}
        <button onClick={() => setShowFabMenu(prev => !prev)}
          className={`w-12 h-12 bg-[#1a237e] rounded-full flex items-center justify-center shadow-lg shadow-blue-900/30 active:scale-90 transition-all ${showFabMenu ? 'rotate-45' : ''}`}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>

      {/* Tap-away overlay for FAB menu */}
      {showFabMenu && <div className="fixed inset-0 z-30" onClick={() => setShowFabMenu(false)} />}

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} className="hidden"
        accept={uploadType === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' : 'image/jpeg,image/png,image/webp'}
        multiple={uploadType === 'image'}
        onChange={handleFileChange}
      />

      {/* ══ UPLOAD MODAL ══ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !uploading && setShowUploadModal(false)} />
          <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-black text-gray-800 uppercase tracking-tighter">
                  Add {uploadType}{uploadType === 'image' && uploadFiles.length > 1 ? ` (${uploadFiles.length})` : ''}
                </h3>
                <button onClick={() => !uploading && setShowUploadModal(false)} className="text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Preview area */}
              {uploadType === 'image' ? (
                <div className="space-y-3">
                  {/* Image preview grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {uploadPreviews.map((preview, idx) => (
                      <div key={idx} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                        <img src={preview} className="w-full h-full object-cover" alt="" />
                        <button onClick={() => handleRemoveFile(idx)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow">✕</button>
                      </div>
                    ))}
                    {/* Add more button */}
                    {uploadFiles.length < 15 && (
                      <button onClick={handleAddMoreFiles}
                        className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 active:scale-95 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        <span className="text-[7px] font-black uppercase">Add</span>
                      </button>
                    )}
                  </div>
                  {uploadFiles.length === 0 && (
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center gap-2 text-gray-400">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-black uppercase tracking-widest">Tap to select photos</span>
                      <span className="text-[8px] text-gray-300">Select multiple for a bundle (max 15)</span>
                    </button>
                  )}
                  {uploadFiles.length > 1 && (
                    <p className="text-[9px] font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-xl">📦 Bundle: {uploadFiles.length} photos — buyers pay once to view all</p>
                  )}
                </div>
              ) : (
                /* Video preview */
                <div onClick={() => !uploading && uploadFiles.length === 0 && fileInputRef.current?.click()}
                  className={`w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors ${uploadPreviews.length ? 'aspect-video' : 'py-8'}`}>
                  {uploadPreviews.length > 0 ? (
                    <video src={uploadPreviews[0]} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <div className="text-center">
                      <svg className="w-7 h-7 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tap to select video</span>
                    </div>
                  )}
                </div>
              )}

              {/* Video duration */}
              {uploadType === 'video' && videoDuration != null && videoDuration > 0 && (
                <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-xl">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs font-bold text-purple-600">Duration: {formatDuration(videoDuration)}</span>
                </div>
              )}

              {/* Head note */}
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-1 block">Head note <span className="text-gray-300">({headNote.length}/100)</span></label>
                <input type="text" value={headNote} onChange={(e) => setHeadNote(e.target.value.slice(0, 100))} placeholder="Describe your content..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300" />
              </div>

              {/* Price */}
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-1 block">Price (INR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">₹</span>
                  <input type="text" inputMode="numeric" value={amount} onChange={(e) => handleAmountChange(e.target.value, setAmount)} placeholder="30 - 9999"
                    className="w-full px-4 py-3 pl-8 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-purple-400 transition-colors placeholder:text-gray-300" />
                </div>
                <p className="text-[8px] text-gray-400 mt-1">Minimum ₹30 • Maximum ₹9,999</p>
              </div>

              {/* Progress */}
              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Uploading</span>
                    <span className="text-xs font-black text-purple-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <button onClick={handleUpload}
                disabled={uploadFiles.length === 0 || !headNote.trim() || uploading || !amount || parseInt(amount) < 30 || parseInt(amount) > 9999}
                className="w-full py-3.5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {uploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading {uploadProgress}%</> : 'Post content'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT MODAL ══ */}
      {editItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !editSaving && setEditItem(null)} />
          <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black text-gray-800 uppercase tracking-tighter">Edit content</h3>
              <button onClick={() => !editSaving && setEditItem(null)} className="text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="w-full bg-gray-100 rounded-xl overflow-hidden aspect-square max-h-[200px]">
              {editItem.type === 'image' ? <img src={editItem.file_url} className="w-full h-full object-cover" /> : <video src={editItem.file_url} className="w-full h-full object-cover" controls />}
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 mb-1 block">Head note ({editHeadNote.length}/100)</label>
              <input type="text" value={editHeadNote} onChange={(e) => setEditHeadNote(e.target.value.slice(0, 100))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-purple-400 transition-colors" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 mb-1 block">Price (INR)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">₹</span>
                <input type="text" inputMode="numeric" value={editAmount} onChange={(e) => handleAmountChange(e.target.value, setEditAmount)}
                  className="w-full px-4 py-3 pl-8 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-purple-400 transition-colors" />
              </div>
              <p className="text-[8px] text-gray-400 mt-1">Minimum ₹30 • Maximum ₹9,999</p>
            </div>
            <button onClick={handleEditSave} disabled={editSaving || !editHeadNote.trim() || !editAmount || parseInt(editAmount) < 30 || parseInt(editAmount) > 9999}
              className="w-full py-3.5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {editSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* ══ DELETE MODAL ══ */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-[300px] shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Delete content?</h3>
            <p className="text-xs text-gray-500 mb-5">This cannot be undone.</p>
            <div className="space-y-2">
              <button onClick={handleDelete} disabled={deleting}
                className="w-full py-3 bg-red-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SECURE VIEWER (owner viewing own content) ══ */}
      {viewerItem && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
          onContextMenu={(e) => e.preventDefault()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 z-10">
            <button onClick={() => { setViewerItem(null); setViewerIdx(0); }} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            {viewerItem.type === 'image' && viewerItem.bundle_count > 1 && (
              <span className="text-white/60 text-xs font-bold">{viewerIdx + 1} / {getViewerUrls(viewerItem).length}</span>
            )}
            <div className="w-10" />
          </div>
          {/* Content */}
          <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
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
            <div className="flex justify-center gap-1.5 py-4">
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

export default PrivateGallery;
