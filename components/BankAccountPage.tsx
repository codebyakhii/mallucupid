
import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';

interface BankAccountPageProps {
  onBack: () => void;
  currentUser: Profile;
}

const BankAccountPage: React.FC<BankAccountPageProps> = ({ onBack, currentUser }) => {
  const [details, setDetails] = useState({
    accountName: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    branch: '',
    paymentNumber: '',
    upiId: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBankInfo = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('profiles')
          .select('bank_info')
          .eq('id', currentUser.id)
          .single();
        if (fetchErr) throw fetchErr;
        if (data?.bank_info) {
          setDetails({
            accountName: data.bank_info.accountName || '',
            accountNumber: data.bank_info.accountNumber || '',
            ifsc: data.bank_info.ifsc || '',
            bankName: data.bank_info.bankName || '',
            branch: data.bank_info.branch || '',
            paymentNumber: data.bank_info.paymentNumber || '',
            upiId: data.bank_info.upiId || '',
          });
        }
      } catch (err) {
        console.error('Failed to load bank info:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadBankInfo();
  }, [currentUser.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSave = async () => {
    if (!details.accountName.trim() || !details.accountNumber.trim() || !details.ifsc.trim() || !details.bankName.trim()) {
      setError('Account name, number, IFSC, and bank name are required');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          bank_info: {
            accountName: details.accountName.trim(),
            accountNumber: details.accountNumber.trim(),
            ifsc: details.ifsc.trim().toUpperCase(),
            bankName: details.bankName.trim(),
            branch: details.branch.trim(),
            paymentNumber: details.paymentNumber.trim(),
            upiId: details.upiId.trim(),
          }
        })
        .eq('id', currentUser.id);
      if (updateErr) throw updateErr;
      setShowSuccess(true);
    } catch (err: any) {
      console.error('Save bank info error:', err);
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#fdf8f5] items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-gray-200 border-t-[#006400] rounded-full animate-spin" />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-4">Loading bank details</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto pb-40">
      <header className="p-6 flex items-center gap-4 border-b border-orange-100 bg-white sticky top-0 z-30 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-black active:scale-75 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-black text-black uppercase tracking-tighter leading-none">Bank Account</h1>
      </header>

      <div className="p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-1.5 h-1.5 bg-[#006400] rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Primary Bank Details</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Account Name</label>
              <input 
                type="text" name="accountName" value={details.accountName} onChange={handleChange}
                placeholder="FULL NAME AS PER BANK"
                className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none focus:ring-2 focus:ring-[#006400]/10 uppercase"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Account Number</label>
              <input 
                type="text" name="accountNumber" value={details.accountNumber} onChange={handleChange}
                placeholder="1234567890"
                className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none focus:ring-2 focus:ring-[#006400]/10"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">IFSC Code</label>
              <input 
                type="text" name="ifsc" value={details.ifsc} onChange={handleChange}
                placeholder="SBIN0001234"
                className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none focus:ring-2 focus:ring-[#006400]/10 uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Bank Name</label>
                <input 
                  type="text" name="bankName" value={details.bankName} onChange={handleChange}
                  placeholder="SBI / HDFC"
                  className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none uppercase"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Branch</label>
                <input 
                  type="text" name="branch" value={details.branch} onChange={handleChange}
                  placeholder="LOCATION"
                  className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Mobile Payment (Optional)</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">GPay / PhonePe Number</label>
              <input 
                type="text" name="paymentNumber" value={details.paymentNumber} onChange={handleChange}
                placeholder="9876543210"
                className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">UPI ID</label>
              <input 
                type="text" name="upiId" value={details.upiId} onChange={handleChange}
                placeholder="username@okaxis"
                className="w-full bg-white border border-orange-100 rounded-2xl py-4 px-6 font-bold text-sm outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-[9px] font-black uppercase tracking-widest px-2 animate-pulse">{error}</p>
        )}

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-5 bg-black text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all mt-8 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {isSaving ? 'Saving...' : 'Save bank details'}
        </button>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowSuccess(false)} />
          <div className="relative bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
               </svg>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-4 text-black">Bank details updated</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-10">
              Your information has been saved securely. Withdrawals will be processed to this account.
            </p>
            <button 
              onClick={() => setShowSuccess(false)}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccountPage;
