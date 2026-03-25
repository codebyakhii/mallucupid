
import React, { useState, useEffect, useMemo } from 'react';
import { View, Profile, ConnectionRequest, PurchaseRecord, SubscriptionRecord, Notification, Message, Earning, WithdrawalRequest, UserReport, ProConfig } from './types';
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
import ProfilePage from './components/ProfilePage';
import SecretGallery from './components/SecretGallery';
import SecretGalleryView from './components/SecretGalleryView';
import ExclusiveRoomPage from './components/ExclusiveRoom';
import ExclusiveRoomView from './components/ExclusiveRoomView';
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
  const [connections, setConnections] = useState<ConnectionRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);

  const isPro = useMemo(() => {
    if (!currentUser?.proExpiry) return false;
    return currentUser.proExpiry > Date.now();
  }, [currentUser]);

  const handleProfileUpdate = (profile: Profile) => {
    setCurrentUser(profile);
    setAllUsers(prev => prev.map(u => u.id === profile.id ? profile : u));
    alert('Profile saved');
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

  const handlePurchasePro = () => {
    if (!currentUser) return;
    const expiry = Date.now() + (proConfig.duration * 24 * 60 * 60 * 1000);
    const updated = { ...currentUser, proExpiry: expiry };
    setCurrentUser(updated);
    setAllUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    alert("Congratulations! You are now a Pro Member.");
  };

  const handleUpdateProConfig = (newConfig: ProConfig) => setProConfig(newConfig);
  const handleManualProToggle = (id: string, activate: boolean) => {
    const expiry = activate ? Date.now() + (proConfig.duration * 24 * 60 * 60 * 1000) : 0;
    setAllUsers(prev => prev.map(u => u.id === id ? { ...u, proExpiry: expiry } : u));
  };
  const handleVerifyUser = (id: string, verified: boolean) => setAllUsers(prev => prev.map(u => u.id === id ? { ...u, verified } : u));
  const handleBlockUser = (id: string, block: boolean) => setAllUsers(prev => prev.map(u => u.id === id ? { ...u, status: block ? 'blocked' : 'active' } : u));
  const handleAdminApproveWithdrawal = (id: string) => setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'approved' } : w));
  const handleAdminHoldWithdrawal = (id: string) => setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'held' } : w));
  const handleAdminRejectWithdrawal = (id: string) => setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected' } : w));
  const handleDeleteUser = (id: string) => setAllUsers(prev => prev.filter(u => u.id !== id));

  const handleRequestWithdrawal = (amount: number) => {
    if (!currentUser) return;
    setWithdrawals(prev => [...prev, { id: `wd-${Date.now()}`, userId: currentUser.id, username: currentUser.username, amount, status: 'pending', timestamp: Date.now() }]);
  };

  const linkedProfiles = useMemo(() => {
    if (!currentUser) return [];
    const friendIds = connections.filter(c => c.status === 'accepted').map(c => c.fromId === currentUser.id ? c.toId : c.fromId);
    return allUsers.filter(p => friendIds.includes(p.id) && !blockedIds.includes(p.id) && p.status !== 'blocked');
  }, [connections, currentUser, blockedIds, allUsers]);

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
      case 'signup': return <SignupPage onBack={() => setView('login')} onSuccess={() => setView('login')} />;
      case 'forgotPassword': return <ForgotPasswordFlow onBack={() => setView('login')} onSuccess={() => setView('login')} />;
      case 'adminDashboard': return (
        <AdminDashboard users={allUsers} withdrawalRequests={withdrawals} reports={reports} proConfig={proConfig}
          onUpdateProConfig={handleUpdateProConfig} onManualProToggle={handleManualProToggle}
          onApproveWithdrawal={handleAdminApproveWithdrawal} onHoldWithdrawal={handleAdminHoldWithdrawal}
          onRejectWithdrawal={handleAdminRejectWithdrawal} onVerifyUser={(id) => handleVerifyUser(id, true)}
          onUnverifyUser={(id) => handleVerifyUser(id, false)} onBlockUser={(id) => handleBlockUser(id, true)}
          onDeleteUser={handleDeleteUser} onBack={() => setView('landing')} onLogout={handleLogout} />
      );
      case 'discover': return currentUser && <Discover users={allUsers} onLike={(p) => setConnections(prev => [...prev, { id: `req-${Date.now()}`, fromId: currentUser.id, toId: p.id, status: 'pending', timestamp: Date.now() }])} onDislike={() => {}} onShowDetails={(p) => { setSelectedProfile(p); setView('userDetails'); }} blockedIds={blockedIds} currentUser={currentUser} activeRequests={connections.filter(c => c.fromId === currentUser.id && c.status === 'pending').map(c => c.toId)} />;
      case 'userDetails': return selectedProfile && currentUser && (
        <UserDetails profile={allUsers.find(u => u.id === selectedProfile.id) || selectedProfile} onBack={() => setView('discover')}
          onUnfriend={(pid) => setConnections(prev => prev.filter(c => !((c.fromId === currentUser.id && c.toId === pid) || (c.fromId === pid && c.toId === currentUser.id))))}
          onBlock={(pid) => setBlockedIds(prev => [...prev, pid])}
          onReport={(id, reason) => setReports(prev => [...prev, { id: `rep-${Date.now()}`, reporterId: currentUser.id, targetId: id, reason, timestamp: Date.now() }])}
          onOpenSecretGallery={() => setView('secretGalleryView')} onOpenExclusiveRoom={() => setView('exclusiveRoomView')}
          onChat={() => setView('chat')}
          onConnect={(pid) => setConnections(prev => [...prev, { id: `req-${Date.now()}`, fromId: currentUser.id, toId: pid, status: 'pending', timestamp: Date.now() }])}
          isLinked={linkedProfiles.some(p => p.id === selectedProfile.id)}
          isPending={connections.some(c => c.fromId === currentUser.id && c.toId === selectedProfile.id && c.status === 'pending')}
          isPro={isPro} onGetPro={handlePurchasePro} />
      );
      case 'chat': return selectedProfile && currentUser && <ChatPage targetProfile={selectedProfile} onBack={() => setView('userDetails')} messages={messages.filter(m => (m.senderId === currentUser.id && m.receiverId === selectedProfile.id) || (m.senderId === selectedProfile.id && m.receiverId === currentUser.id))} onSendMessage={(msg) => setMessages(prev => [...prev, { ...msg, id: `msg-${Date.now()}`, timestamp: Date.now() }])} currentUserId={currentUser.id} />;
      case 'inbox': return currentUser && <InboxPage currentUser={currentUser} friends={linkedProfiles} messages={messages} onSelectChat={(p) => { setSelectedProfile(p); setView('chat'); }} onDeleteChat={() => {}} isPro={isPro} onGetPro={handlePurchasePro} />;
      case 'profile': return currentUser && <ProfilePage userProfile={currentUser} onUpdate={handleProfileUpdate} onNavigate={navigateToView} isPro={isPro} onGetPro={handlePurchasePro} />;
      case 'earnings': return currentUser && <EarningsPage onBack={() => setView('profile')} earnings={earnings} onRequestWithdrawal={handleRequestWithdrawal} pendingWithdrawals={withdrawals} userProfile={currentUser} />;
      case 'bankAccount': return <BankAccountPage onBack={() => setView('profile')} />;
      case 'blockedUsers': return <BlockedUsersPage blockedIds={blockedIds} onUnblock={(id) => setBlockedIds(prev => prev.filter(bid => bid !== id))} onBack={() => setView('profile')} allUsers={allUsers} />;
      case 'secretGallery': return currentUser && <SecretGallery isOwner={true} onBack={() => setView('profile')} targetProfile={currentUser} />;
      case 'exclusiveRoom': return currentUser && <ExclusiveRoomPage onBack={() => setView('profile')} />;
      case 'secretGalleryView': return selectedProfile && <SecretGalleryView targetProfile={selectedProfile} onBack={() => setView('userDetails')} purchases={purchases} onPurchase={(id) => setPurchases(prev => [...prev, { contentId: id, userId: currentUser?.id || '' }])} />;
      case 'exclusiveRoomView': return selectedProfile && <ExclusiveRoomView targetProfile={selectedProfile} onBack={() => setView('userDetails')} subscriptions={subscriptions} onSubscribe={(id) => setSubscriptions(prev => [...prev, { roomId: id, userId: currentUser?.id || '', expiry: Date.now() + 86400000 * 30 }])} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#fffafa] flex flex-col overflow-hidden">
      {['discover', 'friends', 'notifications', 'profile', 'inbox'].includes(view) && (
        <header className="flex items-center justify-between px-6 h-20 bg-[#006400] z-50 shadow-lg">
          <button onClick={() => setShowLogoutConfirm(true)} className="text-white active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('discover')}><div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[#006400] font-black">M</div><span className="text-xl font-black text-white">Mallu Cupid</span></div>
          <button onClick={() => setView('inbox')} className="text-white relative active:scale-90">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            {!isPro && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-[#006400]" />}
          </button>
        </header>
      )}
      <main className="flex-1 relative overflow-hidden bg-[#fffafa]">{renderContent()}</main>
      {['discover', 'friends', 'notifications', 'profile', 'inbox'].includes(view) && (
        <nav className="safe-area-bottom bg-[#006400] flex justify-around py-4 z-50 rounded-t-[2.8rem] shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
          {[{ id: 'discover', label: 'Explore' }, { id: 'friends', label: 'Friends' }, { id: 'notifications', label: 'Alerts' }, { id: 'profile', label: 'Profile' }].map(btn => (
            <button key={btn.id} onClick={() => setView(btn.id as View)} className="flex flex-col items-center gap-1.5 text-white active:scale-90 transition-transform">
              <span className="text-[10px] font-black uppercase tracking-widest">{btn.label}</span>
            </button>
          ))}
        </nav>
      )}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-10 w-full max-sm shadow-2xl text-center">
            <h3 className="text-xl font-black uppercase mb-4">Sign Out?</h3>
            <div className="space-y-3">
              <button onClick={handleLogout} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-xs">Sign Out</button>
              <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase text-xs">Stay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
