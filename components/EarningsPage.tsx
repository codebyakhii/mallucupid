
import React, { useState, useEffect } from 'react';
import { Earning, WithdrawalRequest, Profile } from '../types';
import { supabase } from '../lib/supabase';

interface EarningsPageProps {
  onBack: () => void;
  currentUser: Profile;
}

const EarningsPage: React.FC<EarningsPageProps> = ({ onBack, currentUser }) => {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [balance, setBalance] = useState(0);

  const fetchData = async () => {
    try {
      const [earningsRes, withdrawalsRes, profileRes] = await Promise.all([
        supabase.from('earnings').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        supabase.from('withdrawals').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('balance').eq('id', currentUser.id).single(),
      ]);
      if (earningsRes.data) setEarnings(earningsRes.data);
      if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data);
      if (profileRes.data) setBalance(profileRes.data.balance || 0);
    } catch (err) {
      console.error('Failed to load earnings data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser.id]);

  const totalEarned = earnings.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingAmount = withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + Number(w.amount), 0);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid amount'); return; }
    if (amount > balance) { setError('Insufficient balance'); return; }
    if (amount < 500) { setError('Minimum withdrawal is ₹500'); return; }

    setIsSubmitting(true);
    setError('');
    try {
      const { error: insertErr } = await supabase.from('withdrawals').insert({
        user_id: currentUser.id,
        amount,
        status: 'pending',
      });
      if (insertErr) throw insertErr;

      setWithdrawAmount('');
      setShowSuccessModal(true);
      await fetchData();
    } catch (err: any) {
      console.error('Withdrawal request error:', err);
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#fdf8f5] items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-gray-200 border-t-[#006400] rounded-full animate-spin" />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-4">Loading earnings</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto pb-40">
      <header className="p-6 flex items-center gap-4 border-b border-orange-100 bg-white sticky top-0 z-30 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-500 active:scale-75 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-none">My Earnings</h1>
      </header>

      <div className="p-6 space-y-8">
        {/* Balance Card */}
        <div className="bg-black rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Available Balance</p>
            <h2 className="text-5xl font-black tracking-tighter mb-8">₹{balance.toLocaleString()}</h2>
            
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40 font-black">₹</span>
                <input 
                  type="number" 
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Withdraw amount"
                  className="w-full bg-white/10 border-2 border-white/20 rounded-2xl py-4 pl-10 pr-6 text-sm font-bold outline-none focus:border-white/40 transition-all placeholder-white/20"
                />
              </div>
              
              {error && <p className="text-red-400 text-[9px] font-black uppercase tracking-widest px-2 animate-pulse">{error}</p>}

              <button 
                onClick={handleWithdraw}
                disabled={isSubmitting}
                className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                {isSubmitting ? 'Submitting...' : 'Request withdrawal'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-orange-50 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Lifetime Total</p>
            <p className="text-lg font-black text-gray-800">₹{totalEarned.toLocaleString()}</p>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-orange-50 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Pending Processing</p>
            <p className="text-lg font-black text-orange-500">₹{pendingAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-1 h-4 bg-red-500 rounded-full" />
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction Log</h3>
          </div>

          <div className="space-y-3">
            {earnings.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest">No transactions yet</p>
              </div>
            ) : (
              earnings.map(e => (
                <div key={e.id} className="bg-white p-5 rounded-[2rem] border border-orange-50 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${e.type === 'gallery_purchase' ? 'bg-blue-50 text-blue-500' : e.type === 'tip' ? 'bg-orange-50 text-orange-500' : 'bg-gray-50 text-gray-500'}`}>
                      {e.type === 'gallery_purchase' ? '🛒' : e.type === 'tip' ? '💝' : '💰'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <p className="text-[10px] font-black uppercase text-gray-800">{e.description || e.type.replace('_', ' ')}</p>
                         <span className="text-[8px] font-bold text-gray-400 uppercase px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100">{e.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{new Date(e.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-[#006400]">₹{Number(e.amount).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Withdrawal History */}
        {withdrawals.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full" />
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Withdrawal history</h3>
            </div>
            <div className="space-y-3">
              {withdrawals.map(w => (
                <div key={w.id} className="bg-white/60 p-5 rounded-[2rem] border border-orange-50/50 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase text-gray-500">{new Date(w.created_at).toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className={`w-1.5 h-1.5 rounded-full ${w.status === 'pending' ? 'bg-yellow-500' : w.status === 'approved' ? 'bg-green-500' : w.status === 'held' ? 'bg-orange-500' : 'bg-red-500'}`} />
                       <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{w.status}</span>
                    </div>
                  </div>
                  <p className="text-sm font-black text-gray-800">-₹{Number(w.amount).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowSuccessModal(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-4">Request Sent</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">Funds are typically processed within <span className="text-gray-800">15-30 minutes</span> by the Admin team.</p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EarningsPage;
