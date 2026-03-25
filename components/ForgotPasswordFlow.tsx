
import React, { useState } from 'react';
import { sendPasswordResetOtp, verifyPasswordResetOtp, updatePassword } from '../lib/auth';

interface ForgotPasswordFlowProps {
  onBack: () => void;
  onSuccess: () => void;
}

const ForgotPasswordFlow: React.FC<ForgotPasswordFlowProps> = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState<'email' | 'otp' | 'reset' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const LOGIN_BG = "https://res.cloudinary.com/dufnwlqeq/image/upload/v1767281014/WhatsApp_Image_2026-01-01_at_20.51.34_nb0irf.jpg";

  const handleSendOtp = async () => {
    setError('');
    if (!email.trim()) { setError('Email is required'); return; }

    setIsLoading(true);
    try {
      await sendPasswordResetOtp(email);
      setStep('otp');
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return; }

    setIsLoading(true);
    try {
      await verifyPasswordResetOtp(email, otp);
      setStep('reset');
    } catch (e: any) {
      setError(e.message || 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    setIsLoading(true);
    try {
      await updatePassword(newPassword);
      setStep('success');
      setTimeout(() => onSuccess(), 2000);
    } catch (e: any) {
      setError(e.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setIsLoading(true);
    try {
      await sendPasswordResetOtp(email);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-cover bg-center flex flex-col overflow-hidden" style={{ backgroundImage: `url(${LOGIN_BG})` }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <header className="relative z-50 flex items-center px-6 h-20 bg-[#006400]">
        <button onClick={step === 'email' ? onBack : () => setStep(step === 'otp' ? 'email' : step === 'reset' ? 'otp' : 'email')} className="text-white p-2 bg-white/10 rounded-full active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 text-center pr-8">
           <span className="text-white font-black uppercase tracking-widest text-xs">Reset Password</span>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-8">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[3rem] shadow-2xl">
          
          {/* Step 1: Enter Email */}
          {step === 'email' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Forgot Password?</h2>
                <p className="text-white/50 text-xs mt-2">We'll send a 6-digit code to your email</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Email Address</label>
                <input 
                  type="email" value={email} onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-white/50" 
                  placeholder="example@email.com" 
                />
                {error && <p className="text-red-400 text-[9px] font-black uppercase mt-2 ml-2 animate-pulse">{error}</p>}
              </div>

              <button onClick={handleSendOtp} disabled={isLoading}
                className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform disabled:opacity-50">
                {isLoading ? 'Sending...' : 'Send OTP Code'}
              </button>
            </div>
          )}

          {/* Step 2: Enter OTP */}
          {step === 'otp' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Enter OTP</h2>
                <p className="text-white/50 text-xs mt-2">Code sent to <span className="text-white font-bold">{email}</span></p>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">6-Digit Code</label>
                <input 
                  type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-2xl text-center font-mono tracking-[0.5em] outline-none focus:border-white/50" 
                  placeholder="000000" maxLength={6}
                />
                {error && <p className="text-red-400 text-[9px] font-black uppercase mt-2 ml-2 animate-pulse">{error}</p>}
              </div>

              <button onClick={handleVerifyOtp} disabled={isLoading}
                className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform disabled:opacity-50">
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button onClick={handleResendOtp} disabled={isLoading}
                className="w-full text-white/60 text-xs font-bold underline text-center">
                Resend Code
              </button>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 'reset' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">New Password</h2>
                <p className="text-white/50 text-xs mt-2">OTP verified! Set your new password</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-white/50" 
                  placeholder="••••••••" />
                <p className="text-white/40 text-[8px] font-bold mt-2 ml-2">Minimum 6 characters</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-white/50" 
                  placeholder="••••••••" />
                {error && <p className="text-red-400 text-[9px] font-black uppercase mt-2 ml-2 animate-pulse">{error}</p>}
              </div>

              <button onClick={handleResetPassword} disabled={isLoading}
                className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform disabled:opacity-50">
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          )}

          {/* Step 4: Success */}
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
