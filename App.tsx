
import React, { useState, useEffect, useMemo } from 'react';
import { View, Profile, ProConfig } from './types';
import { LANDING_BG } from './constants';
import { supabase } from './lib/supabase';
import { loginWithEmail, fetchUserProfile, fetchAllProfiles, signOut, getCurrentSession } from './lib/auth';
import DesktopBlocker from './components/DesktopBlocker';
import Discover from './components/Discover';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import ForgotPasswordFlow from './components/ForgotPasswordFlow';
import UserDetails from './components/UserDetails';
import FriendsPage from './components/FriendsPage';
import AlertsPage from './components/AlertsPage';
import EditProfile from './components/EditProfile';
import PrivateGallery from './components/PrivateGallery';
import PrivateGalleryView from './components/PrivateGalleryView';
import EarningsPage from './components/EarningsPage';
import VerificationPage from './components/VerificationPage';
import BlockedUsersPage from './components/BlockedUsersPage';
import ChatPage from './components/ChatPage';
import InboxPage from './components/InboxPage';
import AdminDashboard from './components/AdminDashboard';
import BankAccountPage from './components/BankAccountPage';

const App: React.FC = () => {
  const [view, setView] = useState<View>('landing');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [proConfig, setProConfig] = useState<ProConfig>({ price: 99, duration: 30 });
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [activeRequests, setActiveRequests] = useState<string[]>([]);
  const [linkedProfiles, setLinkedProfiles] = useState<Profile[]>([]);

  const isPro = useMemo(() => {
    if (!currentUser?.proExpiry) return false;
    return currentUser.proExpiry > Date.now();
  }, [currentUser]);

  const handleProfileUpdate = (profile: Profile) => {
    setCurrentUser(profile);
    setAllUsers(prev => prev.map(u => u.id === profile.id ? profile : u));
  };

  const refreshConnectionData = async (userId?: string) => {
    const uid = userId || currentUser?.id;
    if (!uid) return;

    // Fetch blocked IDs
    const { data: blocks } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid);
    const bIds = (blocks || []).map(b => b.blocked_id);
    setBlockedIds(bIds);

    // Fetch active (pending) outgoing requests
    const { data: pending } = await supabase.from('connection_requests').select('to_id').eq('from_id', uid).eq('status', 'pending');
    setActiveRequests((pending || []).map(r => r.to_id));

    // Fetch linked (accepted) profiles
    const { data: accepted } = await supabase.from('connection_requests').select('from_id, to_id').eq('status', 'accepted')
      .or(`from_id.eq.${uid},to_id.eq.${uid}`);
    if (accepted) {
      const friendIds = accepted.map(c => c.from_id === uid ? c.to_id : c.from_id);
      const blockedSet = new Set(bIds);
      setLinkedProfiles(allUsers.filter(p => friendIds.includes(p.id) && !blockedSet.has(p.id)));
    } else {
      setLinkedProfiles([]);
    }
  };

  // ─── SESSION RESTORATION ON MOUNT ──────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await getCurrentSession();
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setCurrentUser(profile);
            const users = await fetchAllProfiles();
            setAllUsers(users);
            await refreshConnectionData(session.user.id);
            setView(profile.role === 'admin' ? 'adminDashboard' : 'discover');
          }
        }
      } catch {
        // No session — stay on landing
      } finally {
        setIsLoading(false);
      }
    };

    const checkSize = () => setIsDesktop(window.innerWidth > 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    restoreSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAllUsers([]);
        setView('landing');
      }
    });

    return () => {
      window.removeEventListener('resize', checkSize);
      subscription.unsubscribe();
    };
  }, []);

  // Prevent browser back button from going to landing while logged in
  useEffect(() => {
    if (!currentUser) return;
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setShowLogoutConfirm(true);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  const handlePurchasePro = async () => {
    if (!currentUser) return;
    const expiry = Date.now() + (proConfig.duration * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from('profiles').update({ pro_expiry: new Date(expiry).toISOString() }).eq('id', currentUser.id);
    if (error) { console.error('Pro purchase error:', error); alert('Failed to activate Pro. Please try again.'); return; }
    const updated = { ...currentUser, proExpiry: expiry };
    setCurrentUser(updated);
    setAllUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    alert("Congratulations! You are now a Pro Member.");
  };

  const handleUpdateProConfig = (newConfig: ProConfig) => setProConfig(newConfig);

  const handleLike = async (profile: Profile) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('connection_requests').insert({
        from_id: currentUser.id,
        to_id: profile.id,
        status: 'pending',
      });
      if (error) { console.error(error); return; }
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'request',
        from_user_id: currentUser.id,
        text: 'sent you a connection request',
      });
      refreshConnectionData();
    } catch (err) { console.error(err); }
  };

  const handleLogin = async (credential: string, password: string) => {
    try {
      const authData = await loginWithEmail(credential, password);
      if (!authData.user) return { success: false, error: 'Login failed' };

      const profile = await fetchUserProfile(authData.user.id);
      if (!profile) return { success: false, error: 'Profile not found. Please sign up first.' };

      if (profile.status === 'blocked') return { success: false, error: 'Your account has been suspended.' };

      setCurrentUser(profile);
      const users = await fetchAllProfiles();
      setAllUsers(users);
      await refreshConnectionData(authData.user.id);
      setView(profile.role === 'admin' ? 'adminDashboard' : 'discover');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Invalid email or password' };
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    try { await signOut(); } catch {}
    setCurrentUser(null);
    setAllUsers([]);
    setView('landing');
  };
  const navigateToView = (newView: View) => { setIsLoading(true); setTimeout(() => { setView(newView); setIsLoading(false); }, 600); };

  if (isDesktop) return <DesktopBlocker />;
  if (isLoading) return (
    <div className="fixed inset-0 z-[100] bg-[#fffafa] flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-[#006400] border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black uppercase text-[#006400] tracking-[0.3em] animate-pulse">Mallu Cupid</p>
    </div>
  );

  const renderContent = () => {
    switch (view) {
      case 'landing': return (
        <div className="fixed inset-0 bg-cover bg-center flex flex-col justify-end" style={{ backgroundImage: `url(${LANDING_BG})` }}>
          <div className="p-8 pb-16 flex flex-col items-center w-full bg-gradient-to-t from-black/80 to-transparent">
            <button onClick={() => navigateToView('login')} className="w-full max-w-xs py-5 bg-[#006400] text-white rounded-full font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all">Get Started</button>
            <div className="mt-6 flex gap-6">
              <button onClick={() => navigateToView('terms')} className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">Terms & Conditions</button>
              <button onClick={() => navigateToView('privacy')} className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">Privacy Policy</button>
            </div>
          </div>
        </div>
      );
      case 'terms': return (
        <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto">
          <header className="p-6 flex items-center gap-4 bg-white border-b border-orange-100 sticky top-0 z-30 shadow-sm">
            <button onClick={() => setView('landing')} className="p-2 -ml-2 text-gray-500 active:scale-75 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Terms & Conditions</h1>
          </header>
          <div className="p-8 space-y-6 text-sm text-gray-600 font-medium leading-relaxed pb-32">
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">1. Eligibility</h3><p>You must be at least 18 years old to create an account on Mallu Cupid.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">2. User Conduct</h3><p>Harassment, hate speech, or sharing explicit content without consent is strictly prohibited.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">3. Account Safety</h3><p>You are responsible for maintaining the confidentiality of your login credentials.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">4. Pro Subscription</h3><p>Pro Membership provides enhanced features like private chatting.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">5. Termination</h3><p>We reserve the right to terminate your account if you violate these terms.</p>
          </div>
        </div>
      );
      case 'privacy': return (
        <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto">
          <header className="p-6 flex items-center gap-4 bg-white border-b border-orange-100 sticky top-0 z-30 shadow-sm">
            <button onClick={() => setView('landing')} className="p-2 -ml-2 text-gray-500 active:scale-75 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Privacy Policy</h1>
          </header>
          <div className="p-8 space-y-6 text-sm text-gray-600 font-medium leading-relaxed pb-32">
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">1. Information We Collect</h3><p>We collect information you provide directly, such as your name, age, gender, location, and photos.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">2. How We Use Data</h3><p>Your data is used to provide our matchmaking services.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">3. Data Sharing</h3><p>We do not sell your personal data.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">4. Security</h3><p>We implement industry-standard security measures to protect your data.</p>
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">5. Your Controls</h3><p>You can edit your profile, block users, or delete your account at any time.</p>
          </div>
        </div>
      );
      case 'login': return <LoginPage onBack={() => setView('landing')} onLogin={handleLogin} onGoToSignup={() => setView('signup')} onForgotPassword={() => setView('forgotPassword')} />;
      case 'signup': return <SignupPage onBack={() => setView('login')} onSuccess={async () => {
        try {
          const session = await getCurrentSession();
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id);
            if (profile) {
              setCurrentUser(profile);
              const users = await fetchAllProfiles();
              setAllUsers(users);
              setView('discover');
              return;
            }
          }
        } catch {}
        setView('login');
      }} />;
      case 'forgotPassword': return <ForgotPasswordFlow onBack={() => setView('login')} onSuccess={() => setView('login')} />;
      case 'adminDashboard': return (
        <AdminDashboard 
          onBack={() => setShowLogoutConfirm(true)} 
          onLogout={handleLogout}
          proConfig={proConfig}
          onUpdateProConfig={handleUpdateProConfig}
        />
      );
      case 'discover': return currentUser && <Discover users={allUsers} onLike={handleLike} onDislike={() => {}} onShowDetails={(p) => { setSelectedProfile(p); setView('userDetails'); }} blockedIds={blockedIds} currentUser={currentUser} activeRequests={activeRequests} />;
      case 'userDetails': return selectedProfile && currentUser && (
        <UserDetails profile={allUsers.find(u => u.id === selectedProfile.id) || selectedProfile} currentUserId={currentUser.id} onBack={() => setView('discover')}
          onOpenPrivateGallery={() => setView('privateGalleryView')}
          onChat={() => setView('chat')}
          isPro={isPro} onGetPro={handlePurchasePro} onConnectionChange={() => refreshConnectionData()} />
      );
      case 'chat': return selectedProfile && currentUser && <ChatPage targetProfile={selectedProfile} onBack={() => setView('userDetails')} currentUserId={currentUser.id} />;
      case 'inbox': return currentUser && <InboxPage currentUser={currentUser} friends={linkedProfiles} onSelectChat={(p) => { setSelectedProfile(p); setView('chat'); }} onDeleteChat={() => refreshConnectionData()} isPro={isPro} onGetPro={handlePurchasePro} />;
      case 'friends': return currentUser && <FriendsPage currentUserId={currentUser.id} allUsers={allUsers} onShowDetails={(p) => { setSelectedProfile(p); setView('userDetails'); }} onConnectionChange={() => refreshConnectionData()} />;
      case 'notifications': return currentUser && <AlertsPage currentUserId={currentUser.id} allUsers={allUsers} onConnectionAccepted={() => refreshConnectionData()} />;
      case 'profile': return currentUser && <EditProfile userProfile={currentUser} onUpdate={handleProfileUpdate} onNavigate={navigateToView} onLogout={handleLogout} />;
      case 'earnings': return currentUser && <EarningsPage onBack={() => setView('profile')} currentUser={currentUser} />;
      case 'bankAccount': return currentUser && <BankAccountPage onBack={() => setView('profile')} currentUser={currentUser} />;
      case 'blockedUsers': return currentUser && <BlockedUsersPage currentUserId={currentUser.id} onBack={() => setView('profile')} allUsers={allUsers} />;
      case 'privateGallery': return currentUser && <PrivateGallery currentUser={currentUser} onBack={() => setView('profile')} />;
      case 'privateGalleryView': return selectedProfile && currentUser && <PrivateGalleryView targetProfile={selectedProfile} currentUserId={currentUser.id} onBack={() => setView('userDetails')} />;
      case 'verification': return currentUser && <VerificationPage currentUser={currentUser} onBack={() => setView('profile')} />;
      default: return null;
    }
  };

  const mainViews = ['discover', 'friends', 'privateGallery', 'notifications', 'profile', 'inbox'];
  const showNav = mainViews.includes(view);

  const navItems = [
    {
      id: 'discover',
      label: 'Discover',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
          {active
            ? <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          }
        </svg>
      ),
    },
    {
      id: 'friends',
      label: 'Matches',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
          {active
            ? <><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></>
            : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          }
        </svg>
      ),
    },
    {
      id: 'privateGallery',
      label: 'Gallery',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
          {active
            ? <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5zM12.75 8.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          }
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Alerts',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
          {active
            ? <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          }
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (active: boolean) => (
        currentUser?.imageUrl ? (
          <div className={`w-7 h-7 rounded-full overflow-hidden ${active ? 'ring-2 ring-[#FF4458]' : 'ring-1 ring-gray-300'}`}>
            <img src={currentUser.imageUrl} className="w-full h-full object-cover" alt="" />
          </div>
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
            {active
              ? <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            }
          </svg>
        )
      ),
    },
  ];

  return (
    <div className="fixed inset-0 bg-[#fffafa] flex flex-col overflow-hidden">
      {/* Header */}
      {showNav && (
        <header className="flex items-center justify-between px-5 h-14 bg-white z-50 border-b border-gray-100">
          <button onClick={() => setShowLogoutConfirm(true)} className="w-9 h-9 flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
          </button>
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setView('discover')}>
            <div className="w-8 h-8 bg-gradient-to-br from-[#FF4458] to-[#FF7854] rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-sm">M</span>
            </div>
            <span className="text-lg font-black bg-gradient-to-r from-[#FF4458] to-[#FF7854] bg-clip-text text-transparent">mallucupid</span>
          </div>
          <button onClick={() => setView('inbox')} className={`w-9 h-9 flex items-center justify-center transition-transform active:scale-90 ${view === 'inbox' ? 'text-[#FF4458]' : 'text-gray-400'}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={view === 'inbox' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={view === 'inbox' ? 0 : 2}>
              {view === 'inbox'
                ? <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h2.387c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              }
            </svg>
          </button>
        </header>
      )}

      <main className="flex-1 relative overflow-hidden bg-[#fffafa]">{renderContent()}</main>

      {/* Bottom Navigation */}
      {showNav && (
        <nav className="safe-area-bottom bg-white border-t border-gray-100 z-50">
          <div className="flex justify-around items-center h-16 max-w-md mx-auto">
            {navItems.map(item => {
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as View)}
                  className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors active:scale-90 ${
                    isActive ? 'text-[#FF4458]' : 'text-gray-400'
                  }`}
                >
                  {item.icon(isActive)}
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-[#FF4458]' : 'text-gray-400'}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sign Out?</h3>
            <p className="text-sm text-gray-500 mb-6">You'll need to sign in again to access your account.</p>
            <div className="space-y-2.5">
              <button onClick={handleLogout} className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform">Sign Out</button>
              <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-3.5 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
