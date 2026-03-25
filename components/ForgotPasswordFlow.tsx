
import React, { useState, useEffect } from 'react';
import { sendPasswordResetEmail, updatePassword } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface ForgotPasswordFlowProps {
  onBack: () => void;
  onSuccess: () => void;
}

const ForgotPasswordFlow: React.FC<ForgotPasswordFlowProps> = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState<'email' | 'reset' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const LOGIN_BG = "https://res.cloudinary.com/dufnwlqeq/image/upload/v1767281014/WhatsApp_Image_2026-01-01_at_20.51.34_nb0irf.jpg";

  // Listen for PASSWORD_RECOVERY event (when user clicks reset link in email and returns)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStep('reset');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleEmailNext = async () => {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setIsVerifying(true);
    try {
      await sendPasswordResetEmail(email);
      setEmailSent(true);
    } catch (e: any) {
      setError(e.message || 'Failed to send reset email. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetSubmit = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsVerifying(true);
    try {
      await updatePassword(newPassword);
      setStep('success');
      setTimeout(() => onSuccess(), 2000);
    } catch (e: any) {
      setError(e.message || 'Failed to update password');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-cover bg-center flex flex-col overflow-hidden" style={{ backgroundImage: `url(${LOGIN_BG})` }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <header className="relative z-50 flex items-center px-6 h-20 bg-[#006400]">
        <button onClick={onBack} className="text-white p-2 bg-white/10 rounded-full active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 text-center pr-8">
           <span className="text-white font-black uppercase tracking-widest text-xs">Reset Password</span>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-8">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[3rem] shadow-2xl">
          {step === 'email' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                 </div>
                 <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Forgot Password?</h2>
              </div>

              {!emailSent ? (
                <>
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Email Address</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-white/50" 
                      placeholder="example@email.com" 
                    />
                    {error && <p className="text-red-400 text-[9px] font-black uppercase mt-2 ml-2 animate-pulse">{error}</p>}
                  </div>

                  <button 
                    onClick={handleEmailNext}
                    disabled={isVerifying}
                    className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {isVerifying ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-white/80 text-sm font-bold">Reset link sent to <span className="text-white">{email}</span></p>
                  <p className="text-white/50 text-xs">Check your inbox and click the reset link. You'll be redirected back here to set a new password.</p>
                  <button 
                    onClick={() => { setEmailSent(false); setError(''); }}
                    className="text-white/60 text-xs font-bold underline"
                  >
                    Try a different email
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'reset' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">New Password</h2>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Create New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-white/50" 
                  placeholder="••••••••" 
                />
                <p className="text-white/40 text-[8px] font-bold mt-2 ml-2">Minimum 6 characters</p>
                {error && <p className="text-red-400 text-[9px] font-black uppercase mt-2 ml-2">{error}</p>}
              </div>

              <button 
                onClick={handleResetSubmit} 
                disabled={isVerifying}
                className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform"
              >
                Update Password
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-10 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(0,255,0,0.3)]">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Password Updated</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordFlow;
