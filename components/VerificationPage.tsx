
import React, { useState, useRef, useEffect } from 'react';

interface VerificationPageProps {
  onBack: () => void;
}

interface UploadStatus {
  idFront: string | null;
  idBack: string | null;
  selfie: string | null;
}

const VerificationPage: React.FC<VerificationPageProps> = ({ onBack }) => {
  const [step, setStep] = useState<'upload' | 'selfie' | 'success'>('upload');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploads, setUploads] = useState<UploadStatus>({
    idFront: null,
    idBack: null,
    selfie: null,
  });
  
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileSelect = async (field: keyof UploadStatus, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Map field to document type
    const docTypeMap: Record<keyof UploadStatus, 'idFront' | 'idBack' | 'selfie'> = {
      idFront: 'idFront',
      idBack: 'idBack',
      selfie: 'selfie'
    };

    setUploadingField(field);
    
    try {
      // Demo: use local file preview
      const imageUrl = URL.createObjectURL(file);
      setUploads(prev => ({ ...prev, [field]: imageUrl }));
      setUploadingField(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Upload failed');
      setUploadingField(null);
    }
    
    e.target.value = ''; // Reset input
  };

  const startCamera = async () => {
    setStep('selfie');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Please allow camera access to take a selfie.");
      setStep('upload');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob and upload
        canvas.toBlob(async (blob) => {
          if (blob) {
            setUploadingField('selfie');\n            stopCamera();\n            setStep('upload');
            
            try {
              const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
              const imageUrl = URL.createObjectURL(file);
              setUploads(prev => ({ ...prev, selfie: imageUrl }));
              setUploadingField(null);
            } catch (error: any) {
              console.error('Selfie upload error:', error);
              alert('Selfie upload failed');
              setUploadingField(null);
            }
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleSubmit = () => {
    if (!uploads.idFront || !uploads.idBack || !uploads.selfie) {
      alert("Please upload all required documents.");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStep('success');
    }, 2500);
  };

  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-4 uppercase tracking-tighter">Submission Received</h2>
        <p className="text-gray-500 text-sm font-medium mb-10">Thank you for your submission, you will get a verified badge shortly after our team reviews your documents.</p>
        <button 
          onClick={onBack}
          className="w-full py-4 bg-gray-100 text-gray-800 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto pb-32">
      <header className="p-6 flex items-center gap-4 border-b border-orange-100 bg-white sticky top-0 z-30">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Verification</h1>
      </header>

      <div className="p-8 space-y-10">
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-gray-800 leading-tight">Verify your account</h2>
          <p className="text-gray-500 text-sm">Please upload your government ID and a clear selfie to receive your verified badge.</p>
        </div>

        <div className="space-y-6">
          <input type="file" ref={idFrontRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect('idFront', e)} />
          <input type="file" ref={idBackRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect('idBack', e)} />
          
          <div className="grid grid-cols-2 gap-4">
            {/* ID Front */}
            <div 
              onClick={() => idFrontRef.current?.click()}
              className="aspect-square bg-white border-2 border-dashed border-red-100 rounded-3xl flex flex-col items-center justify-center gap-2 p-2 text-center cursor-pointer overflow-hidden group active:scale-95 transition-transform"
            >
              {uploads.idFront ? (
                <img src={uploads.idFront} className="w-full h-full object-cover rounded-2xl" alt="ID Front" />
              ) : uploadingField === 'idFront' ? (
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-6 h-6 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-300 leading-tight">ID Front</span>
                </>
              )}
            </div>

            {/* ID Back */}
            <div 
              onClick={() => idBackRef.current?.click()}
              className="aspect-square bg-white border-2 border-dashed border-red-100 rounded-3xl flex flex-col items-center justify-center gap-2 p-2 text-center cursor-pointer overflow-hidden group active:scale-95 transition-transform"
            >
              {uploads.idBack ? (
                <img src={uploads.idBack} className="w-full h-full object-cover rounded-2xl" alt="ID Back" />
              ) : uploadingField === 'idBack' ? (
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-6 h-6 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-300 leading-tight">ID Back</span>
                </>
              )}
            </div>
          </div>

          {/* Selfie Capture */}
          <div 
            onClick={startCamera}
            className="w-full h-48 bg-white border-2 border-dashed border-red-100 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer active:scale-[0.98] transition-all overflow-hidden"
          >
            {uploads.selfie ? (
              <div className="relative w-full h-full">
                <img src={uploads.selfie} className="w-full h-full object-cover" alt="Selfie" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="bg-white/40 backdrop-blur-md px-4 py-2 rounded-full text-white text-[10px] font-black uppercase tracking-widest">Retake Selfie</div>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-300">Capture Selfie</span>
              </>
            )}
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || !uploads.idFront || !uploads.idBack || !uploads.selfie}
          className="w-full py-5 bg-gradient-to-r from-pink-500 to-red-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Documents'}
        </button>
      </div>

      {/* Selfie Camera Overlay */}
      {step === 'selfie' && (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="absolute top-6 right-6">
            <button 
              onClick={() => { stopCamera(); setStep('upload'); }} 
              className="text-white p-2 bg-white/20 backdrop-blur-md rounded-full active:scale-90 transition-transform"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="relative w-full aspect-square max-w-sm flex items-center justify-center p-6">
             {/* Oval/Circular Guide */}
            <div className="absolute inset-0 border-[40px] border-black/80 z-10 pointer-events-none rounded-[100%] overflow-hidden">
               <div className="w-full h-full bg-transparent border-4 border-white/40 border-dashed rounded-[100%]"></div>
            </div>
            
            <div className="w-full h-full rounded-[100%] overflow-hidden bg-gray-900 border-4 border-white/20">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-6">
            <button 
              onClick={takePhoto}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-1.5 active:scale-90 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.4)]"
            >
              <div className="w-full h-full border-4 border-black/10 rounded-full bg-white shadow-inner flex items-center justify-center">
                 <div className="w-12 h-12 rounded-full border-2 border-black/5"></div>
              </div>
            </button>
            <p className="text-white/80 text-[10px] font-black uppercase tracking-widest">Center your face in the circle</p>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
};

export default VerificationPage;
