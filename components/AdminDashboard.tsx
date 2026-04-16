
import React, { useState, useMemo, useEffect } from 'react';
import { Profile, WithdrawalRequest, ProConfig } from '../types';
import { supabase } from '../lib/supabase';

interface KycRequest {
  id: string;
  user_id: string;
  status: string;
  live_photo_1: string;
  live_photo_2: string;
  admin_notes: string | null;
  created_at: string;
}

interface WithdrawalWithUser extends WithdrawalRequest {
  profiles?: { full_name: string; username: string; image_url: string; bank_info: any } | null;
}

interface AdminDashboardProps {
  onBack: () => void;
  onLogout: () => void;
  proConfig: ProConfig;
  onUpdateProConfig: (config: ProConfig) => void;
}

type AdminTab = 'overview' | 'users' | 'verifications' | 'pro' | 'withdrawals' | 'accounts';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onLogout, proConfig, onUpdateProConfig }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userImgIdx, setUserImgIdx] = useState(0);
  const [kycRequests, setKycRequests] = useState<KycRequest[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<KycRequest | null>(null);
  const [kycProcessing, setKycProcessing] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalWithUser[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalWithUser | null>(null);
  const [withdrawalProcessing, setWithdrawalProcessing] = useState(false);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [editProPrice, setEditProPrice] = useState(proConfig.price.toString());
  const [editProDays, setEditProDays] = useState(proConfig.duration.toString());

  // ─── FETCH ALL DATA ──────────────────────────
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) {
      setUsers(data.map((p: any) => ({
        id: p.id, name: p.full_name, username: p.username, email: p.email,
        age: p.age, dob: p.dob, location: p.location, bio: p.bio,
        interests: p.interests || [], imageUrl: p.image_url || '', images: p.images || [],
        occupation: p.occupation || '', gender: p.gender, verified: p.verified,
        relationshipGoal: p.relationship_goal, lookingFor: p.looking_for,
        orientation: p.orientation, pronouns: p.pronouns || '',
        lifestyle: p.lifestyle || {}, jobTitle: p.job_title || '',
        company: p.company || '', education: p.education || '',
        latitude: p.latitude, longitude: p.longitude, showMe: p.show_me || 'Everyone',
        ageMin: p.age_min || 18, ageMax: p.age_max || 50, maxDistance: p.max_distance || 50,
        showAge: p.show_age ?? true, showDistance: p.show_distance ?? true,
        showOrientation: p.show_orientation ?? true, role: p.role, status: p.status,
        bankInfo: p.bank_info, balance: p.balance, proExpiry: p.pro_expiry ? new Date(p.pro_expiry).getTime() : undefined,
      })));
    }
  };

  const fetchKycRequests = async () => {
    setKycLoading(true);
    const { data } = await supabase.from('kyc_verification_requests').select('*').order('created_at', { ascending: false });
    if (data) setKycRequests(data);
    setKycLoading(false);
  };

  const fetchWithdrawals = async () => {
    setWithdrawalsLoading(true);
    const { data } = await supabase.from('withdrawals').select('*, profiles(full_name, username, image_url, bank_info)').order('created_at', { ascending: false });
    if (data) setWithdrawals(data);
    setWithdrawalsLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchUsers(), fetchKycRequests(), fetchWithdrawals()]);
      setPageLoading(false);
    };
    init();
  }, []);

  const nonAdminUsers = useMemo(() => users.filter(u => u.role !== 'admin'), [users]);

  const filteredUsers = useMemo(() => {
    return nonAdminUsers.filter(u =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [nonAdminUsers, searchQuery]);

  const pendingVerifications = useMemo(() => kycRequests.filter(r => r.status === 'pending'), [kycRequests]);
  const pendingWithdrawals = useMemo(() => withdrawals.filter(w => w.status === 'pending'), [withdrawals]);
  const proUsers = useMemo(() => nonAdminUsers.filter(u => u.proExpiry && u.proExpiry > Date.now()), [nonAdminUsers]);
  const verifiedUsers = useMemo(() => nonAdminUsers.filter(u => u.verified), [nonAdminUsers]);
  const blockedUsers = useMemo(() => nonAdminUsers.filter(u => u.status === 'blocked'), [nonAdminUsers]);
  const usersWithBank = useMemo(() => nonAdminUsers.filter(u => u.bankInfo && (u.bankInfo as any).accountNumber), [nonAdminUsers]);

  const getKycUser = (userId: string) => users.find(u => u.id === userId);

  // ─── ADMIN ACTIONS (ALL DB-BACKED) ───────────
  const handleBlockToggle = async (user: Profile) => {
    setActionProcessing(true);
    try {
      const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: user.id, type: 'update', from_user_id: user.id,
        text: newStatus === 'blocked' ? 'Your account has been suspended by admin' : 'Your account has been reactivated',
      });
      await fetchUsers();
      setSelectedUser(null);
    } catch (err) { console.error(err); alert('Action failed. Please try again.'); }
    finally { setActionProcessing(false); }
  };

  const handleVerifyToggle = async (user: Profile) => {
    setActionProcessing(true);
    try {
      const { error } = await supabase.from('profiles').update({ verified: !user.verified }).eq('id', user.id);
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: user.id, type: 'update', from_user_id: user.id,
        text: !user.verified ? 'Your profile has been verified by admin' : 'Your verified badge has been removed',
      });
      await fetchUsers();
      setSelectedUser(null);
    } catch (err) { console.error(err); alert('Action failed. Please try again.'); }
    finally { setActionProcessing(false); }
  };

  const handleProToggle = async (user: Profile) => {
    setActionProcessing(true);
    try {
      const isCurrentlyPro = user.proExpiry && user.proExpiry > Date.now();
      const newExpiry = isCurrentlyPro ? null : new Date(Date.now() + proConfig.duration * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('profiles').update({ pro_expiry: newExpiry }).eq('id', user.id);
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: user.id, type: 'update', from_user_id: user.id,
        text: isCurrentlyPro ? 'Your Pro membership has been revoked' : 'You have been granted Pro membership by admin',
      });
      await fetchUsers();
      setSelectedUser(null);
    } catch (err) { console.error(err); alert('Action failed. Please try again.'); }
    finally { setActionProcessing(false); }
  };

  const handleDeleteUser = async (user: Profile) => {
    if (!confirm(`Permanently delete ${user.name}? This cannot be undone.`)) return;
    setActionProcessing(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', user.id);
      if (error) throw error;
      await fetchUsers();
      setSelectedUser(null);
    } catch (err) { console.error(err); alert('Delete failed. Please try again.'); }
    finally { setActionProcessing(false); }
  };

  const handleApproveKyc = async (kyc: KycRequest) => {
    setKycProcessing(true);
    try {
      await supabase.from('kyc_verification_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', kyc.id);
      await supabase.from('profiles').update({ verified: true }).eq('id', kyc.user_id);
      await supabase.from('notifications').insert({ user_id: kyc.user_id, type: 'update', from_user_id: kyc.user_id, text: 'Your profile has been verified. You now have the verified badge.' });
      setSelectedKyc(null);
      await Promise.all([fetchKycRequests(), fetchUsers()]);
    } catch (err) { console.error(err); alert('Failed to approve.'); }
    finally { setKycProcessing(false); }
  };

  const handleRejectKyc = async (kyc: KycRequest) => {
    setKycProcessing(true);
    try {
      await supabase.from('kyc_verification_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', kyc.id);
      await supabase.from('notifications').insert({ user_id: kyc.user_id, type: 'update', from_user_id: kyc.user_id, text: 'Your verification request has been rejected. You can reapply with clearer photos.' });
      setSelectedKyc(null);
      await fetchKycRequests();
    } catch (err) { console.error(err); alert('Failed to reject.'); }
    finally { setKycProcessing(false); }
  };

  const handleApproveWithdrawal = async (w: WithdrawalWithUser) => {
    setWithdrawalProcessing(true);
    try {
      await supabase.from('withdrawals').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', w.id);
      // Deduct balance
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', w.user_id).single();
      if (profile) {
        const newBalance = Math.max(0, (profile.balance || 0) - Number(w.amount));
        await supabase.from('profiles').update({ balance: newBalance }).eq('id', w.user_id);
      }
      await supabase.from('notifications').insert({ user_id: w.user_id, type: 'payout', from_user_id: w.user_id, text: `Your withdrawal of ₹${w.amount} has been approved and processed.` });
      setSelectedWithdrawal(null);
      await Promise.all([fetchWithdrawals(), fetchUsers()]);
    } catch (err) { console.error(err); alert('Failed to approve withdrawal.'); }
    finally { setWithdrawalProcessing(false); }
  };

  const handleRejectWithdrawal = async (w: WithdrawalWithUser) => {
    setWithdrawalProcessing(true);
    try {
      await supabase.from('withdrawals').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', w.id);
      await supabase.from('notifications').insert({ user_id: w.user_id, type: 'payout', from_user_id: w.user_id, text: `Your withdrawal of ₹${w.amount} has been rejected.` });
      setSelectedWithdrawal(null);
      await fetchWithdrawals();
    } catch (err) { console.error(err); alert('Failed to reject withdrawal.'); }
    finally { setWithdrawalProcessing(false); }
  };

  const handleHoldWithdrawal = async (w: WithdrawalWithUser) => {
    setWithdrawalProcessing(true);
    try {
      await supabase.from('withdrawals').update({ status: 'held', processed_at: new Date().toISOString() }).eq('id', w.id);
      await supabase.from('notifications').insert({ user_id: w.user_id, type: 'payout', from_user_id: w.user_id, text: `Your withdrawal of ₹${w.amount} is on hold for review.` });
      setSelectedWithdrawal(null);
      await fetchWithdrawals();
    } catch (err) { console.error(err); alert('Failed to hold withdrawal.'); }
    finally { setWithdrawalProcessing(false); }
  };

  const handleSaveConfig = () => {
    onUpdateProConfig({ price: parseInt(editProPrice), duration: parseInt(editProDays) });
    alert("Configuration updated successfully!");
  };

  if (pageLoading) {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#006400] rounded-full animate-spin" />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-4">Loading admin panel</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-hidden">
      {/* Admin Header */}
      <header className="p-5 bg-[#006400] text-white flex items-center justify-between shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white/10 rounded-full active:scale-90 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter">Command center</h1>
            <p className="text-[7px] font-black uppercase tracking-[0.2em] opacity-60">Mallu Cupid Admin</p>
          </div>
        </div>
        <button onClick={() => { if(confirm('Secure logout from admin session?')) onLogout(); }} className="p-2 bg-white/10 rounded-xl border border-white/20">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </header>

      {/* Tab Navigation */}
      <div className="px-4 py-3 flex gap-2 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'users', label: 'Users' },
          { id: 'verifications', label: 'KYC' },
          { id: 'pro', label: 'Pro plan' },
          { id: 'withdrawals', label: 'Withdrawals' },
          { id: 'accounts', label: 'Payouts' },
        ] as { id: AdminTab; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-[#006400] text-white shadow-md' : 'bg-gray-50 text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-40">

        {/* ─── OVERVIEW TAB ──────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total users', val: nonAdminUsers.length, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Verified', val: verifiedUsers.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Pro members', val: proUsers.length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                { label: 'Blocked', val: blockedUsers.length, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Pending KYC', val: pendingVerifications.length, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Pending withdrawals', val: pendingWithdrawals.length, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} p-5 rounded-3xl border border-gray-100`}>
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white p-5 rounded-3xl border border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Quick actions</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setActiveTab('verifications')} className="p-3 bg-orange-50 rounded-2xl text-center">
                  <p className="text-lg font-black text-orange-600">{pendingVerifications.length}</p>
                  <p className="text-[7px] font-black text-gray-400 uppercase">Review KYC</p>
                </button>
                <button onClick={() => setActiveTab('withdrawals')} className="p-3 bg-emerald-50 rounded-2xl text-center">
                  <p className="text-lg font-black text-emerald-600">{pendingWithdrawals.length}</p>
                  <p className="text-[7px] font-black text-gray-400 uppercase">Withdrawals</p>
                </button>
                <button onClick={() => setActiveTab('users')} className="p-3 bg-blue-50 rounded-2xl text-center">
                  <p className="text-lg font-black text-blue-600">{nonAdminUsers.length}</p>
                  <p className="text-[7px] font-black text-gray-400 uppercase">Users</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── USERS TAB ─────────────────────── */}
        {activeTab === 'users' && (
          <>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search name, city, or username..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-5 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold shadow-sm focus:ring-2 focus:ring-[#006400]/20 outline-none" />
            </div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">{filteredUsers.length} users</p>
            <div className="space-y-3">
              {filteredUsers.map(u => {
                const isUserPro = u.proExpiry && u.proExpiry > Date.now();
                return (
                  <div key={u.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <img src={u.imageUrl || ''} className="w-12 h-12 rounded-xl object-cover" />
                        {isUserPro && <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] border-2 border-white">👑</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 truncate">
                          <p className="text-[10px] font-black uppercase tracking-wide">{u.name}</p>
                          {u.verified && <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>}
                          {u.status === 'blocked' && <span className="text-[7px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase">Banned</span>}
                        </div>
                        <p className="text-[8px] font-bold text-gray-400 truncate">@{u.username} · {u.location}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedUser(u); setUserImgIdx(0); }} className="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-[8px] font-black uppercase tracking-wide flex-shrink-0">Manage</button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── KYC VERIFICATIONS TAB ─────────── */}
        {activeTab === 'verifications' && (
          <div className="space-y-3">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">{pendingVerifications.length} pending · {kycRequests.length} total</p>
            {kycLoading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-gray-200 border-t-orange-500 rounded-full animate-spin" /></div>
            ) : pendingVerifications.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                </div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No pending verifications</p>
              </div>
            ) : (
              pendingVerifications.map(kyc => {
                const kycUser = getKycUser(kyc.user_id);
                return (
                  <div key={kyc.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {kycUser?.imageUrl ? <img src={kycUser.imageUrl} className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400 font-black text-sm">?</div>}
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wide truncate">{kycUser?.name || 'Unknown'}</p>
                        <p className="text-[8px] font-bold text-gray-400 truncate">{kycUser ? `${kycUser.gender} · ${kycUser.age}y · ${kycUser.location}` : ''}</p>
                        <p className="text-[8px] font-bold text-orange-500 mt-0.5">{new Date(kyc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedKyc(kyc)} className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[8px] font-black uppercase tracking-wide flex-shrink-0">Review</button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── PRO PLAN TAB ──────────────────── */}
        {activeTab === 'pro' && (
          <div className="space-y-5">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter">Pro plan configuration</h3>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Update global settings</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Monthly price (INR)</label>
                  <input type="number" value={editProPrice} onChange={e => setEditProPrice(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl font-black text-lg outline-none focus:ring-2 focus:ring-[#006400]/10" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Duration (days)</label>
                  <input type="number" value={editProDays} onChange={e => setEditProDays(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl font-black text-lg outline-none focus:ring-2 focus:ring-[#006400]/10" />
                </div>
                <button onClick={handleSaveConfig} className="w-full py-4 bg-[#006400] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">Save settings</button>
              </div>
            </div>
            <div>
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">{proUsers.length} active pro members</p>
              <div className="space-y-3">
                {proUsers.length === 0 ? (
                  <div className="text-center py-10 opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">No pro members</p></div>
                ) : proUsers.map(u => (
                  <div key={u.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={u.imageUrl || ''} className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <p className="text-[10px] font-black uppercase">{u.name}</p>
                        <p className="text-[8px] font-bold text-yellow-600">Expires: {u.proExpiry ? new Date(u.proExpiry).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedUser(u); setUserImgIdx(0); }} className="px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-[8px] font-black uppercase">Manage</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── WITHDRAWALS TAB ───────────────── */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-3">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">{pendingWithdrawals.length} pending · {withdrawals.length} total</p>
            {withdrawalsLoading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-gray-200 border-t-emerald-500 rounded-full animate-spin" /></div>
            ) : withdrawals.length === 0 ? (
              <div className="text-center py-16 opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">No withdrawal requests</p></div>
            ) : (
              withdrawals.map(w => (
                <div key={w.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {w.profiles?.image_url ? <img src={w.profiles.image_url} className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 bg-gray-200 rounded-xl" />}
                    <div>
                      <p className="text-[10px] font-black uppercase">{w.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-[8px] font-bold text-gray-400">@{w.profiles?.username || '?'} · {new Date(w.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${
                      w.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                      w.status === 'approved' ? 'bg-green-50 text-green-700' :
                      w.status === 'held' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                    }`}>{w.status}</span>
                    <p className="text-sm font-black text-gray-800">₹{Number(w.amount).toLocaleString()}</p>
                    {w.status === 'pending' && <button onClick={() => setSelectedWithdrawal(w)} className="px-3 py-1.5 bg-black text-white rounded-lg text-[8px] font-black uppercase">Review</button>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── ACCOUNTS / PAYOUTS TAB ────────── */}
        {activeTab === 'accounts' && (
          <div className="space-y-3">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">{usersWithBank.length} users with bank details</p>
            {usersWithBank.length === 0 ? (
              <div className="text-center py-16 opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">No bank accounts linked</p></div>
            ) : (
              usersWithBank.map(u => {
                const bank = u.bankInfo as any;
                return (
                  <div key={u.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <img src={u.imageUrl || ''} className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <p className="text-[10px] font-black uppercase">{u.name}</p>
                        <p className="text-[8px] font-bold text-gray-400">@{u.username} · Balance: ₹{(u.balance || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[8px] font-black text-gray-400 uppercase">Account</span>
                        <span className="text-[9px] font-bold text-gray-700">{bank?.accountName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[8px] font-black text-gray-400 uppercase">Account no.</span>
                        <span className="text-[9px] font-bold text-gray-700">{bank?.accountNumber ? `****${bank.accountNumber.slice(-4)}` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[8px] font-black text-gray-400 uppercase">IFSC</span>
                        <span className="text-[9px] font-bold text-gray-700">{bank?.ifsc || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[8px] font-black text-gray-400 uppercase">Bank</span>
                        <span className="text-[9px] font-bold text-gray-700">{bank?.bankName || 'N/A'}</span>
                      </div>
                      {bank?.upiId && (
                        <div className="flex justify-between">
                          <span className="text-[8px] font-black text-gray-400 uppercase">UPI</span>
                          <span className="text-[9px] font-bold text-gray-700">{bank.upiId}</span>
                        </div>
                      )}
                      {bank?.paymentNumber && (
                        <div className="flex justify-between">
                          <span className="text-[8px] font-black text-gray-400 uppercase">GPay/PhonePe</span>
                          <span className="text-[9px] font-bold text-gray-700">{bank.paymentNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ─── USER MANAGEMENT MODAL ───────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedUser(null)} />
          <div className="relative bg-[#fdfdfd] rounded-3xl w-full overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
            <div className="relative h-[28vh]">
              {selectedUser.images?.[userImgIdx] ? <img src={selectedUser.images[userImgIdx]} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-200" />}
              {selectedUser.images?.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">{selectedUser.images.map((_: any, i: number) => <div key={i} onClick={() => setUserImgIdx(i)} className={`w-1.5 h-1.5 rounded-full ${i === userImgIdx ? 'bg-white' : 'bg-white/40'}`} />)}</div>
              )}
              <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 w-9 h-9 bg-black/30 backdrop-blur-md rounded-full text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-black uppercase tracking-tighter">{selectedUser.name}</h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">@{selectedUser.username} · {selectedUser.age}y · {selectedUser.gender} · {selectedUser.location}</p>
              </div>

              {/* Pro Toggle */}
              <div className="bg-yellow-50/60 p-4 rounded-2xl border border-yellow-100 flex justify-between items-center">
                <div>
                  <p className="text-[8px] font-black text-yellow-600 uppercase">Pro membership</p>
                  <p className="text-xs font-black text-yellow-900 uppercase">{selectedUser.proExpiry && selectedUser.proExpiry > Date.now() ? 'Active' : 'Inactive'}</p>
                  {selectedUser.proExpiry && selectedUser.proExpiry > Date.now() && <p className="text-[8px] font-bold text-yellow-600 mt-0.5">Expires: {new Date(selectedUser.proExpiry).toLocaleDateString()}</p>}
                </div>
                <button onClick={() => handleProToggle(selectedUser)} disabled={actionProcessing} className={`px-4 py-2 rounded-full text-[8px] font-black uppercase disabled:opacity-50 ${selectedUser.proExpiry && selectedUser.proExpiry > Date.now() ? 'bg-rose-500 text-white' : 'bg-[#006400] text-white'}`}>
                  {selectedUser.proExpiry && selectedUser.proExpiry > Date.now() ? 'Revoke' : 'Grant pro'}
                </button>
              </div>

              {/* Verified Toggle */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
                <div>
                  <p className="text-[8px] font-black text-blue-600 uppercase">Verified badge</p>
                  <p className="text-xs font-black text-blue-900 uppercase">{selectedUser.verified ? 'Verified' : 'Unverified'}</p>
                </div>
                <button onClick={() => handleVerifyToggle(selectedUser)} disabled={actionProcessing} className={`px-4 py-2 rounded-full text-[8px] font-black uppercase disabled:opacity-50 ${selectedUser.verified ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}>
                  {selectedUser.verified ? 'Remove badge' : 'Add badge'}
                </button>
              </div>

              {/* Account Status */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase">Account status</p>
                  <p className={`text-xs font-black uppercase ${selectedUser.status === 'blocked' ? 'text-rose-600' : 'text-emerald-600'}`}>{selectedUser.status}</p>
                </div>
                <button onClick={() => handleBlockToggle(selectedUser)} disabled={actionProcessing} className={`px-4 py-2 rounded-full text-[8px] font-black uppercase disabled:opacity-50 ${selectedUser.status === 'blocked' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>
                  {selectedUser.status === 'blocked' ? 'Unban' : 'Ban user'}
                </button>
              </div>

              {/* Delete */}
              <button onClick={() => handleDeleteUser(selectedUser)} disabled={actionProcessing} className="w-full py-4 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50">
                Delete account permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── WITHDRAWAL REVIEW MODAL ─────────── */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedWithdrawal(null)} />
          <div className="relative bg-white rounded-3xl w-full overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 text-center bg-emerald-50">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Withdrawal request</p>
              <h3 className="text-4xl font-black text-emerald-900">₹{Number(selectedWithdrawal.amount).toLocaleString()}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {selectedWithdrawal.profiles?.image_url ? <img src={selectedWithdrawal.profiles.image_url} className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 bg-gray-200 rounded-xl" />}
                <div>
                  <p className="text-sm font-black uppercase">{selectedWithdrawal.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-[9px] font-bold text-gray-400">@{selectedWithdrawal.profiles?.username} · {new Date(selectedWithdrawal.created_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedWithdrawal.profiles?.bank_info && (
                <div className="bg-gray-50 p-4 rounded-xl space-y-1">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Payout details</p>
                  {(selectedWithdrawal.profiles.bank_info as any).accountName && <div className="flex justify-between"><span className="text-[8px] font-bold text-gray-400">Name</span><span className="text-[9px] font-bold">{(selectedWithdrawal.profiles.bank_info as any).accountName}</span></div>}
                  {(selectedWithdrawal.profiles.bank_info as any).accountNumber && <div className="flex justify-between"><span className="text-[8px] font-bold text-gray-400">Account</span><span className="text-[9px] font-bold">****{(selectedWithdrawal.profiles.bank_info as any).accountNumber.slice(-4)}</span></div>}
                  {(selectedWithdrawal.profiles.bank_info as any).ifsc && <div className="flex justify-between"><span className="text-[8px] font-bold text-gray-400">IFSC</span><span className="text-[9px] font-bold">{(selectedWithdrawal.profiles.bank_info as any).ifsc}</span></div>}
                  {(selectedWithdrawal.profiles.bank_info as any).bankName && <div className="flex justify-between"><span className="text-[8px] font-bold text-gray-400">Bank</span><span className="text-[9px] font-bold">{(selectedWithdrawal.profiles.bank_info as any).bankName}</span></div>}
                  {(selectedWithdrawal.profiles.bank_info as any).upiId && <div className="flex justify-between"><span className="text-[8px] font-bold text-gray-400">UPI</span><span className="text-[9px] font-bold">{(selectedWithdrawal.profiles.bank_info as any).upiId}</span></div>}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button onClick={() => handleApproveWithdrawal(selectedWithdrawal)} disabled={withdrawalProcessing}
                  className="w-full py-4 bg-[#006400] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  {withdrawalProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Approve & pay
                </button>
                <button onClick={() => handleHoldWithdrawal(selectedWithdrawal)} disabled={withdrawalProcessing}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-black uppercase tracking-widest text-[9px] active:scale-95 disabled:opacity-50">
                  Put on hold
                </button>
                <button onClick={() => handleRejectWithdrawal(selectedWithdrawal)} disabled={withdrawalProcessing}
                  className="w-full py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-[9px] active:scale-95 disabled:opacity-50">
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── KYC REVIEW MODAL ────────────────── */}
      {selectedKyc && (() => {
        const kycUser = getKycUser(selectedKyc.user_id);
        const profilePhotos = kycUser?.images || [];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedKyc(null)} />
            <div className="relative bg-[#fdfdfd] rounded-3xl w-full overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
              <button onClick={() => setSelectedKyc(null)} className="absolute top-4 right-4 z-10 w-9 h-9 bg-black/20 backdrop-blur-md rounded-full text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 bg-orange-50 border-b border-orange-100">
                  <div className="flex items-center gap-3 mb-3">
                    {kycUser?.imageUrl ? <img src={kycUser.imageUrl} className="w-14 h-14 rounded-2xl object-cover shadow-md" /> : <div className="w-14 h-14 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-400 font-black">?</div>}
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tighter">{kycUser?.name || 'Unknown'}</h3>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">@{kycUser?.username}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl p-2.5"><p className="text-[7px] font-black text-gray-400 uppercase">DOB</p><p className="text-xs font-black">{kycUser?.dob || 'N/A'}</p></div>
                    <div className="bg-white rounded-xl p-2.5"><p className="text-[7px] font-black text-gray-400 uppercase">Gender</p><p className="text-xs font-black">{kycUser?.gender || 'N/A'}</p></div>
                    <div className="bg-white rounded-xl p-2.5 col-span-2"><p className="text-[7px] font-black text-gray-400 uppercase">Location</p><p className="text-xs font-black">{kycUser?.location || 'N/A'}</p></div>
                  </div>
                </div>
                {profilePhotos.length > 0 && (
                  <div className="p-5 border-b border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Profile photos ({profilePhotos.length})</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">{profilePhotos.map((photo: string, idx: number) => <img key={idx} src={photo} className="w-16 h-20 rounded-lg object-cover flex-shrink-0 border border-gray-100" />)}</div>
                  </div>
                )}
                <div className="p-5">
                  <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-2">Live verification photos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100"><img src={selectedKyc.live_photo_1} className="w-full h-full object-cover" /><div className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full"><span className="text-[7px] font-bold text-white">Photo 1</span></div></div>
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100"><img src={selectedKyc.live_photo_2} className="w-full h-full object-cover" /><div className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full"><span className="text-[7px] font-bold text-white">Photo 2</span></div></div>
                  </div>
                  <p className="text-[7px] text-gray-400 font-medium mt-2 text-center">Submitted {new Date(selectedKyc.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-white space-y-2 safe-area-bottom">
                <button onClick={() => handleApproveKyc(selectedKyc)} disabled={kycProcessing}
                  className="w-full py-3.5 bg-[#006400] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  {kycProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Approve & verify
                </button>
                <button onClick={() => handleRejectKyc(selectedKyc)} disabled={kycProcessing}
                  className="w-full py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-[9px] active:scale-95 disabled:opacity-50">
                  Reject
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AdminDashboard;
