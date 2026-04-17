
import React, { useState, useEffect, useMemo } from 'react';
import { View, Profile, ProConfig, ProPlan, AppConfig } from './types';
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
import VerifyAuthorityPage from './components/VerifyAuthorityPage';

// ─── URL ↔ VIEW MAPPING ────────────────────────────────────
const VIEW_TO_PATH: Record<View, string> = {
  landing: '/', login: '/login', signup: '/signup', forgotPassword: '/forgot-password',
  discover: '/discover', friends: '/matches', profile: '/profile', chat: '/chat',
  inbox: '/inbox', userDetails: '/user', notifications: '/alerts',
  privateGallery: '/gallery', privateGalleryView: '/gallery/view',
  earnings: '/earnings', verification: '/verification', blockedUsers: '/blocked',
  adminDashboard: '/admin', bankAccount: '/bank-account', terms: '/terms', privacy: '/privacy',
  verifyAuthority: '/verify-authority',
};
const PATH_TO_VIEW: Record<string, View> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([v, p]) => [p, v as View])
) as Record<string, View>;
const LOGGED_IN_VIEWS = new Set<View>(['discover', 'friends', 'profile', 'chat', 'inbox', 'userDetails', 'notifications', 'privateGallery', 'privateGalleryView', 'earnings', 'verification', 'blockedUsers', 'adminDashboard', 'bankAccount', 'verifyAuthority']);

function getViewFromPath(): View {
  const path = window.location.pathname;
  return PATH_TO_VIEW[path] || 'landing';
}

