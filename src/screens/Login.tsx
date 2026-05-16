import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '../stores/useAuthStore';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { continueAsGuest } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleGuestAccess = async () => {
    setLoading(true);
    try {
      await continueAsGuest();
      toast.success("Welcome, Guest!");
      navigate('/');
    } catch (error: any) {
      console.error(error);
      toast.error("Guest access is currently unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        toast.success("Welcome back!");
        navigate('/');
    } catch (error: any) {
      console.error("Auth Error:", error.code, error.message);
      
      let friendlyMessage = "Authentication failed. Please try again.";
      
      switch (error.code) {
        case 'auth/invalid-email':
          friendlyMessage = "The email address is not valid.";
          break;
        case 'auth/user-disabled':
          friendlyMessage = "This user account has been disabled.";
          break;
        case 'auth/user-not-found':
          friendlyMessage = "No user found with this email.";
          break;
        case 'auth/wrong-password':
          friendlyMessage = "Incorrect password. Please try again.";
          break;
        case 'auth/operation-not-allowed':
          friendlyMessage = "Email/Password sign-in is not enabled in Firebase Console.";
          break;
        case 'auth/invalid-credential':
          friendlyMessage = "Invalid credentials. Please check your email and password.";
          break;
      }
      
      toast.error(friendlyMessage, {
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-900/10 overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/10 rounded-full blur-2xl -ml-24 -mb-24" />
          
          <div className="relative inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl mb-8 shadow-2xl shadow-indigo-900/40">
            <span className="text-white text-4xl font-black italic">R</span>
          </div>
          <h1 className="text-white text-4xl font-black tracking-tight mb-3">RestoPro</h1>
          <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Enterprise Restaurant POS</p>
        </div>

        <form onSubmit={handleAuth} className="p-10 space-y-6">

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="email"
              placeholder="Email ID"
              required
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-800 outline-none"
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              placeholder="Security Key"
              required
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-800 outline-none"
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-sm h-[64px]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Authenticating...</span>
              </div>
            ) : (
              <>
                <span>Access Dashboard</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
          
          <div className="relative flex items-center justify-center py-2">
            <div className="w-full border-t border-slate-100"></div>
            <span className="bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Order without account</span>
          </div>

          <button
            type="button"
            onClick={handleGuestAccess}
            disabled={loading}
            className="w-full bg-white border-2 border-slate-100 hover:border-indigo-500 hover:text-indigo-600 text-slate-500 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[10px] h-[56px] disabled:opacity-50"
          >
            Browse Menu as Guest
          </button>

        </form>
      </div>
    </div>
  );
};

export default Login;
