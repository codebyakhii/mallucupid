
import React, { useState, useRef, useEffect } from 'react';
import { Profile, Message } from '../types';

interface ChatPageProps {
  targetProfile: Profile;
  onBack: () => void;
  messages: Message[];
  onSendMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  currentUserId: string;
}

const ChatPage: React.FC<ChatPageProps> = ({ targetProfile, onBack, messages, onSendMessage, currentUserId }) => {
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isUploading]);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    onSendMessage({
      senderId: currentUserId,
      receiverId: targetProfile.id,
      text: inputText
    });
    setInputText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 30) + 10;
      if (progress >= 100) {
        clearInterval(interval);
        setUploadProgress(100);
        setTimeout(() => {
          onSendMessage({
            senderId: currentUserId,
            receiverId: targetProfile.id,
            mediaUrl: URL.createObjectURL(file),
            mediaType: file.type.startsWith('image/') ? 'image' : 'video'
          });
          setIsUploading(false);
        }, 500);
      } else {
        setUploadProgress(progress);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-[#fdf8f5] flex flex-col z-[100] select-none">
      <div className="absolute inset-0 pointer-events-none z-[200] opacity-[0.03] overflow-hidden flex flex-wrap gap-20 p-10 rotate-12">
        {Array.from({ length: 100 }).map((_, i) => (
          <span key={i} className="text-4xl font-black uppercase whitespace-nowrap">Mallu Cupid Privacy</span>
        ))}
      </div>

      <header className="h-20 bg-white border-b border-orange-50 flex items-center px-6 gap-4 shadow-sm z-[150]">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex items-center gap-3">
          <img src={targetProfile.imageUrl} className="w-10 h-10 rounded-full object-cover border border-orange-100" />
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-800">@{targetProfile.username}</p>
              {targetProfile.verified && (
                <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Active Now</span>
            </div>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
      >
        <div className="text-center">
          <span className="bg-orange-50/80 text-orange-400 text-[8px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border border-orange-100 shadow-sm">
            End-to-End Encrypted
          </span>
        </div>

        {messages.map((m) => {
          const isMine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[75%] px-5 py-4 rounded-[2rem] shadow-sm relative group ${
                  isMine ? 'bg-red-500 text-white rounded-tr-none' : 'bg-white text-gray-700 border border-orange-50 rounded-tl-none'
                }`}
              >
                {m.text && <p className="text-sm font-medium leading-relaxed">{m.text}</p>}
                
                {m.mediaUrl && m.mediaType === 'image' && (
                  <img src={m.mediaUrl} className="rounded-2xl w-full h-auto mb-1 max-h-60 object-cover border border-black/5" />
                )}
                
                {m.mediaUrl && m.mediaType === 'video' && (
                  <video src={m.mediaUrl} controls className="rounded-2xl w-full h-auto mb-1 max-h-60 border border-black/5" />
                )}

                <div className={`text-[8px] font-bold uppercase mt-1 opacity-60 ${isMine ? 'text-right' : 'text-left'}`}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {isUploading && (
          <div className="flex justify-end">
            <div className="bg-white/80 backdrop-blur-md border border-red-100 px-6 py-4 rounded-3xl w-48 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Sending...</span>
                <span className="text-[9px] font-black text-red-500">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1 bg-red-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 bg-white border-t border-orange-50 safe-area-bottom z-[150]">
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-[2rem] border border-gray-100 shadow-inner">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-red-500 shadow-sm active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </button>
          
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Type your message..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium px-2 py-3"
          />

          <button 
            onClick={handleSendText}
            disabled={!inputText.trim()}
            className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all disabled:opacity-30"
          >
            <svg className="w-6 h-6 transform translate-x-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
