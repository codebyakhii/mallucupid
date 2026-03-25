
import React from 'react';
import { WithdrawalRequest } from '../types';

interface AdminPanelProps {
  requests: WithdrawalRequest[];
  onApprove: (id: string) => void;
  onHold: (id: string) => void;
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ requests, onApprove, onHold, onBack }) => {
  const pending = requests.filter(r => r.status === 'pending');

  return (
    <div className="flex flex-col h-full bg-[#fdf8f5] overflow-y-auto pb-40">
      <header className="p-6 flex items-center gap-4 border-b border-orange-100 bg-white sticky top-0 z-30 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-500 active:scale-75 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Admin Panel</h1>
      </header>

      <div className="p-8">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-2">Withdrawal Requests ({pending.length})</h3>
        
        {pending.length === 0 ? (
          <div className="text-center py-20 opacity-30">
             <p className="text-[10px] font-black uppercase tracking-widest">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(r => (
              <div key={r.id} className="bg-white p-6 rounded-[2.5rem] border border-orange-50 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-800 tracking-widest">@{r.username}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{new Date(r.timestamp).toLocaleString()}</p>
                  </div>
                  <p className="text-xl font-black text-red-500">₹{r.amount}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-orange-50">
                   <button 
                     onClick={() => onApprove(r.id)}
                     className="py-3 bg-[#006400] text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-transform"
                   >
                     Approve & Pay
                   </button>
                   <button 
                     onClick={() => onHold(r.id)}
                     className="py-3 bg-[#8B0000] text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-transform"
                   >
                     Hold Request
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
