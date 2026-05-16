import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle } from 'lucide-react';

interface CancellationReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title?: string;
  message?: string;
}

const REASONS = [
  "Customer changed mind",
  "Wrong order",
  "Kitchen unavailable",
  "Duplicate item",
  "Billing mistake",
  "Other"
];

export const CancellationReasonModal: React.FC<CancellationReasonModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = "Confirm Cancellation",
  message = "Please select a reason for this cancellation."
}) => {
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const handleConfirm = () => {
    const finalReason = selectedReason === "Other" ? otherReason : selectedReason;
    if (!finalReason) return;
    onConfirm(finalReason);
    setSelectedReason("");
    setOtherReason("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{title}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{message}</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      selectedReason === reason 
                        ? 'border-rose-500 bg-rose-50/50 text-rose-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-widest">{reason}</span>
                  </button>
                ))}
              </div>

              {selectedReason === "Other" && (
                <textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Type your reason here..."
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold outline-none focus:border-rose-500 transition-all min-h-[100px]"
                />
              )}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={!selectedReason || (selectedReason === "Other" && !otherReason)}
                  onClick={handleConfirm}
                  className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 disabled:opacity-50 transition-all shadow-lg shadow-rose-200"
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
