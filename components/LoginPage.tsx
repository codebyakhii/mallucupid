
import React, { useState } from 'react';

interface LoginPageProps {
  onBack: () => void;
  onLogin: (credential: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onGoToSignup: () => void;
  onForgotPassword: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onLogin, onGoToSignup, onForgotPassword }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const LOGIN_BG = "https://res.cloudinary.com/dufnwlqeq/image/upload/v1767281014/WhatsApp_Image_2026-01-01_at_20.51.34_nb0irf.jpg";

  const handleLoginClick = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setError('');
    setIsLoggingIn(true);
    const result = await onLogin(email, password);
    setIsLoggingIn(false);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-cover bg-center flex flex-col overflow-hidden"
      style={{ backgroundImage: `url(${LOGIN_BG})` }}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      <button 
        onClick={onBack}
        disabled={isLoggingIn}
        className="absolute top-6 left-6 z-20 w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform disabled:opacity-50"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-8">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2.5rem] shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl mb-3">
              <span className="text-white font-black text-3xl">M</span>
            </div>
            <h2 className="text-white text-2xl font-bold tracking-tight">Mallu Cupid</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-white/70 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Email / Username</label>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isLoggingIn}
                className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#006400]/50 transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-white/70 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoggingIn}
                className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#006400]/50 transition-all disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl py-3 px-4 text-red-200 text-sm font-semibold animate-shake">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button 
                onClick={onForgotPassword}
                disabled={isLoggingIn} 
                className="text-white/60 text-sm font-medium hover:text-white transition-colors disabled:opacity-50"
              >
                Forgot Password?
              </button>
            </div>

            <button
              onClick={handleLoginClick}
              disabled={isLoggingIn}
              className="w-full h-16 bg-[#006400] text-white rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all mt-4 flex items-center justify-center gap-3 overflow-hidden"
            >
              {isLoggingIn ? (
                <>
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Verifying...</span>
                </>
              ) : (
                "Login"
              )}
            </button>

            <div className="text-center mt-6">
              <button 
                onClick={onGoToSignup}
                disabled={isLoggingIn} 
                className="text-white/60 text-sm disabled:opacity-50"
              >
                Don't have an account? <span className="text-white font-bold underline">Create New Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
