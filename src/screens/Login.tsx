import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '../stores/useAuthStore';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { loginREST } = useAuthStore();
  const [formData, setFormData] = useState({
    restaurantCode: '',
    email: '', // Username / Email field
    password: ''
  });
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.restaurantCode || !formData.email || !formData.password) {
        toast.error("All credentials are required.");
        setLoading(false);
        return;
      }

      await loginREST(formData.restaurantCode, formData.email, formData.password);
      toast.success("Welcome back!");

      // Retrieve authenticated profile and route by role immediately
      const profile = useAuthStore.getState().profile;
      const role = profile?.role ? profile.role.toUpperCase() : '';

      if (role === 'SUPER_OWNER') {
        navigate('/');
      } else if (role === 'OWNER') {
        navigate('/');
      } else if (role === 'ADMIN' || role === 'MANAGER') {
        navigate('/admin');
      } else if (role === 'CASHIER') {
        navigate('/pending-bills');
      } else if (role === 'KITCHEN') {
        navigate('/kds');
      } else if (role === 'CAPTAIN') {
        navigate('/');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      console.error("Auth Error:", error.message || error);
      const friendlyMessage = error.message || "Authentication failed. Please check credentials and try again.";
      toast.error(friendlyMessage, {
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-900/10 overflow-hidden border border-slate-150">
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
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Restaurant Code"
              required
              value={formData.restaurantCode}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-800 outline-none uppercase"
              onChange={(e) => setFormData({ ...formData, restaurantCode: e.target.value })}
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Username / Email"
              required
              value={formData.email}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-800 outline-none"
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              placeholder="Password / Security Key"
              required
              value={formData.password}
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
                <span>Please wait...</span>
              </div>
            ) : (
              <>
                <span>Access Dashboard</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

export default Login;
