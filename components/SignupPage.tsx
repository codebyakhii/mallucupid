
import React, { useState, useEffect, useRef } from 'react';
import { signUpWithEmail, verifyOtp, resendSignupOtp, createUserProfile, uploadProfileImage, checkUsernameAvailable } from '../lib/auth';
import { reverseGeocode, searchPlaces, getCurrentPosition, fetchCountries } from '../lib/location';

interface SignupPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [signupEmail, setSignupEmail] = useState('');
  const [authUserId, setAuthUserId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    dob: '',
    email: '',
    password: '',
    otp: '',
    location: '',
    bio: '',
    gender: 'Women',
    lookingFor: 'All',
    orientation: 'Straight',
    goal: 'Longterm Partner',
    images: [] as string[],
    imageFiles: [] as File[],
    acceptTerms: false,
    acceptPrivacy: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpTimer, setOtpTimer] = useState(30);
  const [locationQuery, setLocationQuery] = useState('');
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [locationResults, setLocationResults] = useState<Array<{ display: string; city: string; state: string; country: string }>>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [countries, setCountries] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [showCountryFallback, setShowCountryFallback] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    progress: number;
    currentFile: string;
  }>({ isUploading: false, progress: 0, currentFile: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // STEP 1: Validate inputs & create Supabase auth user
  const handleStep1Next = async () => {
    const newErrors: Record<string, string> = {};

    // Name validation: required
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name required';
    }

    // Username validation: lowercase, alphanum + special, 6-20 chars
    const uname = formData.username;
    if (!uname) {
      newErrors.username = 'Username required';
    } else if (uname.length < 6) {
      newErrors.username = 'Minimum 6 characters';
    } else if (uname.length > 20) {
      newErrors.username = 'Maximum 20 characters';
    } else if (uname !== uname.toLowerCase()) {
      newErrors.username = 'Only lowercase letters allowed';
    } else if (!/^[a-z0-9._@#$&!-]+$/.test(uname)) {
      newErrors.username = 'Only lowercase letters, numbers & special chars allowed';
    }

    // DOB validation: required, must be 18+
    if (!formData.dob) {
      newErrors.dob = 'Date of birth required';
    } else {
      const birth = new Date(formData.dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) newErrors.dob = 'You must be 18 or older to join';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    // Password validation: 8-25, upper, lower, num, special
    const pwd = formData.password;
    if (!pwd) {
      newErrors.password = 'Password required';
    } else if (pwd.length < 8) {
      newErrors.password = 'Minimum 8 characters';
    } else if (pwd.length > 25) {
      newErrors.password = 'Maximum 25 characters';
    } else if (!/[A-Z]/.test(pwd)) {
      newErrors.password = 'Must contain one uppercase letter';
    } else if (!/[a-z]/.test(pwd)) {
      newErrors.password = 'Must contain one lowercase letter';
    } else if (!/[0-9]/.test(pwd)) {
      newErrors.password = 'Must contain one number';
    } else if (!/[^A-Za-z0-9]/.test(pwd)) {
      newErrors.password = 'Must contain one special character';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Format name: first letter capital, rest lowercase per word
    const formattedName = formData.fullName.trim().split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    setFormData(prev => ({ ...prev, fullName: formattedName }));

    setIsVerifying(true);
    try {
      // Check username uniqueness
      const available = await checkUsernameAvailable(formData.username);
      if (!available) {
        setErrors({ username: 'Username already taken. Try another.' });
        setIsVerifying(false);
        return;
      }

      const result = await signUpWithEmail(formData.email, formData.password);
      if (result.user) {
        setAuthUserId(result.user.id);
      }
      setSignupEmail(formData.email);
      setErrors({});
      setStep(2);
      setOtpTimer(30);
    } catch (error: any) {
      setErrors({ general: error.message || 'Signup failed. Please try again.' });
    } finally {
      setIsVerifying(false);
    }
  };

  // OTP TIMER
  useEffect(() => {
    let timer: any;
    if (step === 2 && otpTimer > 0) {
      timer = setInterval(() => setOtpTimer(t => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, otpTimer]);

  // STEP 2: Verify OTP from Supabase email
  const handleStep2Next = async () => {
    if (formData.otp.length !== 6) {
      setErrors({ otp: 'Enter 6-digit OTP' });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyOtp(signupEmail, formData.otp);
      if (result.user) {
        setAuthUserId(result.user.id);
      }
      setErrors({});
      setStep(3);
    } catch (error: any) {
      setErrors({ otp: error.message || 'Invalid OTP. Please try again.' });
    } finally {
      setIsVerifying(false);
    }
  };

  // RESEND OTP via Supabase
  const handleResendOTP = async () => {
    if (isResending) return;
    
    setIsResending(true);
    try {
      await resendSignupOtp(signupEmail);
      setOtpTimer(30);
      setErrors({});
    } catch (error: any) {
      setErrors({ general: error.message || 'Failed to resend. Try again.' });
    } finally {
      setIsResending(false);
    }
  };

  // Debounced location search via OpenStreetMap Nominatim
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleLocationSearch = (query: string) => {
    setLocationQuery(query);
    setShowLocationResults(true);
    setFormData(prev => ({ ...prev, location: '' }));
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) { setLocationResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setLocationResults(results);
    }, 400);
  };

  // Auto-detect location via GPS + reverse geocode
  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrors(prev => ({ ...prev, location: '' }));
    try {
      const pos = await getCurrentPosition();
      const geo = await reverseGeocode(pos.lat, pos.lon);
      setFormData(prev => ({ ...prev, location: geo.display }));
      setLocationQuery(geo.display);
      setShowLocationResults(false);
    } catch {
      setErrors(prev => ({ ...prev, location: 'Could not detect location. Search or select country below.' }));
      setShowCountryFallback(true);
      if (countries.length === 0) {
        fetchCountries().then(setCountries).catch(() => {});
      }
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleStep3Next = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.location) {
      newErrors.location = 'Please set your location';
    }
    
    if (formData.bio.trim().length < 10) {
      newErrors.bio = 'Bio must be at least 10 characters long';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsVerifying(true);
    setTimeout(() => { setStep(4); setIsVerifying(false); }, 400);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (formData.images.length + files.length > 10) {
      alert("Maximum 10 images allowed");
      return;
    }

    processFiles(Array.from(files));
    e.target.value = '';
  };

  const processFiles = async (files: File[]) => {
    setUploadState({ isUploading: true, progress: 0, currentFile: files[0].name });
    
    const newImages: string[] = [];
    const newFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadState(prev => ({ ...prev, currentFile: file.name, progress: Math.round((i / files.length) * 100) }));
      
      // Create local preview
      const previewUrl = URL.createObjectURL(file);
      newImages.push(previewUrl);
      newFiles.push(file);
    }

    setFormData(prev => ({ 
      ...prev, 
      images: [...prev.images, ...newImages],
      imageFiles: [...prev.imageFiles, ...newFiles]
    }));
    setUploadState({ isUploading: false, progress: 100, currentFile: '' });
  };

  const handleSubmit = async () => {
    if (formData.images.length < 2) {
      alert("Minimum 2 profile images mandatory");
      return;
    }
    if (!formData.acceptTerms || !formData.acceptPrivacy) {
      alert("Please accept Terms and Privacy Policy");
      return;
    }
    if (!authUserId) {
      setErrors({ general: 'Auth session missing. Please restart signup.' });
      return;
    }
    
    setUploadState({ isUploading: true, progress: 0, currentFile: 'Uploading images...' });
    
    try {
      // Upload all images to Supabase Storage
      const uploadedUrls: string[] = [];
      for (let i = 0; i < formData.imageFiles.length; i++) {
        setUploadState({ 
          isUploading: true, 
          progress: Math.round((i / formData.imageFiles.length) * 80), 
          currentFile: `Image ${i + 1} of ${formData.imageFiles.length}` 
        });
        const url = await uploadProfileImage(authUserId, formData.imageFiles[i]);
        uploadedUrls.push(url);
      }

      setUploadState({ isUploading: true, progress: 90, currentFile: 'Saving profile...' });

      // Calculate age
      const birthDate = new Date(formData.dob);
      const age = new Date().getFullYear() - birthDate.getFullYear();

      // Save complete profile to Supabase
      await createUserProfile(authUserId, {
        full_name: formData.fullName,
        username: formData.username,
        email: formData.email,
        dob: formData.dob,
        age,
        location: formData.location,
        bio: formData.bio,
        gender: formData.gender,
        looking_for: formData.lookingFor,
        orientation: formData.orientation,
        relationship_goal: formData.goal,
        images: uploadedUrls,
      });

      setUploadState({ isUploading: false, progress: 100, currentFile: '' });
      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (error: any) {
      setUploadState({ isUploading: false, progress: 0, currentFile: '' });
      setErrors({ general: error.message || 'Failed to create profile. Try again.' });
    }
  };

  const SIGNUP_BG = "https://res.cloudinary.com/dufnwlqeq/image/upload/v1767281014/WhatsApp_Image_2026-01-01_at_20.51.34_nb0irf.jpg";

  return (
    <div className="fixed inset-0 bg-cover bg-center flex flex-col overflow-hidden" style={{ backgroundImage: `url(${SIGNUP_BG})` }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Header */}
      <div className="relative z-20 flex items-center px-6 h-20 bg-[#006400]/80">
        <button onClick={step === 1 ? onBack : () => setStep(step - 1)} className="text-white p-2 bg-white/10 rounded-full active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 text-center pr-8">
           <span className="text-white font-black uppercase tracking-widest text-xs">Step {step} / 4</span>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 pb-20 pt-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 sm:p-8 rounded-[2rem] shadow-2xl max-w-md mx-auto">
          
          {step === 1 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Create Account</h2>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Full Name</label>
                <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-3.5 px-5 text-white text-sm outline-none focus:border-white/50" placeholder="John Doe" />
                {errors.fullName && <p className="text-red-400 text-[9px] font-black uppercase mt-1 ml-2">{errors.fullName}</p>}
              </div>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Username <span className="text-white/30">(6-20 chars)</span></label>
                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().slice(0, 20)})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-3.5 px-5 text-white text-sm outline-none focus:border-white/50" placeholder="username123" maxLength={20} />
                {errors.username && <p className="text-red-400 text-[9px] font-black uppercase mt-1 ml-2">{errors.username}</p>}
              </div>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Date of Birth</label>
                <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-3.5 px-5 text-white text-sm outline-none focus:border-white/50" />
                {errors.dob && <p className="text-red-400 text-[9px] font-black uppercase mt-1 ml-2">{errors.dob}</p>}
              </div>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.trim()})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-3.5 px-5 text-white text-sm outline-none focus:border-white/50" placeholder="example@email.com" />
                {errors.email && <p className="text-red-400 text-[9px] font-black uppercase mt-1 ml-2">{errors.email}</p>}
              </div>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Password <span className="text-white/30">(8-25, A-z, 0-9, @#$)</span></label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value.slice(0, 25)})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-3.5 px-5 text-white text-sm outline-none focus:border-white/50" placeholder="••••••••" maxLength={25} />
                {errors.password && <p className="text-red-400 text-[9px] font-black uppercase mt-1 ml-2">{errors.password}</p>}
              </div>
              {errors.general && <p className="text-red-400 text-[10px] font-black uppercase text-center bg-red-500/10 py-3 px-4 rounded-lg">{errors.general}</p>}
              <button onClick={handleStep1Next} disabled={isVerifying} className="w-full py-4 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4 active:scale-95 transition-transform shadow-xl disabled:opacity-50 disabled:scale-100">
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Checking...
                  </span>
                ) : 'Next Step'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Verify Email</h2>
              <p className="text-white/60 text-xs font-bold leading-relaxed">We sent a 6-digit code to <span className="text-white">{formData.email}</span>. Please enter it below.</p>
              <div>
                <input 
                  type="text" 
                  maxLength={6} 
                  value={formData.otp} 
                  onChange={e => setFormData({...formData, otp: e.target.value.replace(/\D/g, '')})}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-5 text-center text-3xl font-black tracking-[0.5em] text-white outline-none focus:border-white/50"
                  placeholder="000000"
                />
                {errors.otp && <p className="text-red-400 text-[9px] font-black uppercase mt-2 text-center">{errors.otp}</p>}
              </div>
              <div className="text-center">
                {otpTimer > 0 ? (
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Resend in {otpTimer}s</p>
                ) : (
                  <button 
                    onClick={handleResendOTP} 
                    disabled={isResending}
                    className="text-white font-black uppercase text-[10px] tracking-widest underline decoration-[#006400] underline-offset-4 disabled:opacity-50"
                  >
                    {isResending ? 'Sending...' : 'Resend OTP'}
                  </button>
                )}
              </div>
              {errors.general && <p className="text-red-400 text-[10px] font-black uppercase text-center bg-red-500/10 py-2 px-4 rounded-lg">{errors.general}</p>}
              <button 
                onClick={handleStep2Next} 
                disabled={isVerifying}
                className="w-full py-5 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-transform shadow-xl disabled:opacity-50 disabled:scale-100"
              >
                {isVerifying ? 'Verifying...' : 'Verify & Next'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Tell us more</h2>
              <div className="relative">
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Location</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={locationQuery || formData.location} 
                    onChange={e => handleLocationSearch(e.target.value)}
                    onFocus={() => { if (locationResults.length > 0) setShowLocationResults(true); }}
                    className="flex-1 bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-white/50" 
                    placeholder="Search city or tap detect..." 
                  />
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="bg-white/10 border border-white/20 rounded-2xl px-4 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                    title="Detect my location"
                  >
                    {isDetectingLocation ? (
                      <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
                {errors.location && <p className="text-red-400 text-[9px] font-black uppercase mt-1 ml-2">{errors.location}</p>}
                
                {showLocationResults && locationQuery && locationResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl z-[60] overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                    {locationResults.map((loc, i) => (
                      <button 
                        key={i}
                        type="button"
                        onClick={() => { setFormData({...formData, location: loc.display}); setLocationQuery(loc.display); setShowLocationResults(false); }}
                        className="w-full px-6 py-4 text-left text-white text-xs font-bold hover:bg-white/10 border-b border-white/5 last:border-0 active:bg-white/20"
                      >
                        <span className="text-white/90">{loc.city || loc.display}</span>
                        {loc.state && <span className="text-white/50">, {loc.state}</span>}
                        {loc.country && <span className="text-white/40">, {loc.country}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {showCountryFallback && (
                  <div className="mt-3">
                    <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Or Select Country</label>
                    <select 
                      value="" 
                      onChange={e => { setFormData({...formData, location: e.target.value}); setLocationQuery(e.target.value); setShowCountryFallback(false); }}
                      className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-4 text-white text-xs font-bold outline-none"
                    >
                      <option value="" className="bg-gray-800">Select a country...</option>
                      {countries.map(c => (
                        <option key={c.code} value={c.name} className="bg-gray-800">{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5 px-1">
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Bio</label>
                  <span className="text-[8px] font-black text-white/40">{formData.bio.length} / 350</span>
                </div>
                <textarea 
                  value={formData.bio} 
                  maxLength={350}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white text-sm h-24 resize-none outline-none focus:border-white/50" 
                  placeholder="Tell others about yourself..." 
                />
                {errors.bio && <p className="text-red-400 text-[9px] font-black uppercase mt-1 ml-2">{errors.bio}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Gender</label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-4 text-white text-xs font-bold outline-none">
                    <option value="Men" className="bg-gray-800">Men</option>
                    <option value="Women" className="bg-gray-800">Women</option>
                    <option value="Transman" className="bg-gray-800">Transman</option>
                    <option value="Transwoman" className="bg-gray-800">Transwoman</option>
                    <option value="Other" className="bg-gray-800">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Looking For</label>
                  <select value={formData.lookingFor} onChange={e => setFormData({...formData, lookingFor: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-4 text-white text-xs font-bold outline-none">
                    <option value="Men" className="bg-gray-800">Men</option>
                    <option value="Women" className="bg-gray-800">Women</option>
                    <option value="Transmen" className="bg-gray-800">Transmen</option>
                    <option value="Transwomen" className="bg-gray-800">Transwomen</option>
                    <option value="All" className="bg-gray-800">All</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Orientation</label>
                <select value={formData.orientation} onChange={e => setFormData({...formData, orientation: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-4 text-white text-xs font-bold outline-none">
                  <option value="Straight" className="bg-gray-800">Straight</option>
                  <option value="Bisexual" className="bg-gray-800">Bisexual</option>
                  <option value="Lesbian" className="bg-gray-800">Lesbian</option>
                  <option value="Gay" className="bg-gray-800">Gay</option>
                  <option value="Pansexual" className="bg-gray-800">Pansexual</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1 mb-1.5 block">Relationship Goal</label>
                <select value={formData.goal} onChange={e => setFormData({...formData, goal: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-4 text-white text-xs font-bold outline-none">
                  <option value="Longterm Partner" className="bg-gray-800">Longterm partner</option>
                  <option value="Short term" className="bg-gray-800">Short term</option>
                  <option value="FWB" className="bg-gray-800">FWB</option>
                  <option value="Any" className="bg-gray-800">Any</option>
                  <option value="New Friends" className="bg-gray-800">New friends</option>
                </select>
              </div>
              <button 
                type="button"
                onClick={handleStep3Next}
                disabled={isVerifying}
                className="w-full py-4 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4 active:scale-95 transition-transform shadow-xl disabled:opacity-50 disabled:scale-100"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Loading...
                  </span>
                ) : 'Next Step'}
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-black text-white uppercase tracking-tighter">Add Your Photos</h2>
              
              <div className="relative">
                <div className="grid grid-cols-3 gap-3">
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/20 relative group">
                      <img src={img} className="w-full h-full object-cover" />
                      <button onClick={() => setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i), imageFiles: formData.imageFiles.filter((_, idx) => idx !== i)})} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
                      </button>
                    </div>
                  ))}
                  {formData.images.length < 10 && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadState.isUploading}
                      className={`aspect-square bg-white/10 border-2 border-dashed border-white/20 rounded-2xl flex items-center justify-center text-white/40 active:scale-95 transition-transform ${uploadState.isUploading ? 'opacity-30' : ''}`}
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  )}
                </div>

                {uploadState.isUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-md rounded-[2rem] flex flex-col items-center justify-center p-6 z-50 animate-in fade-in duration-300">
                    <div className="relative w-20 h-20 mb-6">
                      <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                      <div 
                        className="absolute inset-0 border-4 border-[#006400] rounded-full border-t-transparent animate-spin" 
                        style={{ borderTopColor: '#00ff00', transition: 'all 0.3s ease' }} 
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                        {uploadState.progress}%
                      </div>
                    </div>
                    <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] mb-2 animate-pulse">Uploading Photos</p>
                    <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest truncate max-w-full italic px-4">
                      {uploadState.currentFile}
                    </p>
                    <div className="w-full max-w-[120px] h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
                      <div 
                        className="h-full bg-[#00ff00] transition-all duration-300 shadow-[0_0_10px_#00ff00]" 
                        style={{ width: `${uploadState.progress}%` }} 
                      />
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest text-center">
                {formData.images.length < 2 ? "Minimum 2 images mandatory" : `${formData.images.length} / 10 images uploaded`}
              </p>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.acceptTerms ? 'bg-[#006400] border-[#006400]' : 'border-white/20 bg-white/5'}`}>
                    {formData.acceptTerms && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" checked={formData.acceptTerms} onChange={e => setFormData({...formData, acceptTerms: e.target.checked})} className="hidden" />
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest group-hover:text-white transition-colors">I accept terms and conditions</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.acceptPrivacy ? 'bg-[#006400] border-[#006400]' : 'border-white/20 bg-white/5'}`}>
                    {formData.acceptPrivacy && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" checked={formData.acceptPrivacy} onChange={e => setFormData({...formData, acceptPrivacy: e.target.checked})} className="hidden" />
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest group-hover:text-white transition-colors">I accept privacy policy</span>
                </label>
              </div>

              <button 
                onClick={handleSubmit} 
                disabled={uploadState.isUploading}
                className={`w-full py-4 bg-[#006400] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl transition-all disabled:opacity-50 disabled:scale-100 ${uploadState.isUploading ? '' : 'active:scale-95'}`}
              >
                {uploadState.isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Creating Account...
                  </span>
                ) : 'Create Account'}
              </button>
            </div>
          )}

        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept="image/*" 
        onChange={handleImageUpload} 
      />

      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] bg-[#006400] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
           <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
           </div>
           <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Account Created!</h2>
           <p className="text-white/70 text-sm font-bold uppercase tracking-widest">Welcome to MalluCupid. Taking you in...</p>
        </div>
      )}
    </div>
  );
};

export default SignupPage;
