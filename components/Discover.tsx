import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';

interface DiscoverProps {
  users: Profile[];
  onLike: (profile: Profile) => void;
  onDislike: () => void;
  onShowDetails: (profile: Profile) => void;
  blockedIds: string[];
  currentUser: Profile;
  activeRequests: string[];
}

// ─── Haversine distance (km) ────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Orientation-based matching ─────────────────────────────
// Returns true if currentUser and target are compatible based on sexual orientation
function isOrientationCompatible(me: Profile, them: Profile): boolean {
  const myO = me.orientation;
  const theirO = them.orientation;

  // Gay: only match with same-gender people who are also Gay/Bisexual/Queer/Pansexual
  if (myO === 'Gay') {
    if (me.gender !== them.gender) return false;
    return ['Gay', 'Bisexual', 'Queer', 'Pansexual'].includes(theirO);
  }
  // Lesbian: only match with Women/Transwomen who are also Lesbian/Bisexual/Queer/Pansexual
  if (myO === 'Lesbian') {
    const femGenders = ['Women', 'Transwoman'];
    if (!femGenders.includes(me.gender) || !femGenders.includes(them.gender)) return false;
    return ['Lesbian', 'Bisexual', 'Queer', 'Pansexual'].includes(theirO);
  }
  // Straight: only match with different-gender people who are Straight/Bisexual/Queer/Pansexual
  if (myO === 'Straight') {
    if (me.gender === them.gender) return false;
    return ['Straight', 'Bisexual', 'Queer', 'Pansexual'].includes(theirO);
  }
  // Bisexual / Queer / Pansexual: open to anyone whose orientation is reciprocally compatible
  if (['Bisexual', 'Queer', 'Pansexual'].includes(myO)) {
    // They must also be open to our gender
    if (theirO === 'Gay') return me.gender === them.gender;
    if (theirO === 'Lesbian') {
      const femGenders = ['Women', 'Transwoman'];
      return femGenders.includes(me.gender) && femGenders.includes(them.gender);
    }
    if (theirO === 'Straight') return me.gender !== them.gender;
    return true; // Both are Bisexual/Queer/Pansexual
  }
  return true;
}

// ─── Activity recency score ─────────────────────────────────
function activityScore(profile: Profile): number {
  if (!profile.lastActive) return 0;
  const ms = Date.now() - new Date(profile.lastActive).getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return 100;
  if (hours < 6) return 80;
  if (hours < 24) return 60;
  if (hours < 72) return 40;
  if (hours < 168) return 20; // 7 days
  return 5;
}