const App: React.FC = () => {
  const [view, setViewRaw] = useState<View>('landing');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pageTransition, setPageTransition] = useState(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [proConfig, setProConfig] = useState<ProConfig>({ price: 99, duration: 30 });
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [activeRequests, setActiveRequests] = useState<string[]>([]);
  const [linkedProfiles, setLinkedProfiles] = useState<Profile[]>([]);
  const [dailyLikeCount, setDailyLikeCount] = useState(0);
  const [showLikeLimit, setShowLikeLimit] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [proPlans, setProPlans] = useState<ProPlan[]>([]);
  const [showProPlans, setShowProPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ProPlan | null>(null);
  const [purchasingPro, setPurchasingPro] = useState(false);
  const [showRewindPro, setShowRewindPro] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>({ dailyLikeLimit: 0, freeMessageLimit: 0 });
  const suppressPopState = React.useRef(false);

  // Wrapped setView that also updates the URL
  const setView = React.useCallback((newView: View) => {
    setViewRaw(newView);
    const path = VIEW_TO_PATH[newView] || '/';
    if (window.location.pathname !== path) {
      suppressPopState.current = true;
      window.history.pushState({ view: newView }, '', path);
      setTimeout(() => { suppressPopState.current = false; }, 50);
    }
  }, []);

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
            supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', session.user.id).then();
            const users = await fetchAllProfiles();
            setAllUsers(users);
            await refreshConnectionData(session.user.id);
            // Fetch daily like count for free users
            const { data: likeData } = await supabase.rpc('get_daily_like_count', { p_user_id: session.user.id });
            if (typeof likeData === 'number') setDailyLikeCount(likeData);
            // Fetch pro plans
            const { data: plans } = await supabase.from('pro_plans').select('*').eq('active', true).order('sort_order');
            if (plans) setProPlans(plans.map((p: any) => ({ id: p.id, name: p.name, label: p.label, price: p.price, durationDays: p.duration_days, description: p.description, badgeText: p.badge_text, isPopular: p.is_popular, sortOrder: p.sort_order })));
            // Fetch app config (limits from DB)
            const { data: configRows } = await supabase.from('app_config').select('key, value');
            if (configRows) {
              const cfgMap: Record<string, string> = {};
              configRows.forEach((r: any) => { cfgMap[r.key] = r.value; });
              setAppConfig({
                dailyLikeLimit: parseInt(cfgMap['daily_like_limit'] || '0', 10),
                freeMessageLimit: parseInt(cfgMap['free_message_limit'] || '0', 10),
              });
            }
            // Fetch unread message count
            const { count: msgCount } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', session.user.id).eq('status', 'sent').eq('deleted_for_receiver', false);
            if (typeof msgCount === 'number') setUnreadMessageCount(msgCount);
            // Fetch pending notification count
            const { count: notifCount } = await supabase.from('connection_requests').select('id', { count: 'exact', head: true }).eq('to_id', session.user.id).eq('status', 'pending');
            if (typeof notifCount === 'number') setUnreadNotificationCount(notifCount);
            // Restore view from URL if it's a logged-in view, else default
            const urlView = getViewFromPath();
            if (profile.role === 'admin') {
              // Admin: keep verifyAuthority or adminDashboard from URL
              if (urlView === 'adminDashboard') {
                setViewRaw('adminDashboard');
              } else {
                setView('verifyAuthority');
              }
            } else if (LOGGED_IN_VIEWS.has(urlView)) {
              // Views that require selectedProfile can't be restored on refresh
              const needsSelectedProfile = new Set<View>(['userDetails', 'chat', 'privateGalleryView']);
              if (needsSelectedProfile.has(urlView)) {
                setView('discover');
              } else {
                setViewRaw(urlView); // don't push state again
              }
            } else {
              setView('discover');
            }
          }
        } else {
          // No session — check if URL is a public view
          const urlView = getViewFromPath();
          if (['login', 'signup', 'forgotPassword', 'terms', 'privacy'].includes(urlView)) {
            setViewRaw(urlView);
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
      // Re-authenticate on token refresh (prevents accidental logout)
      if (event === 'TOKEN_REFRESHED' && session?.user && !currentUser) {
        const profile = await fetchUserProfile(session.user.id);
        if (profile) {
          setCurrentUser(profile);
          const users = await fetchAllProfiles();
          setAllUsers(users);
          await refreshConnectionData(session.user.id);
        }
      }
    });

    return () => {
      window.removeEventListener('resize', checkSize);
      subscription.unsubscribe();
    };
  }, []);

  // ─── BROWSER BACK/FORWARD NAVIGATION ──────────────────────
  useEffect(() => {
    const handlePopState = () => {
      if (suppressPopState.current) return;
      const urlView = getViewFromPath();
      // If user is logged in and tries to go to landing/login, show logout confirm
      if (currentUser && !LOGGED_IN_VIEWS.has(urlView) && !['terms', 'privacy'].includes(urlView)) {
        // Push back to current path to prevent leaving
        window.history.pushState({ view }, '', VIEW_TO_PATH[view] || '/');
        setShowLogoutConfirm(true);
        return;
      }
      // If not logged in and trying to access protected views, go to landing
      if (!currentUser && LOGGED_IN_VIEWS.has(urlView)) {
        window.history.replaceState({ view: 'landing' }, '', '/');
        setViewRaw('landing');
        return;
      }
      setViewRaw(urlView);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, view]);

  // ─── HEARTBEAT: update last_active every 5 minutes ─────────
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', currentUser.id).then();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // ─── REALTIME: unread message + notification badge counts ──
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;

    const msgChannel = supabase
      .channel('unread-msgs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${uid}` }, async () => {
        const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', uid).eq('status', 'sent').eq('deleted_for_receiver', false);
        if (typeof count === 'number') setUnreadMessageCount(count);
      })
      .subscribe();

    const notifChannel = supabase
      .channel('unread-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connection_requests', filter: `to_id=eq.${uid}` }, async () => {
        const { count } = await supabase.from('connection_requests').select('id', { count: 'exact', head: true }).eq('to_id', uid).eq('status', 'pending');
        if (typeof count === 'number') setUnreadNotificationCount(count);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [currentUser?.id]);

  const handlePurchasePro = async (plan?: ProPlan) => {
    if (!currentUser || !plan) return;
    setPurchasingPro(true);
    try {
      // Step 1: Create order on server
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, userId: currentUser.id }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { alert(orderData.error || 'Failed to create order'); return; }

      // Step 2: Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'MalluCupid',
        description: `Pro Plan – ${orderData.planName}`,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.userName || '',
          email: orderData.userEmail || '',
          contact: orderData.userPhone || '',
        },
        theme: { color: '#FF4458' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Step 3: Verify payment on server
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: currentUser.id,
                planId: plan.id,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) { alert(verifyData.error || 'Payment verification failed'); return; }
            // Step 4: Update local state
            const updated = { ...currentUser, proExpiry: verifyData.proExpiry };
            setCurrentUser(updated);
            setAllUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
            setShowProPlans(false);
            setSelectedPlan(null);
          } catch {
            alert('Payment verification failed. If amount was deducted, contact support.');
          }
        },
        modal: { ondismiss: () => setPurchasingPro(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', () => { alert('Payment failed. Please try again.'); setPurchasingPro(false); });
      rzp.open();
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setPurchasingPro(false);
    }
  };

  const handleUpdateProConfig = (newConfig: ProConfig) => setProConfig(newConfig);

  const handleLike = async (profile: Profile) => {
    if (!currentUser) return;
    if (!currentUser.verified) return;
    // Free user swipe limit check
    if (!isPro && appConfig.dailyLikeLimit > 0 && dailyLikeCount >= appConfig.dailyLikeLimit) {
      setShowLikeLimit(true);
      return;
    }
    try {
      const { error } = await supabase.from('connection_requests').insert({
        from_id: currentUser.id,
        to_id: profile.id,
        status: 'pending',
      });
      if (error) { console.error(error); return; }
      // Increment daily like count for free users
      if (!isPro) {
        const { data: likeData } = await supabase.rpc('increment_daily_like', { p_user_id: currentUser.id });
        if (likeData?.count) setDailyLikeCount(likeData.count);
      }
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

      // Role-based login routing — pure backend check
      const role = profile.role || 'user';
      if (role !== 'admin' && role !== 'user') {
        await signOut();
        return { success: false, error: 'Email is not matching to any roles, contact admin' };
      }

      setCurrentUser(profile);
      // Update last_active on login
      supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', authData.user.id).then();

      if (role === 'admin') {
        // Admin goes to security verification first
        setView('verifyAuthority');
        return { success: true };
      }

      // Normal user flow
      const users = await fetchAllProfiles();
      setAllUsers(users);
      await refreshConnectionData(authData.user.id);
      setView('discover');
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
    window.history.replaceState(null, '', '/');
    setViewRaw('landing');
  };
  const navigateToView = (newView: View) => { setPageTransition(true); setTimeout(() => { setView(newView); setPageTransition(false); }, 300); };

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
      case 'verifyAuthority': return currentUser && (
        <VerifyAuthorityPage
          currentUser={currentUser}
          onVerified={async () => {
            const users = await fetchAllProfiles();
            setAllUsers(users);
            setView('adminDashboard');
          }}
          onBack={handleLogout}
        />
      );
      case 'adminDashboard': return (
        <AdminDashboard 
          onBack={() => setShowLogoutConfirm(true)} 
          onLogout={handleLogout}
          proConfig={proConfig}
          onUpdateProConfig={handleUpdateProConfig}
        />
      );
      case 'discover': return currentUser && <Discover users={allUsers} onLike={handleLike} onDislike={() => {}} onShowDetails={(p) => { setSelectedProfile(p); setView('userDetails'); }} blockedIds={blockedIds} currentUser={currentUser} activeRequests={activeRequests} isPro={isPro} dailyLikeCount={dailyLikeCount} dailyLikeLimit={appConfig.dailyLikeLimit} onRewindPro={() => setShowRewindPro(true)} />;
      case 'userDetails': return selectedProfile && currentUser && (
        <UserDetails profile={allUsers.find(u => u.id === selectedProfile.id) || selectedProfile} currentUser={currentUser} currentUserId={currentUser.id} onBack={() => setView('discover')}
          onOpenPrivateGallery={() => setView('privateGalleryView')}
          onChat={() => setView('chat')}
          isPro={isPro} onGetPro={() => setShowProPlans(true)} onConnectionChange={() => refreshConnectionData()} />
      );
      case 'chat': return selectedProfile && currentUser && <ChatPage targetProfile={selectedProfile} onBack={() => setView('userDetails')} currentUserId={currentUser.id} isPro={isPro} onGetPro={() => setShowProPlans(true)} proPrice={proConfig.price} freeMessageLimit={appConfig.freeMessageLimit} />;
      case 'inbox': return currentUser && <InboxPage currentUser={currentUser} friends={linkedProfiles} onSelectChat={(p) => { setSelectedProfile(p); setView('chat'); }} onDeleteChat={() => refreshConnectionData()} isPro={isPro} onGetPro={() => setShowProPlans(true)} />;
      case 'friends': return currentUser && <FriendsPage currentUserId={currentUser.id} allUsers={allUsers} onShowDetails={(p) => { setSelectedProfile(p); setView('userDetails'); }} onConnectionChange={() => refreshConnectionData()} />;
      case 'notifications': return currentUser && <AlertsPage currentUserId={currentUser.id} isVerified={currentUser.verified} allUsers={allUsers} onConnectionAccepted={() => refreshConnectionData()} />;
      case 'profile': return currentUser && <EditProfile userProfile={currentUser} onUpdate={handleProfileUpdate} onNavigate={navigateToView} onLogout={handleLogout} isPro={isPro} proPlans={proPlans} onShowProPlans={() => setShowProPlans(true)} />;
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
          <button onClick={() => setView('inbox')} className={`w-9 h-9 flex items-center justify-center transition-transform active:scale-90 relative ${view === 'inbox' ? 'text-[#FF4458]' : 'text-gray-400'}`}>
            {unreadMessageCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#FF4458] text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 z-10">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={view === 'inbox' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={view === 'inbox' ? 0 : 2}>
              {view === 'inbox'
                ? <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h2.387c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              }
            </svg>
          </button>
        </header>
      )}

      <main className="flex-1 relative overflow-hidden bg-[#fffafa]">
        {/* Page transition overlay */}
        {pageTransition && (
          <div className="absolute inset-0 z-[90] bg-[#fffafa] flex items-center justify-center">
            <div className="w-10 h-10 border-3 border-[#FF4458] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      {showNav && (
        <nav className="safe-area-bottom bg-white border-t border-gray-100 z-50">
          <div className="flex justify-around items-center h-16 max-w-md mx-auto">
            {navItems.map(item => {
              const isActive = view === item.id;
              const badgeCount = item.id === 'notifications' ? unreadNotificationCount : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as View)}
                  className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors active:scale-90 relative ${
                    isActive ? 'text-[#FF4458]' : 'text-gray-400'
                  }`}
                >
                  <div className="relative">
                    {item.icon(isActive)}
                    {badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 bg-[#FF4458] text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-[#FF4458]' : 'text-gray-400'}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Daily Like Limit Paywall Modal */}
      {showLikeLimit && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLikeLimit(false)} />
          <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Daily limit reached</h3>
            <p className="text-sm text-gray-500 mb-1">You've used all {appConfig.dailyLikeLimit} likes for today.</p>
            <p className="text-sm text-gray-500 mb-6">Upgrade to Pro for unlimited likes every day.</p>
            <div className="space-y-2.5">
              <button onClick={() => { setShowLikeLimit(false); setShowProPlans(true); }} className="w-full py-3.5 bg-gradient-to-r from-[#FF4458] to-[#FF6B6B] text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-lg">
                Get Pro · Unlimited likes
              </button>
              <button onClick={() => setShowLikeLimit(false)} className="w-full py-3.5 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Wait until tomorrow</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PRO PLANS MODAL (Tinder-style) ─── */}
      {showProPlans && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setShowProPlans(false); setSelectedPlan(null); }} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl shadow-2xl pb-8 animate-[slideUp_0.25s_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />
            <button onClick={() => { setShowProPlans(false); setSelectedPlan(null); }} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 z-10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            {/* Header */}
            <div className="text-center px-6 pt-3 pb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200/50">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">MalluCupid Pro</h2>
              <p className="text-sm text-gray-500 font-medium">Unlock the full dating experience</p>
            </div>

            {/* Features */}
            <div className="px-6 mb-6">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 space-y-3">
                {[
                  { icon: '💛', text: 'Unlimited likes every day' },
                  { icon: '💬', text: 'Unlimited messaging' },
                  { icon: '🔄', text: 'Rewind your last swipe' },
                  { icon: '🌍', text: 'Global discovery mode' },
                  { icon: '⭐', text: 'Pro badge on your profile' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg">{f.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Cards */}
            <div className="px-6 mb-6">
              <div className="flex gap-3">
                {proPlans.map(plan => {
                  const isSelected = selectedPlan?.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`flex-1 relative rounded-2xl p-4 border-2 transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-100/50 scale-[1.02]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {plan.badgeText && (
                        <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          plan.isPopular ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-gray-800 text-white'
                        }`}>
                          {plan.badgeText}
                        </span>
                      )}
                      <p className="text-[13px] font-bold text-gray-800 mt-1">{plan.label}</p>
                      <p className="text-2xl font-black text-gray-900 mt-1">₹{plan.price}</p>
                      <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                        {plan.durationDays === 7 ? '₹' + (plan.price / 7).toFixed(0) + '/day' :
                         plan.durationDays === 30 ? '₹' + (plan.price / 30).toFixed(0) + '/day' :
                         '₹' + (plan.price / 90).toFixed(0) + '/day'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA Button */}
            <div className="px-6">
              <button
                onClick={() => selectedPlan && handlePurchasePro(selectedPlan)}
                disabled={!selectedPlan || purchasingPro}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black uppercase tracking-wider text-sm shadow-xl shadow-amber-200/50 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {purchasingPro && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {purchasingPro ? 'Activating...' : selectedPlan ? `Get Pro · ₹${selectedPlan.price}` : 'Select a plan'}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-3">Cancel anytime. No auto-renewal.</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── REWIND PRO POPUP ─── */}
      {showRewindPro && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRewindPro(false)} />
          <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Want to rewind?</h3>
            <p className="text-sm text-gray-500 mb-6">Accidentally swiped left? Upgrade to Pro to undo your last swipe and get another chance.</p>
            <div className="space-y-2.5">
              <button onClick={() => { setShowRewindPro(false); setShowProPlans(true); }} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-lg">
                Upgrade to Pro
              </button>
              <button onClick={() => setShowRewindPro(false)} className="w-full py-3.5 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Maybe later</button>
            </div>
          </div>
        </div>
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
