
import React, { useState, useMemo, useEffect } from 'react';
import { Profile, WithdrawalRequest, UserReport, ProConfig } from '../types';
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

interface AdminDashboardProps {
  onBack: () => void;
  onLogout: () => void;
  users: Profile[];
  withdrawalRequests: WithdrawalRequest[];
  reports: UserReport[];
  proConfig: ProConfig;
  onUpdateProConfig: (config: ProConfig) => void;
  onManualProToggle: (id: string, activate: boolean) => void;
  onApproveWithdrawal: (id: string) => void;
  onHoldWithdrawal: (id: string) => void;
  onRejectWithdrawal: (id: string) => void;
  onVerifyUser: (id: string) => void;
  onUnverifyUser: (id: string) => void;
  onBlockUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
}

type AdminTab = 'users' | 'verifications' | 'withdrawals' | 'reports' | 'config';

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBack,
  onLogout,
  users,
  withdrawalRequests,
  reports,
  proConfig,
  onUpdateProConfig,
  onManualProToggle,
  onApproveWithdrawal,
  onHoldWithdrawal,
  onRejectWithdrawal,
  onVerifyUser,
  onUnverifyUser,
  onBlockUser,
  onDeleteUser
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [selectedVerifyRequest, setSelectedVerifyRequest] = useState<Profile | null>(null);
  const [userImgIdx, setUserImgIdx] = useState(0);
  const [kycRequests, setKycRequests] = useState<KycRequest[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<KycRequest | null>(null);
  const [kycProcessing, setKycProcessing] = useState(false);
  const [kycImgIdx, setKycImgIdx] = useState(0);

  // Dynamic config form state
  const [editProPrice, setEditProPrice] = useState(proConfig.price.toString());
  const [editProDays, setEditProDays] = useState(proConfig.duration.toString());

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      (u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.location.toLowerCase().includes(searchQuery.toLowerCase())) &&
      u.role !== 'admin'
    );
  }, [users, searchQuery]);

  const pendingVerifications = useMemo(() => {
    return kycRequests.filter(r => r.status === 'pending');
  }, [kycRequests]);

  const pendingWithdrawals = useMemo(() => {
    return withdrawalRequests.filter(r => r.status === 'pending');
  }, [withdrawalRequests]);

  const stats = {
    totalUsers: users.length - 1,
    pendingVerifs: pendingVerifications.length,
    pendingFunds: pendingWithdrawals.length,
    activeReports: reports.length
  };

  const openUserDetail = (u: Profile) => {
    setSelectedUser(u);
    setUserImgIdx(0);
  };

  // ─── FETCH KYC REQUESTS ────────────────────────
  const fetchKycRequests = async () => {
    setKycLoading(true);
    const { data } = await supabase
      .from('kyc_verification_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setKycRequests(data);
    setKycLoading(false);
  };

  useEffect(() => {
    fetchKycRequests();
  }, []);

  const getKycUser = (userId: string) => users.find(u => u.id === userId);

  // ─── APPROVE KYC ──────────────────────────────
  const handleApproveKyc = async (kyc: KycRequest) => {
    setKycProcessing(true);
    try {
      await supabase
        .from('kyc_verification_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', kyc.id);

      await supabase
        .from('profiles')
        .update({ verified: true })
        .eq('id', kyc.user_id);

      await supabase.from('notifications').insert({
        user_id: kyc.user_id,
        type: 'update',
        title: 'Profile verified',
        message: 'Congratulations! Your profile has been verified. You now have the verified badge.',
      });

      onVerifyUser(kyc.user_id);
      setSelectedKyc(null);
      fetchKycRequests();
    } catch (err) {
      console.error('Approve KYC error:', err);
      alert('Failed to approve. Please try again.');
    } finally {
      setKycProcessing(false);
    }
  };

  // ─── REJECT KYC ───────────────────────────────
  const handleRejectKyc = async (kyc: KycRequest) => {
    setKycProcessing(true);
    try {
      await supabase
        .from('kyc_verification_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', kyc.id);

      await supabase.from('notifications').insert({
        user_id: kyc.user_id,
        type: 'update',
        title: 'Verification rejected',
        message: 'Your verification request has been rejected. You can reapply with clearer photos.',
      });

      setSelectedKyc(null);
      fetchKycRequests();
    } catch (err) {
      console.error('Reject KYC error:', err);
      alert('Failed to reject. Please try again.');
    } finally {
      setKycProcessing(false);
    }
  };

  const handleSaveConfig = () => {
    onUpdateProConfig({
      price: parseInt(editProPrice),
      duration: parseInt(editProDays)
    });
    alert("Configuration updated successfully!");
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-hidden">
      {/* Admin Header */}
      <header className="p-6 bg-[#006400] text-white flex items-center justify-between shadow-2xl z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white/10 rounded-full active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Command Center</h1>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60">Mallu Cupid Admin v1.1</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setActiveTab('config')} className={`p-2.5 rounded-2xl border transition-all ${activeTab === 'config' ? 'bg-white text-[#006400] border-white' : 'bg-white/10 border-white/20'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
           <button 
             onClick={() => { if(confirm('Secure Logout from Admin Session?')) onLogout(); }}
             className="p-2.5 bg-white/10 rounded-2xl border border-white/20 hover:bg-white/20"
           >
             <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
           </button>
        </div>
      </header>

      {/* Real-time Stats Tabs */}
      <div className="p-6 flex gap-4 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar">
        {[
          { label: 'USERS', val: stats.totalUsers, tab: 'users', color: 'text-blue-600' },
          { label: 'VERIFY', val: stats.pendingVerifs, tab: 'verifications', color: 'text-orange-600' },
          { label: 'WITHDRAW', val: stats.pendingFunds, tab: 'withdrawals', color: 'text-emerald-600' },
          { label: 'REPORTS', val: stats.activeReports, tab: 'reports', color: 'text-rose-600' }
        ].map(item => (
          <button 
            key={item.label}
            onClick={() => setActiveTab(item.tab as AdminTab)}
            className={`flex-1 min-w-[85px] p-4 rounded-[2.5rem] flex flex-col items-center justify-center transition-all ${activeTab === item.tab ? 'ring-2 ring-black bg-gray-50' : 'bg-transparent'}`}
          >
            <span className={`text-xl font-black ${item.color}`}>{item.val}</span>
            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
        
        {activeTab === 'config' && (
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 space-y-8 animate-in fade-in zoom-in duration-300">
             <div>
                <h3 className="text-xl font-black uppercase tracking-tighter mb-1">Plan Configuration</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Update global Pro Plan settings</p>
             </div>
             
             <div className="space-y-6">
                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Monthly Pro Price (INR)</label>
                   <input 
                     type="number" 
                     value={editProPrice} 
                     onChange={e => setEditProPrice(e.target.value)}
                     className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-lg outline-none focus:ring-2 focus:ring-[#006400]/10"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Plan Duration (Days)</label>
                   <input 
                     type="number" 
                     value={editProDays} 
                     onChange={e => setEditProDays(e.target.value)}
                     className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-lg outline-none focus:ring-2 focus:ring-[#006400]/10"
                   />
                </div>
                <button 
                  onClick={handleSaveConfig}
                  className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                >
                  Save Global Settings
                </button>
             </div>
          </div>
        )}

        {activeTab === 'users' && (
          <>
            <div className="relative mb-6">
              <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="Search name, city, or username..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-white border border-gray-200 rounded-3xl text-xs font-bold shadow-sm focus:ring-2 focus:ring-[#006400]/20 outline-none"
              />
            </div>
            <div className="space-y-4">
              {filteredUsers.map(u => {
                const isUserPro = u.proExpiry && u.proExpiry > Date.now();
                return (
                  <div key={u.id} className="bg-white p-5 rounded-[3rem] shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative">
                        <img src={u.imageUrl} className="w-14 h-14 rounded-3xl object-cover shadow-inner" />
                        {isUserPro && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] border-2 border-white shadow-sm">👑</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <p className="text-[10px] font-black uppercase tracking-widest">{u.name}</p>
                          {u.verified && <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>}
                        </div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tight truncate">@{u.username} • {u.location}</p>
                      </div>
                    </div>
                    <button onClick={() => openUserDetail(u)} className="px-6 py-3 bg-gray-50 text-gray-700 rounded-2xl text-[8px] font-black uppercase tracking-widest shadow-sm">Manage</button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Other tabs remain largely the same, but integrate with real backend updates */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            {pendingWithdrawals.map(w => (
              <div key={w.id} className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest">@{w.username}</p>
                  <p className="text-[20px] font-black text-rose-600 tracking-tighter mt-1">₹{w.amount}</p>
                </div>
                <button onClick={() => setSelectedWithdrawal(w)} className="px-8 py-4 bg-black text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95">Inspect</button>
              </div>
            ))}
          </div>
        )}

        {/* ─── KYC VERIFICATIONS TAB ──────────────── */}
        {activeTab === 'verifications' && (
          <div className="space-y-4">
            {kycLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-[3px] border-gray-200 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                </div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No pending verifications</p>
              </div>
            ) : (
              pendingVerifications.map(kyc => {
                const kycUser = getKycUser(kyc.user_id);
                return (
                  <div key={kyc.id} className="bg-white p-5 rounded-[3rem] shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {kycUser?.imageUrl ? (
                        <img src={kycUser.imageUrl} className="w-14 h-14 rounded-3xl object-cover shadow-inner" />
                      ) : (
                        <div className="w-14 h-14 bg-gray-200 rounded-3xl flex items-center justify-center text-gray-400 font-black text-sm">?</div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest truncate">{kycUser?.name || 'Unknown'}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tight truncate">
                          {kycUser ? `${kycUser.gender} • ${kycUser.age}y • ${kycUser.location}` : ''}
                        </p>
                        <p className="text-[8px] font-bold text-orange-500 uppercase tracking-tight mt-0.5">
                          {new Date(kyc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedKyc(kyc); setKycImgIdx(0); }} className="px-6 py-3 bg-orange-50 text-orange-600 rounded-2xl text-[8px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-transform">Review</button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* DETAILED USER MODAL WITH MANUAL TOGGLES */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedUser(null)} />
          <div className="relative bg-[#fdfdfd] rounded-[3.5rem] w-full max-sm overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
            <div className="relative h-[30vh]">
               <img src={selectedUser.images[userImgIdx]} className="w-full h-full object-cover" />
               <button onClick={() => setSelectedUser(null)} className="absolute top-6 right-6 w-10 h-10 bg-black/20 backdrop-blur-md rounded-full text-white flex items-center justify-center shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="px-8 py-8 flex-1 overflow-y-auto space-y-8">
               <div className="text-center">
                  <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">{selectedUser.name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-2">@{selectedUser.username}</p>
               </div>

               <div className="space-y-6">
                  {/* Pro Plan Status Toggle */}
                  <div className="bg-yellow-50/50 p-6 rounded-[2.5rem] border border-yellow-100">
                    <div className="flex justify-between items-center mb-4">
                       <div>
                          <p className="text-[8px] font-black text-yellow-600 uppercase mb-1">PRO MEMBERSHIP</p>
                          <p className="text-xs font-black text-yellow-900 uppercase">
                            {selectedUser.proExpiry && selectedUser.proExpiry > Date.now() ? 'ACTIVE' : 'INACTIVE'}
                          </p>
                       </div>
                       {selectedUser.proExpiry && selectedUser.proExpiry > Date.now() ? (
                         <button onClick={() => { onManualProToggle(selectedUser.id, false); setSelectedUser(null); }} className="px-4 py-2 bg-rose-500 text-white rounded-full text-[8px] font-black uppercase">Revoke</button>
                       ) : (
                         <button onClick={() => { onManualProToggle(selectedUser.id, true); setSelectedUser(null); }} className="px-4 py-2 bg-[#006400] text-white rounded-full text-[8px] font-black uppercase">Grant Pro</button>
                       )}
                    </div>
                    {selectedUser.proExpiry && selectedUser.proExpiry > Date.now() && (
                       <p className="text-[9px] font-bold text-yellow-700 italic">Expires: {new Date(selectedUser.proExpiry).toLocaleDateString()}</p>
                    )}
                  </div>

                  {/* Manual Verified Toggle */}
                  <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 flex justify-between items-center">
                    <div>
                       <p className="text-[8px] font-black text-blue-600 uppercase mb-1">VERIFIED BADGE</p>
                       <p className="text-xs font-black text-blue-900 uppercase">{selectedUser.verified ? 'VERIFIED' : 'UNVERIFIED'}</p>
                    </div>
                    {selectedUser.verified ? (
                       <button onClick={() => { onUnverifyUser(selectedUser.id); setSelectedUser(null); }} className="px-4 py-2 bg-orange-500 text-white rounded-full text-[8px] font-black uppercase">Remove Badge</button>
                    ) : (
                       <button onClick={() => { onVerifyUser(selectedUser.id); setSelectedUser(null); }} className="px-4 py-2 bg-blue-600 text-white rounded-full text-[8px] font-black uppercase">Add Badge</button>
                    )}
                  </div>

                  {/* Account Status */}
                  <div className="bg-gray-50/50 p-6 rounded-[2.5rem] border border-gray-100 flex justify-between items-center">
                    <div>
                       <p className="text-[8px] font-black text-gray-400 uppercase mb-1">ACCOUNT STATUS</p>
                       <p className={`text-xs font-black uppercase ${selectedUser.status === 'blocked' ? 'text-rose-600' : 'text-emerald-600'}`}>{selectedUser.status}</p>
                    </div>
                    {selectedUser.status === 'blocked' ? (
                       <button onClick={() => { onBlockUser(selectedUser.id); setSelectedUser(null); }} className="px-4 py-2 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase">Unban User</button>
                    ) : (
                       <button onClick={() => { onBlockUser(selectedUser.id); setSelectedUser(null); }} className="px-4 py-2 bg-rose-600 text-white rounded-full text-[8px] font-black uppercase">Ban User</button>
                    )}
                  </div>

                  {/* Permanent Actions */}
                  <button onClick={() => { if(confirm('Permanently delete this user?')) { onDeleteUser(selectedUser.id); setSelectedUser(null); } }} className="w-full py-5 bg-black text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95">Destroy Account Forever</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAWAL REVIEW MODAL remains same but linked to backend */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedWithdrawal(null)} />
          <div className="relative bg-white rounded-[3.5rem] w-full max-sm overflow-hidden flex flex-col shadow-2xl">
            <div className="p-10 text-center bg-emerald-50">
               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Withdrawal Request</p>
               <h3 className="text-5xl font-black text-emerald-900">₹{selectedWithdrawal.amount}</h3>
            </div>
            
            <div className="p-10 space-y-8">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center font-black text-gray-400 uppercase">MC</div>
                  <div>
                    <p className="text-[12px] font-black uppercase text-gray-800">@{selectedWithdrawal.username}</p>
                  </div>
               </div>

               <div className="space-y-3 pt-6">
                  <button onClick={() => { onApproveWithdrawal(selectedWithdrawal.id); setSelectedWithdrawal(null); }} className="w-full py-6 bg-[#006400] text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl active:scale-95 transition-all">Approve & Pay</button>
                  <button onClick={() => { onRejectWithdrawal(selectedWithdrawal.id); setSelectedWithdrawal(null); }} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-lg active:scale-95 transition-all">Reject Request</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── KYC REVIEW MODAL ────────────────────── */}
      {selectedKyc && (() => {
        const kycUser = getKycUser(selectedKyc.user_id);
        const profilePhotos = kycUser?.images || [];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedKyc(null)} />
            <div className="relative bg-[#fdfdfd] rounded-[3rem] w-full overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
              {/* Close */}
              <button onClick={() => setSelectedKyc(null)} className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/20 backdrop-blur-md rounded-full text-white flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <div className="flex-1 overflow-y-auto">
                {/* User basic info */}
                <div className="p-6 bg-orange-50 border-b border-orange-100">
                  <div className="flex items-center gap-4 mb-4">
                    {kycUser?.imageUrl ? (
                      <img src={kycUser.imageUrl} className="w-16 h-16 rounded-3xl object-cover shadow-md" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-3xl flex items-center justify-center text-gray-400 font-black">?</div>
                    )}
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tighter">{kycUser?.name || 'Unknown'}</h3>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">@{kycUser?.username}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-3">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Date of birth</p>
                      <p className="text-xs font-black text-gray-800">{kycUser?.dob || 'N/A'}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-3">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Gender</p>
                      <p className="text-xs font-black text-gray-800">{kycUser?.gender || 'N/A'}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-3 col-span-2">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Location</p>
                      <p className="text-xs font-black text-gray-800">{kycUser?.location || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Profile uploaded photos */}
                {profilePhotos.length > 0 && (
                  <div className="p-6 border-b border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Profile photos ({profilePhotos.length})</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {profilePhotos.map((photo, idx) => (
                        <img key={idx} src={photo} className="w-20 h-24 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Live KYC photos */}
                <div className="p-6">
                  <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-3">Live verification photos</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                      <img src={selectedKyc.live_photo_1} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                        <span className="text-[8px] font-bold text-white uppercase">Photo 1</span>
                      </div>
                    </div>
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                      <img src={selectedKyc.live_photo_2} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                        <span className="text-[8px] font-bold text-white uppercase">Photo 2</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[8px] text-gray-400 font-medium mt-2 text-center">
                    Submitted {new Date(selectedKyc.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-5 border-t border-gray-100 bg-white space-y-2 safe-area-bottom">
                <button
                  onClick={() => handleApproveKyc(selectedKyc)}
                  disabled={kycProcessing}
                  className="w-full py-4 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {kycProcessing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Approve & verify
                </button>
                <button
                  onClick={() => handleRejectKyc(selectedKyc)}
                  disabled={kycProcessing}
                  className="w-full py-3 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
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