const Discover: React.FC<DiscoverProps> = ({ users, onLike, onDislike, onShowDetails, blockedIds, currentUser, activeRequests }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyOut, setFlyOut] = useState<'left' | 'right' | null>(null);
  const [imageIdx, setImageIdx] = useState(0);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [swipeLoading, setSwipeLoading] = useState(true);
  const [verifyToast, setVerifyToast] = useState(false);
  const startRef = useRef({ x: 0, y: 0, time: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Load swipe history on mount
  useEffect(() => {
    const loadSwipeHistory = async () => {
      const { data } = await supabase.from('swipe_history').select('target_id').eq('user_id', currentUser.id);
      if (data) setSwipedIds(new Set(data.map(s => s.target_id)));
      setSwipeLoading(false);
    };
    loadSwipeHistory();
  }, [currentUser.id]);

  const recordSwipe = async (targetId: string, action: 'like' | 'dislike') => {
    setSwipedIds(prev => new Set(prev).add(targetId));
    await supabase.from('swipe_history').upsert({ user_id: currentUser.id, target_id: targetId, action }, { onConflict: 'user_id,target_id' });
  };

  // ─── THE MATCHING ALGORITHM ────────────────────────────────
  const filteredProfiles = useMemo(() => {
    const myLat = currentUser.latitude;
    const myLon = currentUser.longitude;
    const hasMyLocation = myLat != null && myLon != null;

    const scored = users
      .filter(p => {
        // 1. Exclude self, blocked, already swiped
        if (p.id === currentUser.id) return false;
        if (blockedIds.includes(p.id)) return false;
        if (p.status === 'blocked') return false;
        if (swipedIds.has(p.id)) return false;

        // 2. Show Me filtering (bidirectional gender preference)
        const myShowMe = currentUser.showMe || 'Everyone';
        const theirShowMe = p.showMe || 'Everyone';
        if (myShowMe !== 'Everyone') {
          // "Men" should match gender "Men", "Women" should match gender "Women"
          if (myShowMe === 'Men' && p.gender !== 'Men') return false;
          if (myShowMe === 'Women' && p.gender !== 'Women') return false;
        }
        if (theirShowMe !== 'Everyone') {
          if (theirShowMe === 'Men' && currentUser.gender !== 'Men') return false;
          if (theirShowMe === 'Women' && currentUser.gender !== 'Women') return false;
        }

        // 3. Sexual Orientation filtering (bidirectional)
        if (!isOrientationCompatible(currentUser, p)) return false;
        if (!isOrientationCompatible(p, currentUser)) return false;

        // 4. Age filtering — respect BOTH users' age range preferences
        if (p.age < currentUser.ageMin || p.age > currentUser.ageMax) return false;
        if (currentUser.age < p.ageMin || currentUser.age > p.ageMax) return false;

        // 5. Distance filtering — only if both users have location data
        if (hasMyLocation && p.latitude != null && p.longitude != null) {
          const dist = haversineKm(myLat, myLon, p.latitude, p.longitude);
          if (dist > currentUser.maxDistance) return false;
        }

        return true;
      })
      .map(p => {
        // Compute distance for display + sorting
        let distance: number | null = null;
        if (hasMyLocation && p.latitude != null && p.longitude != null) {
          distance = Math.round(haversineKm(myLat, myLon, p.latitude, p.longitude));
        }
        // Activity recency score for sorting
        const recency = activityScore(p);
        return { profile: p, distance, recency };
      });

    // 6. Sort by activity recency (most active first), then distance (closest first)
    scored.sort((a, b) => {
      // Primary: activity recency (higher = more recent = first)
      if (b.recency !== a.recency) return b.recency - a.recency;
      // Secondary: distance (closer first), put null-distance at the end
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      if (a.distance != null) return -1;
      if (b.distance != null) return 1;
      return 0;
    });

    return scored;
  }, [users, blockedIds, currentUser, activeRequests, swipedIds]);

  const currentItem = filteredProfiles[currentIndex];
  const nextItem = filteredProfiles[currentIndex + 1];
  const currentProfile = currentItem?.profile;
  const nextProfile = nextItem?.profile;
  const currentDistance = currentItem?.distance;
  const isRequested = currentProfile ? activeRequests.includes(currentProfile.id) : false;
  const toTitleCase = (str: string) => str.toLowerCase().replace(/(^|\s)\S/g, L => L.toUpperCase());

  const allImages = currentProfile ? [currentProfile.imageUrl, ...(currentProfile.images || [])].filter(Boolean) : [];

  const goNext = useCallback((direction: 'left' | 'right') => {
    if (direction === 'right') {
      // ONLY VERIFIED USERS CAN SWIPE RIGHT (send match request)
      if (!currentUser.verified) {
        setVerifyToast(true);
        setTimeout(() => setVerifyToast(false), 3000);
        return;
      }
    }

    setFlyOut(direction);
    setTimeout(() => {
      if (currentProfile) {
        if (direction === 'right' && !isRequested) {
          recordSwipe(currentProfile.id, 'like');
          onLike(currentProfile);
        } else if (direction === 'left') {
          recordSwipe(currentProfile.id, 'dislike');
          onDislike();
        }
      }
      setCurrentIndex(prev => Math.min(prev + 1, filteredProfiles.length));
      setFlyOut(null);
      setDragX(0);
      setDragY(0);
      setImageIdx(0);
    }, 300);
  }, [currentProfile, isRequested, onLike, onDislike, filteredProfiles.length, currentUser.verified]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const t = e.touches[0];
    setDragX(t.clientX - startRef.current.x);
    setDragY((t.clientY - startRef.current.y) * 0.3);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    const threshold = 80;
    if (dragX > threshold) {
      goNext('right');
    } else if (dragX < -threshold) {
      goNext('left');
    } else {
      setDragX(0);
      setDragY(0);
    }
  };

  const handleCardTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (Math.abs(dragX) > 5) return;
    if (!cardRef.current || allImages.length <= 1) return;
    const rect = cardRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const tapX = clientX - rect.left;
    if (tapX < rect.width * 0.35) {
      setImageIdx(prev => Math.max(0, prev - 1));
    } else if (tapX > rect.width * 0.65) {
      setImageIdx(prev => Math.min(allImages.length - 1, prev + 1));
    }
  };

  const rotation = dragX * 0.08;
  const likeOpacity = Math.min(1, Math.max(0, dragX / 100));
  const nopeOpacity = Math.min(1, Math.max(0, -dragX / 100));

  const getCardStyle = (): React.CSSProperties => {
    if (flyOut === 'right') return { transform: 'translateX(120vw) rotate(30deg)', transition: 'transform 0.3s ease-out', opacity: 0 };
    if (flyOut === 'left') return { transform: 'translateX(-120vw) rotate(-30deg)', transition: 'transform 0.3s ease-out', opacity: 0 };
    if (isDragging) return { transform: `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`, transition: 'none' };
    return { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' };
  };

  // ─── Loading state ────────────────────────────────────────
  if (swipeLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#fffafa]">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#006400] rounded-full animate-spin"></div>
        <p className="mt-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Loading profiles...</p>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────
  if (!currentProfile) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center bg-[#fffafa]">
        <div className="w-28 h-28 bg-gradient-to-br from-rose-100 to-pink-50 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <span className="text-5xl">💝</span>
        </div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">No More Profiles</h2>
        <p className="text-sm text-gray-400 mt-2 font-medium">Check back later for new people</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#fffafa] relative overflow-hidden">
      {/* Verify toast */}
      {verifyToast && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[999] animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-red-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-medium">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            Verify your profile to send likes
          </div>
        </div>
      )}

      {/* Card Stack Area */}
      <div className="flex-1 relative px-3 pt-2 pb-1">
        {/* Background card (next card preview) */}
        {nextProfile && !flyOut && (
          <div className="absolute inset-0 mx-3 mt-2 mb-1">
            <div className="w-full h-full rounded-[1.8rem] overflow-hidden bg-gray-200" style={{ transform: `scale(${0.95 + Math.min(Math.abs(dragX) / 800, 0.05)})`, transition: isDragging ? 'none' : 'transform 0.4s ease' }}>
              <img src={nextProfile.imageUrl} className="w-full h-full object-cover" alt="" draggable={false} />
              <div className="absolute inset-0 bg-black/10" />
            </div>
          </div>
        )}

        {/* Main swipe card */}
        <div
          ref={cardRef}
          className="relative w-full h-full rounded-[1.8rem] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.15)] select-none"
          style={getCardStyle()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={handleCardTap}
        >
          <img
            src={allImages[imageIdx] || currentProfile.imageUrl}
            className="w-full h-full object-cover pointer-events-none"
            alt={currentProfile.name}
            draggable={false}
          />

          {/* Image pagination dots */}
          {allImages.length > 1 && (
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4 z-20">
              {allImages.map((_, i) => (
                <div key={i} className="flex-1 h-[3px] rounded-full" style={{ background: i === imageIdx ? '#fff' : 'rgba(255,255,255,0.35)', maxWidth: '60px' }} />
              ))}
            </div>
          )}

          {/* LIKE stamp */}
          <div className="absolute top-16 left-6 z-30 pointer-events-none" style={{ opacity: likeOpacity, transform: `rotate(-20deg) scale(${0.8 + likeOpacity * 0.4})` }}>
            <div className="border-[4px] border-green-400 rounded-xl px-5 py-2">
              <span className="text-green-400 font-black text-3xl tracking-wider">LIKE</span>
            </div>
          </div>

          {/* NOPE stamp */}
          <div className="absolute top-16 right-6 z-30 pointer-events-none" style={{ opacity: nopeOpacity, transform: `rotate(20deg) scale(${0.8 + nopeOpacity * 0.4})` }}>
            <div className="border-[4px] border-red-400 rounded-xl px-5 py-2">
              <span className="text-red-400 font-black text-3xl tracking-wider">NOPE</span>
            </div>
          </div>

          {/* Gradient overlay + profile info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 z-10">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-black text-white truncate">{toTitleCase(currentProfile.name)}, {currentProfile.age}</h2>
                  {currentProfile.verified && (
                    <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  )}
                </div>
                <p className="text-sm text-white/70 font-medium truncate">{toTitleCase(currentProfile.occupation)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-white/50 font-medium truncate">📍 {toTitleCase(currentProfile.location)}</p>
                  {currentDistance != null && (
                    <span className="text-xs text-white/40 font-medium">• {currentDistance < 1 ? '<1' : currentDistance} km</span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onShowDetails(currentProfile); }}
                className="ml-3 w-11 h-11 bg-white/15 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition-transform flex-shrink-0"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-5 py-4 px-6">
        {/* Reject button */}
        <button
          onClick={() => goNext('left')}
          className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg shadow-red-100/50 border border-gray-100 active:scale-90 transition-all"
        >
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Info / Star button */}
        <button
          onClick={() => { onShowDetails(currentProfile); }}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg shadow-blue-100/50 border border-gray-100 active:scale-90 transition-all"
        >
          <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>

        {/* Like / Connect button — shows lock if not verified */}
        <button
          onClick={() => { if (!isRequested) goNext('right'); }}
          disabled={isRequested}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg border border-gray-100 active:scale-90 transition-all ${
            isRequested ? 'bg-gray-100 shadow-none' : !currentUser.verified ? 'bg-white shadow-orange-100/50' : 'bg-white shadow-green-100/50'
          }`}
        >
          {!currentUser.verified ? (
            <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          ) : (
            <svg className={`w-8 h-8 ${isRequested ? 'text-gray-300' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default Discover;
