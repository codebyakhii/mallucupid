import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';

interface VerificationPageProps {
  onBack: () => void;
  currentUser: Profile;
}

const VerificationPage: React.FC<VerificationPageProps> = ({ onBack, currentUser }) => {
  const [step, setStep] = useState<'capture' | 'review' | 'submitting' | 'success' | 'already'>('capture');
  const [capturedPhotos, setCapturedPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── CHECK EXISTING KYC REQUEST ────────────────
  useEffect(() => {
    const checkExisting = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('kyc_verification_requests')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const req = data[0];
        if (req.status === 'pending') {
          setExistingRequest(req);
          setStep('already');
        } else if (req.status === 'rejected') {
          setExistingRequest(req);
        }
      }
      setLoading(false);
    };
    checkExisting();
  }, [currentUser.id]);

  // ─── START CAMERA ──────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraError('Camera access denied. Please allow camera permission and try again.');
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (step === 'capture' && !loading && existingRequest?.status !== 'pending') {
      startCamera();
    }
    return () => stopCamera();
  }, [step, loading, startCamera, stopCamera, existingRequest]);

  // ─── TAKE PHOTO ────────────────────────────────
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedPhotos((prev) => {
            const updated = [...prev, { blob, url }];
            if (updated.length >= 2) {
              stopCamera();
              setStep('review');
            }
            return updated;
          });
        }
      },
      'image/jpeg',
      0.92
    );
  };

  // ─── RETAKE ALL ───────────────────────────────
  const retakeAll = () => {
    setCapturedPhotos([]);
    setStep('capture');
  };

  // ─── SUBMIT KYC ───────────────────────────────
  const handleSubmit = async () => {
    if (capturedPhotos.length < 2) return;
    setIsSubmitting(true);
    setStep('submitting');

    try {
      const ts = Date.now();
      const path1 = `${currentUser.id}/${ts}_photo1.jpg`;
      const { error: up1 } = await supabase.storage
        .from('kyc-uploads')
        .upload(path1, capturedPhotos[0].blob, { contentType: 'image/jpeg' });
      if (up1) throw up1;

      const path2 = `${currentUser.id}/${ts}_photo2.jpg`;
      const { error: up2 } = await supabase.storage
        .from('kyc-uploads')
        .upload(path2, capturedPhotos[1].blob, { contentType: 'image/jpeg' });
      if (up2) throw up2;

      const { data: url1 } = supabase.storage.from('kyc-uploads').getPublicUrl(path1);
      const { data: url2 } = supabase.storage.from('kyc-uploads').getPublicUrl(path2);

      const { error: insertError } = await supabase
        .from('kyc_verification_requests')
        .insert({
          user_id: currentUser.id,
          live_photo_1: url1.publicUrl,
          live_photo_2: url2.publicUrl,
          status: 'pending',
        });
      if (insertError) throw insertError;

      await supabase.from('notifications').insert({
        user_id: currentUser.id,
        type: 'update',
        title: 'Verification submitted',
        message: 'Your verification request has been submitted and is being reviewed.',
      });

      setStep('success');
    } catch (err: any) {
      console.error('KYC submission error:', err);
      alert('Failed to submit verification. Please try again.');
      setStep('review');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#fdf8f5] flex items-center justify-center z-[100]">
        <div className="w-10 h-10 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ─── ALREADY PENDING ──────────────────────────
  if (step === 'already') {
    return (
      <div className="fixed inset-0 z-[100] bg-[#fdf8f5] flex flex-col">
        <header className="p-6 flex items-center gap-4 border-b border-gray-100 bg-white">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-500 active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight">Verification</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-3">Request pending</h2>
          <p className="text-sm text-gray-500 font-medium max-w-xs">Your verification request is being reviewed by our team. You'll receive a notification once it's processed.</p>
          <button onClick={onBack} className="mt-8 px-8 py-3.5 bg-gray-100 text-gray-700 rounded-full font-bold text-sm active:scale-95 transition-transform">Go back</button>
        </div>
      </div>
    );
  }

  // ─── SUBMITTING (PROCESSING DIALOG) ───────────
  if (step === 'submitting') {
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-5 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-2">Verification request processing</h3>
          <p className="text-sm text-gray-500 font-medium">Uploading your photos and submitting your request. Please wait...</p>
        </div>
      </div>
    );
  }

  // ─── SUCCESS DIALOG ───────────────────────────
  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-5 bg-green-50 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-2">Verification request submitted</h3>
          <p className="text-sm text-gray-500 font-medium mb-6">Our team will review your photos and verify your profile. You'll receive a notification once approved or rejected.</p>
          <button onClick={onBack} className="w-full py-4 bg-gradient-to-r from-[#FF4458] to-[#FF7854] text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-lg">Done</button>
        </div>
      </div>
    );
  }

  // ─── REVIEW STEP ──────────────────────────────
  if (step === 'review') {
    return (
      <div className="fixed inset-0 z-[100] bg-[#fdf8f5] flex flex-col">
        <header className="p-6 flex items-center gap-4 border-b border-gray-100 bg-white">
          <button onClick={retakeAll} className="p-2 -ml-2 text-gray-500 active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight">Review photos</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <p className="text-sm text-gray-500 font-medium text-center">Review your photos before submitting. Make sure your face is clearly visible.</p>

          <div className="grid grid-cols-2 gap-4">
            {capturedPhotos.map((photo, idx) => (
              <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                <img src={photo.url} className="w-full h-full object-cover" alt={`Photo ${idx + 1}`} />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  <span className="text-[10px] font-bold text-white uppercase">Photo {idx + 1}</span>
                </div>
              </div>
            ))}
          </div>

          {existingRequest?.status === 'rejected' && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Previous request rejected</p>
              {existingRequest.admin_notes && (
                <p className="text-xs text-red-500">{existingRequest.admin_notes}</p>
              )}
            </div>
          )}

          <button onClick={retakeAll} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95 transition-transform">
            Retake photos
          </button>
        </div>

        <div className="p-6 bg-white border-t border-gray-100 safe-area-bottom">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || capturedPhotos.length < 2}
            className="w-full py-4 bg-gradient-to-r from-[#FF4458] to-[#FF7854] text-white rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── CAPTURE STEP (MAIN) ──────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
        <button onClick={() => { stopCamera(); onBack(); }} className="w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-transform">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="bg-black/30 backdrop-blur-md px-4 py-2 rounded-full">
          <span className="text-white text-xs font-bold">{capturedPhotos.length}/2 photos</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Camera viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <p className="text-white text-sm font-medium mb-4">{cameraError}</p>
            <button onClick={startCamera} className="px-6 py-3 bg-white/20 backdrop-blur text-white rounded-full text-sm font-bold active:scale-95 transition-transform">
              Try again
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-72 border-2 border-white/40 rounded-[50%]" />
            </div>

            {/* Captured photo thumbnails */}
            {capturedPhotos.length > 0 && (
              <div className="absolute bottom-28 left-4 flex gap-2">
                {capturedPhotos.map((photo, idx) => (
                  <div key={idx} className="relative">
                    <img src={photo.url} className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-lg" alt="" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Instructions + capture button */}
      <div className="bg-black p-6 safe-area-bottom">
        <p className="text-center text-white/60 text-xs font-medium mb-4">
          {capturedPhotos.length === 0
            ? 'Take your first live photo. Keep your face clearly visible.'
            : 'Now take your second photo from a slightly different angle.'}
        </p>

        <div className="flex items-center justify-center">
          <button
            onClick={takePhoto}
            disabled={!cameraActive || capturedPhotos.length >= 2}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
          >
            <div className="w-16 h-16 bg-white rounded-full" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationPage;