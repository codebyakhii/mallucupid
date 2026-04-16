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
  isPro?: boolean;
  dailyLikeCount?: number;
  dailyLikeLimit?: number;
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
function isOrientationCompatible(me: Profile, them: Profile): boolean {
  const myO = me.orientation;
  const theirO = them.orientation;
  if (myO === 'Gay') {
    if (me.gender !== them.gender) return false;
    return ['Gay', 'Bisexual', 'Queer', 'Pansexual'].includes(theirO);
  }
  if (myO === 'Lesbian') {
    const femGenders = ['Women', 'Transwoman'];
    if (!femGenders.includes(me.gender) || !femGenders.includes(them.gender)) return false;
    return ['Lesbian', 'Bisexual', 'Queer', 'Pansexual'].includes(theirO);
  }
  if (myO === 'Straight') {
    if (me.gender === them.gender) return false;
    return ['Straight', 'Bisexual', 'Queer', 'Pansexual'].includes(theirO);
  }
  if (['Bisexual', 'Queer', 'Pansexual'].includes(myO)) {
    if (theirO === 'Gay') return me.gender === them.gender;
    if (theirO === 'Lesbian') {
      const femGenders = ['Women', 'Transwoman'];
      return femGenders.includes(me.gender) && femGenders.includes(them.gender);
    }
    if (theirO === 'Straight') return me.gender !== them.gender;
    return true;
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
  if (hours < 168) return 20;
  return 5;
}

function isRecentlyActive(profile: Profile): boolean {
  if (!profile.lastActive) return false;
  const ms = Date.now() - new Date(profile.lastActive).getTime();
  return ms < 15 * 60 * 1000; // active within 15 min
}

const Discover: React.FC<DiscoverProps> = ({ users, onLike, onDislike, onShowDetails, blockedIds, currentUser, activeRequests, isPro, dailyLikeCount = 0, dailyLikeLimit = 100 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyOut, setFlyOut] = useState<'left' | 'right' | null>(null);
  const [imageIdx, setImageIdx] = useState(0);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [swipeLoading, setSwipeLoading] = useState(true);
  const [dailyLikes, setDailyLikes] = useState(0);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [lastSwipe, setLastSwipe] = useState<{ profile: Profile; action: 'like' | 'dislike'; index: number } | null>(null);
  const startRef = useRef({ x: 0, y: 0, time: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Load swipe history + daily like count on mount
  useEffect(() => {
    const loadSwipeData = async () => {
      const { data } = await supabase.from('swipe_history').select('target_id').eq('user_id', currentUser.id);
      if (data) setSwipedIds(new Set(data.map(s => s.target_id)));

      // Count today's likes
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('swipe_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('action', 'like')
        .gte('created_at', today.toISOString());
      setDailyLikes(count || 0);
      setSwipeLoading(false);
    };
    loadSwipeData();
  }, [currentUser.id]);

  const recordSwipe = async (targetId: string, action: 'like' | 'dislike') => {
    setSwipedIds(prev => new Set(prev).add(targetId));
    if (action === 'like') setDailyLikes(prev => prev + 1);
    await supabase.from('swipe_history').upsert({ user_id: currentUser.id, target_id: targetId, action }, { onConflict: 'user_id,target_id' });
  };

  // ─── THE MATCHING ALGORITHM ────────────────────────────────
  const filteredProfiles = useMemo(() => {
    const myLat = currentUser.latitude;
    const myLon = currentUser.longitude;
    const hasMyLocation = myLat != null && myLon != null;

    const scored = users
      .filter(p => {
        if (p.id === currentUser.id) return false;
        if (blockedIds.includes(p.id)) return false;
        if (p.status === 'blocked') return false;
        if (swipedIds.has(p.id)) return false;

        const myShowMe = currentUser.showMe || 'Everyone';
        const theirShowMe = p.showMe || 'Everyone';
        if (myShowMe !== 'Everyone') {
          if (myShowMe === 'Men' && p.gender !== 'Men') return false;
          if (myShowMe === 'Women' && p.gender !== 'Women') return false;
        }
        if (theirShowMe !== 'Everyone') {
          if (theirShowMe === 'Men' && currentUser.gender !== 'Men') return false;
          if (theirShowMe === 'Women' && currentUser.gender !== 'Women') return false;
        }

        if (!isOrientationCompatible(currentUser, p)) return false;
        if (!isOrientationCompatible(p, currentUser)) return false;

        if (p.age < currentUser.ageMin || p.age > currentUser.ageMax) return false;
        if (currentUser.age < p.ageMin || currentUser.age > p.ageMax) return false;

        if (hasMyLocation && p.latitude != null && p.longitude != null) {
          const dist = haversineKm(myLat, myLon, p.latitude, p.longitude);
          if (dist > currentUser.maxDistance) return false;
        }

        return true;
      })
      .map(p => {
        let distance: number | null = null;
        if (hasMyLocation && p.latitude != null && p.longitude != null) {
          distance = Math.round(haversineKm(myLat, myLon, p.latitude, p.longitude));
        }
        const recency = activityScore(p);
        return { profile: p, distance, recency };
      });

    scored.sort((a, b) => {
      if (b.recency !== a.recency) return b.recency - a.recency;
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

  const allImages = currentProfile ? [currentProfile.imageUrl, ...(currentProfile.images || [])].filter(Boolean).slice(0, 9) : [];

  // Shared interests between current user and the profile being viewed
  const sharedInterests = useMemo(() => {
    if (!currentProfile) return [];
    const myInterests = new Set((currentUser.interests || []).map(i => i.toLowerCase()));
    return (currentProfile.interests || []).filter(i => myInterests.has(i.toLowerCase()));
  }, [currentProfile, currentUser.interests]);

  const goNext = useCallback((direction: 'left' | 'right') => {
    if (direction === 'right') {
      if (!currentUser.verified) {
        setShowVerifyDialog(true);
        return;
      }
      if (!isPro && dailyLikes >= dailyLikeLimit) {
        setShowLimitDialog(true);
        return;
      }
    }

    setFlyOut(direction);
    setTimeout(() => {
      if (currentProfile) {
        setLastSwipe({ profile: currentProfile, action: direction === 'right' ? 'like' : 'dislike', index: currentIndex });
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
  }, [currentProfile, isRequested, onLike, onDislike, filteredProfiles.length, currentUser.verified, dailyLikes, currentIndex]);

  // Rewind: undo last swipe (verified only)
  const handleRewind = useCallback(async () => {
    if (!lastSwipe || !currentUser.verified) return;
    try {
      await supabase
        .from('swipe_history')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('target_id', lastSwipe.profile.id);

      setSwipedIds(prev => {
        const next = new Set(prev);
        next.delete(lastSwipe.profile.id);
        return next;
      });

      if (lastSwipe.action === 'like') {
        setDailyLikes(prev => Math.max(0, prev - 1));
        await supabase
          .from('connection_requests')
          .delete()
          .eq('from_id', currentUser.id)
          .eq('to_id', lastSwipe.profile.id)
          .eq('status', 'pending');
      }

      setCurrentIndex(lastSwipe.index);
      setImageIdx(0);
      setLastSwipe(null);
    } catch (err) {
      console.error('Rewind failed:', err);
    }
  }, [lastSwipe, currentUser.id, currentUser.verified]);

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
    if (dragX > threshold) goNext('right');
    else if (dragX < -threshold) goNext('left');
    else { setDragX(0); setDragY(0); }
  };

  const handleCardTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (Math.abs(dragX) > 5) return;
    if (!cardRef.current || allImages.length <= 1) return;
    const rect = cardRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const tapX = clientX - rect.left;
    if (tapX < rect.width * 0.35) setImageIdx(prev => Math.max(0, prev - 1));
    else if (tapX > rect.width * 0.65) setImageIdx(prev => Math.min(allImages.length - 1, prev + 1));
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

  if (swipeLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#fffafa]">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#006400] rounded-full animate-spin"></div>
        <p className="mt-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Loading profiles...</p>
      </div>
    );
  }

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
      {/* Daily likes counter */}
      {currentUser.verified && !isPro && (
        <div className="absolute top-2 right-3 z-50">
          <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            <span className="text-[9px] font-bold text-white/80">{dailyLikeLimit - dailyLikes} ❤️ left</span>
          </div>
        </div>
      )}

      {/* Card Stack Area */}
      <div className="flex-1 relative px-2 pt-1.5 pb-1 min-h-0" style={{ maxHeight: 'calc(100% - 76px)' }}>
        {/* Background card (next card preview) */}
        {nextProfile && !flyOut && (
          <div className="absolute inset-0 mx-2 mt-1.5 mb-1">
            <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-gray-200" style={{ transform: `scale(${0.95 + Math.min(Math.abs(dragX) / 800, 0.05)})`, transition: isDragging ? 'none' : 'transform 0.4s ease' }}>
              <img src={nextProfile.imageUrl} className="w-full h-full object-cover" alt="" draggable={false} />
              <div className="absolute inset-0 bg-black/10" />
            </div>
          </div>
        )}

        {/* Main swipe card */}
        <div
          ref={cardRef}
          className="relative w-full h-full rounded-[1.5rem] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.15)] select-none"
          style={getCardStyle()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={handleCardTap}
        >
          <img
            src={allImages[imageIdx] || currentProfile.imageUrl}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            alt={currentProfile.name}
            draggable={false}
          />

          {/* Image pagination bars */}
          {allImages.length > 1 && (
            <div className="absolute top-2.5 left-0 right-0 flex justify-center gap-1 px-3 z-20">
              {allImages.map((_, i) => (
                <div key={i} className="flex-1 h-[2.5px] rounded-full transition-all duration-200" style={{ background: i === imageIdx ? '#fff' : 'rgba(255,255,255,0.35)', maxWidth: '50px' }} />
              ))}
            </div>
          )}

          {/* LIKE stamp */}
          <div className="absolute top-[15%] left-5 z-30 pointer-events-none" style={{ opacity: likeOpacity, transform: `rotate(-20deg) scale(${0.8 + likeOpacity * 0.4})` }}>
            <div className="border-[3px] border-green-400 rounded-lg px-4 py-1.5">
              <span className="text-green-400 font-black text-2xl tracking-wider">LIKE</span>
            </div>
          </div>

          {/* NOPE stamp */}
          <div className="absolute top-[15%] right-5 z-30 pointer-events-none" style={{ opacity: nopeOpacity, transform: `rotate(20deg) scale(${0.8 + nopeOpacity * 0.4})` }}>
            <div className="border-[3px] border-red-400 rounded-lg px-4 py-1.5">
              <span className="text-red-400 font-black text-2xl tracking-wider">NOPE</span>
            </div>
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

          {/* Profile info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
            {/* Name + Age + Verified + Active Dot */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <h2 className="text-[20px] font-black text-white leading-tight truncate">{toTitleCase(currentProfile.name)}, {currentProfile.age}</h2>
              {currentProfile.verified && (
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
              )}
              {isRecentlyActive(currentProfile) && (
                <span className="w-2.5 h-2.5 bg-green-400 rounded-full flex-shrink-0 border-[1.5px] border-white shadow-sm" />
              )}
            </div>

            {/* Job title / Company */}
            {(currentProfile.jobTitle || currentProfile.company || currentProfile.occupation) && (
              <p className="text-[13px] text-white/80 font-semibold truncate mb-0.5">
                {currentProfile.jobTitle
                  ? `${toTitleCase(currentProfile.jobTitle)}${currentProfile.company ? ` at ${toTitleCase(currentProfile.company)}` : ''}`
                  : toTitleCase(currentProfile.occupation)
                }
              </p>
            )}

            {/* Distance + Location */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-[11px] text-white/50 font-medium truncate">📍 {toTitleCase(currentProfile.location)}</p>
              {currentDistance != null && (
                <span className="text-[11px] text-white/40 font-medium">• {currentDistance < 1 ? '<1' : currentDistance} km</span>
              )}
            </div>

            {/* Relationship intent badge */}
            {currentProfile.relationshipGoal && (
              <div className="mb-1.5">
                <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm text-white text-[8px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                  💕 {currentProfile.relationshipGoal}
                </span>
              </div>
            )}

            {/* Bio snippet — hide on very small screens */}
            {currentProfile.bio && (
              <p className="text-[11px] text-white/70 font-medium leading-snug line-clamp-1 mb-1.5 hidden min-[400px]:block min-[400px]:line-clamp-2">
                {currentProfile.bio}
              </p>
            )}

            {/* Shared interests badges */}
            {sharedInterests.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {sharedInterests.slice(0, 3).map((interest, i) => (
                  <span key={i} className="bg-green-500/20 text-green-300 text-[8px] font-bold px-2 py-0.5 rounded-full border border-green-400/30">
                    ✦ {interest}
                  </span>
                ))}
                {sharedInterests.length > 3 && (
                  <span className="text-[8px] text-white/40 font-medium self-center">+{sharedInterests.length - 3}</span>
                )}
              </div>
            )}

            {/* See More button */}
            <button
              onClick={(e) => { e.stopPropagation(); onShowDetails(currentProfile); }}
              className="w-full py-2 bg-white/10 backdrop-blur-md rounded-xl text-white text-[10px] font-bold uppercase tracking-widest border border-white/15 active:scale-[0.98] transition-transform"
            >
              See more
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 py-2 px-4 flex-shrink-0">
        {/* Reject */}
        <button
          onClick={() => goNext('left')}
          className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg shadow-red-100/50 border border-gray-100 active:scale-90 transition-all"
        >
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Rewind (verified only) */}
        <button
          onClick={handleRewind}
          disabled={!lastSwipe || !currentUser.verified}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md border border-gray-100 active:scale-90 transition-all ${
            lastSwipe && currentUser.verified ? 'bg-white shadow-yellow-100/50' : 'bg-gray-50 opacity-40'
          }`}
        >
          <svg className="w-4.5 h-4.5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </button>

        {/* Info / Star */}
        <button
          onClick={() => onShowDetails(currentProfile)}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md shadow-blue-100/50 border border-gray-100 active:scale-90 transition-all"
        >
          <svg className="w-4.5 h-4.5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>

        {/* Like / Lock */}
        <button
          onClick={() => { if (!isRequested) goNext('right'); }}
          disabled={isRequested}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border border-gray-100 active:scale-90 transition-all ${
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

      {/* ─── Verify Profile Dialog ─────────────────────────────── */}
      {showVerifyDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowVerifyDialog(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-gray-800">Verification Required</h3>
            <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed">
              Only verified users can send likes. Complete your profile verification to start matching.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setShowVerifyDialog(false); /* navigate to verification handled by parent */ }}
                className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
              >
                Verify Profile
              </button>
              <button
                onClick={() => setShowVerifyDialog(false)}
                className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Daily Limit Dialog ────────────────────────────────── */}
      {showLimitDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowLimitDialog(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🔥</span>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-gray-800">Out of Likes</h3>
            <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed">
              You've used all {dailyLikeLimit} likes for today. Come back tomorrow or upgrade for unlimited likes!
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowLimitDialog(false)}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
              >
                Upgrade to Pro
              </button>
              <button
                onClick={() => setShowLimitDialog(false)}
                className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px]"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discover;
