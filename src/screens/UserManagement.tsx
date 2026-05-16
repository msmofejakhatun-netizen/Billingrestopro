import React, { useState, useEffect } from 'react';
import { useStaffStore, StaffUser } from '../stores/useStaffStore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  User as UserIcon, Shield, CheckCircle, XCircle, Trash2, 
  Plus, X, Lock, Mail, Loader2, Edit2, Search, 
  Filter, Key, Phone, Building2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface UserManagementProps {
  roleFilter?: 'admin' | 'captain' | 'owner';
}

const UserManagementScreen = ({ roleFilter }: UserManagementProps) => {
  const { profile } = useAuthStore();
  const { staff, loading: storeLoading, subscribe, createStaff, updateStaff, deleteStaff, resetPassword, toggleStatus } = useStaffStore();
  
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: (roleFilter || '') as any,
    restaurantId: '',
    phone: ''
  });

  useEffect(() => {
    if (!profile) return;
    // Owners see across everything, Admins only see their restaurant
    const sub = subscribe(profile.role === 'owner' ? undefined : profile.restaurantId);
    return () => sub();
  }, [profile]);

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter ? s.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createStaff({
        ...formData,
        role: formData.role || (profile?.role === 'owner' ? 'admin' : 'captain'),
        restaurantId: profile?.role === 'owner' ? formData.restaurantId : profile?.restaurantId
      });
      setIsAdding(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      await updateStaff(selectedUser.uid, {
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        restaurantId: formData.restaurantId
      });
      setIsEditing(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      email: '', 
      password: '', 
      role: (roleFilter || '') as any, 
      restaurantId: '', 
      phone: '' 
    });
    setSelectedUser(null);
  };

  const startEdit = (u: StaffUser) => {
    setSelectedUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      password: '', // Password not editable directly here
      role: u.role,
      restaurantId: u.restaurantId || '',
      phone: u.phone || ''
    });
    setIsEditing(true);
  };

  const confirmDelete = async (u: StaffUser) => {
     if (u.role === 'owner') return toast.error('Cannot delete root owner account');
     if (confirm(`Are you sure you want to delete ${u.name}? This will remove their record from the database.`)) {
        await deleteStaff(u.uid);
     }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
           <div className="p-4 bg-slate-900 rounded-[2rem] text-white shadow-xl shadow-slate-200">
              <Shield size={32} className="text-indigo-400" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                Command <span className="text-indigo-600">Access</span>
              </h2>
              <p className="text-[10px] font-mono text-slate-400 uppercase font-black tracking-widest mt-2 flex items-center gap-2">
                 <UserIcon size={10} /> {profile?.role === 'owner' ? 'Administrative Tier' : 'Operational Tier'}
              </p>
           </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="SEARCH OPERATIVES" 
                className="bg-white border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-3 outline-none focus:border-indigo-500 transition-all text-[11px] font-black uppercase tracking-widest w-64 shadow-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
           <button 
             onClick={() => { resetForm(); setIsAdding(true); }}
             className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
           >
              <Plus size={16} /> Deploy New
           </button>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredStaff.map(u => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={u.id}
              className={`bg-white p-8 rounded-[2.5rem] border-2 transition-all relative overflow-hidden group ${u.active ? 'border-slate-50' : 'border-rose-100 opacity-80'}`}
            >
               {/* Role Badge */}
               <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl font-black text-[9px] uppercase tracking-widest ${u.role === 'owner' ? 'bg-amber-100 text-amber-600' : u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                  {u.role}
               </div>

               <div className="flex items-center gap-6 mb-8">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-300 border-2 border-white shadow-inner">
                     <UserIcon size={32} />
                  </div>
                  <div>
                     <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none truncate">{u.name}</h3>
                     <p className="text-[10px] font-bold text-slate-400 truncate mt-1">{u.email}</p>
                  </div>
               </div>

               <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                     <div className="flex items-center gap-3">
                        <Building2 size={14} className="text-slate-400" />
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{u.restaurantId || 'ROOT'}</span>
                     </div>
                     <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${u.active ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {u.active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {u.active ? 'Active' : 'Locked'}
                     </div>
                  </div>

                  <div className="flex items-center gap-3 px-2">
                     <Phone size={12} className="text-slate-300" />
                     <span className="text-[11px] font-bold text-slate-600 font-mono">{u.phone || 'NO CONTACT'}</span>
                  </div>
               </div>

               <div className="flex items-center gap-2 pt-6 border-t border-slate-50">
                  <button 
                    onClick={() => startEdit(u)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                  >
                    <Edit2 size={14} /> Profile
                  </button>
                  <button 
                    onClick={() => toggleStatus(u.uid, !u.active)}
                    className={`p-3 rounded-2xl transition-all ${u.active ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}
                  >
                    <Lock size={16} />
                  </button>
                  <button 
                    onClick={() => resetPassword(u.email)}
                    title="Send Password Reset"
                    className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    <Key size={16} />
                  </button>
                  <button 
                    onClick={() => confirmDelete(u)}
                    className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
               </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredStaff.length === 0 && !storeLoading && (
          <div className="col-span-full py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-200 mb-4 shadow-sm">
                <Search size={32} />
             </div>
             <h4 className="text-slate-500 font-black uppercase tracking-widest text-xs">No operatives identified</h4>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || isEditing) && (
           <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
           >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl"
              >
                 <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">{isAdding ? 'Deploy' : 'Edit'} <span className="text-indigo-600">Operative</span></h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{isAdding ? 'Configure new system access' : `Updating ${selectedUser?.email}`}</p>
                    </div>
                    <button onClick={() => { setIsAdding(false); setIsEditing(false); resetForm(); }} className="p-3 bg-white text-slate-400 rounded-2xl">
                      <X size={24} />
                    </button>
                 </div>

                 <form onSubmit={isAdding ? handleAdd : handleUpdate} className="p-10 space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Display Name</label>
                      <input 
                        required 
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Contact Number</label>
                      <input 
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono"
                        placeholder="+91 XXXXX XXXXX"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>

                    {isAdding && (
                      <>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Digital Address (Email)</label>
                          <input 
                            required type="email"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all text-xs"
                            placeholder="agent@resto.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Initial Keyphrase (Password)</label>
                          <input 
                            required type="password"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {profile?.role === 'owner' && (
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Authority Role</label>
                            <select 
                              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none focus:border-indigo-500"
                              value={formData.role}
                              onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                            >
                               <option value="admin">Administrator</option>
                               <option value="captain">Captain</option>
                               <option value="owner">Global Owner</option>
                            </select>
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Restaurant Node</label>
                            <input 
                              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-indigo-500 font-mono outline-none focus:border-indigo-500 text-[10px]"
                              placeholder="RESTO-XXXX"
                              value={formData.restaurantId}
                              onChange={e => setFormData({ ...formData, restaurantId: e.target.value })}
                            />
                          </div>
                       </div>
                    )}

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl shadow-slate-200 mt-6 flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : isAdding ? 'Commence Deployment' : 'Apply Overrides'}
                    </button>
                 </form>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => { resetForm(); setIsAdding(true); }}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-200 z-40 lg:hidden"
      >
        <Plus size={32} />
      </motion.button>
    </div>
  );
};

export default UserManagementScreen;
