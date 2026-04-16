import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface VerifyAuthorityPageProps {
  currentUser: Profile;
  onVerified: () => void;
  onBack: () => void;
}

interface SecurityQuestion {
  id: number;
  question_order: number;
  question: string;
}

const VerifyAuthorityPage: React.FC<VerifyAuthorityPageProps> = ({ currentUser, onVerified, onBack }) => {
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('admin_security_questions')
        .select('id, question_order, question')
        .order('question_order', { ascending: true });

      if (fetchError) {
        setError('Failed to load security questions');
        setLoading(false);
        return;
      }

      setQuestions(data || []);
      setLoading(false);
    };

    fetchQuestions();
  }, []);

  const handleVerify = async () => {
    // Check all questions are answered
    const unanswered = questions.filter(q => !answers[q.question_order]?.trim());
    if (unanswered.length > 0) {
      setError('Please answer all security questions');
      return;
    }

    setError('');
    setVerifying(true);

    try {
      // Build answers object: { "1": "answer1", "2": "answer2", ... }
      const answersPayload: Record<string, string> = {};
      questions.forEach(q => {
        answersPayload[q.question_order.toString()] = answers[q.question_order].trim();
      });

      const { data, error: rpcError } = await supabase.rpc('verify_admin_security', {
        p_answers: answersPayload,
      });

      if (rpcError) throw new Error(rpcError.message);

      if (data === true) {
        onVerified();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          setError('Too many failed attempts. You will be logged out.');
          setTimeout(() => onBack(), 2000);
        } else {
          setError(`Incorrect answers. ${3 - newAttempts} attempt(s) remaining.`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[10px] font-black uppercase text-blue-400 tracking-[0.3em] animate-pulse">Loading verification</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a1a] overflow-hidden">
      {/* Header */}
      <header className="px-6 py-5 flex items-center gap-4 flex-shrink-0 border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2 text-white/40 active:scale-75 transition-transform">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-tight">Verify authority</h1>
          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Security verification required</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        {/* Shield icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/20">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
        </div>

        <p className="text-center text-white/40 text-xs font-medium mb-8 leading-relaxed">
          Answer all security questions correctly to access the admin dashboard.
        </p>

        {/* Questions */}
        <div className="space-y-5">
          {questions.map((q, idx) => (
            <div key={q.id}>
              <label className="block text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">
                Q{idx + 1}. {q.question}
              </label>
              <input
                type="password"
                value={answers[q.question_order] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [q.question_order]: e.target.value }))}
                placeholder="Enter your answer"
                disabled={verifying || attempts >= 3}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-40"
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl py-3 px-4 text-red-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={verifying || attempts >= 3}
          className="w-full mt-8 py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:active:scale-100"
        >
          {verifying ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Verifying...</span>
            </>
          ) : (
            'Verify & proceed'
          )}
        </button>
      </div>
    </div>
  );
};

export default VerifyAuthorityPage;
