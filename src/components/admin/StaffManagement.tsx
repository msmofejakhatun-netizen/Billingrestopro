import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where, addDoc, serverTimestamp, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { User, Shield, CheckCircle, XCircle, Trash2, Plus, X, Lock, Mail, Phone, Loader2, UserCircle2, Key, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

interface Captain {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  assignedTables: string[];
  permissions: {
    canBilling: boolean;
    canDiscount: boolean;
    canPrinter: boolean;
    canCancel: boolean;
    canCancelBill: boolean;
  };
}

const StaffManagement = () => {
  const { profile } = useAuthStore();
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingCaptain, setEditingCaptain] = useState<Captain | null>(null);

  const handleResetPassword = async (email: string) => {
    try {
      toast.success('Simulated: Password reset email dispatched to ' + email);
    } catch (e) {
      toast.error('Failed to send reset email');
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCaptain) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', editingCaptain.uid), {
        name: editingCaptain.name,
        phone: editingCaptain.phone,
        active: editingCaptain.active,
        permissions: editingCaptain.permissions
      });
      toast.success('Profile updated successfully');
      setEditingCaptain(null);
    } catch (e) {
      toast.error('Profile update failed');
    } finally {
      setLoading(false);
    }
  };
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    assignedTables: [] as string[],
    permissions: {
      canEditOrder: true,
      canCancelOrder: false,
      canGenerateBill: true,
      canApplyDiscount: false,
      canReprintKOT: true,
      canPrinterAccess: true,
      canCancelBill: false
    }
  });

  useEffect(() => {
    if (!profile?.restaurantId) return;

    const q = profile.role === 'owner' 
      ? query(collection(db, 'users'), where('restaurantId', '==', profile.restaurantId), where('role', 'in', ['admin', 'captain', 'owner']))
      : query(collection(db, 'users'), where('restaurantId', '==', profile.restaurantId), where('role', '==', 'captain'));

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Captain));
      setCaptains(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
  }, [profile?.restaurantId, profile?.role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 6) return toast.error('Password too short');
    if (formData.password !== formData.confirmPassword) return toast.error('Passwords mismatch');

    setLoading(true);
    try {
      const uid = 'captain_' + Math.floor(100000 + Math.random() * 900000);

      const captainData = {
        uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        restaurantId: profile?.restaurantId,
        role: 'captain',
        active: true,
        assignedTables: formData.assignedTables,
        permissions: formData.permissions,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', uid), captainData);
      await addDoc(collection(db, 'captains'), captainData);

      toast.success('Captain created successfully');
      alert(`Credentials for ${formData.name}:\n\nEmail: ${formData.email}\nPassword: ${formData.password}`);
      
      setIsAdding(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
      // Also update in captains collection as they are synced in this simple app
      const q = query(collection(db, 'captains'), where('uid', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'captains', snap.docs[0].id), updates);
      }
      toast.success('Updated successfully');
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<Captain | null>(null);

  const handleDelete = async () => {
    if (!confirmDeleteUser) return;
    try {
       await deleteDoc(doc(db, 'users', confirmDeleteUser.uid));
       const q = query(collection(db, 'captains'), where('uid', '==', confirmDeleteUser.uid));
       const snap = await getDocs(q);
       if (!snap.empty) await deleteDoc(doc(db, 'captains', snap.docs[0].id));
       toast.success('Personnel record removed');
       setConfirmDeleteUser(null);
    } catch (e) {
        toast.error('Delete failed');
    }
  };

  const resetForm = () => {
    setFormData({
        name: '', email: '', phone: '', password: '', confirmPassword: '',
        assignedTables: [],
        permissions: { 
          canEditOrder: true, 
          canCancelOrder: false, 
          canGenerateBill: true, 
          canApplyDiscount: false,
          canReprintKOT: true,
          canPrinterAccess: true,
          canCancelBill: false
        }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Captain Registry</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage floor staff & access permissions</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus size={18} />
          Onboard Captain
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-50 shadow-2xl space-y-8 mb-8">
               <div className="flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                     <UserCircle2 size={24} />
                   </div>
                   <h4 className="font-black text-slate-800 uppercase tracking-tight">New Recruitment</h4>
                 </div>
                 <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <X size={24} />
                 </button>
               </div>

               <form onSubmit={handleCreate} className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Full Name</label>
                      <input 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold"
                        value={formData.name}
                        placeholder="Ex: Rahul Sharma"
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Email (Login UID)</label>
                      <input 
                        required
                        type="email"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold"
                        value={formData.email}
                        placeholder="captain@restaurant.com"
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Phone Number</label>
                      <input 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold"
                        value={formData.phone}
                        placeholder="+91 00000 00000"
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Access Password</label>
                      <input 
                        required
                        type="password"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold font-mono"
                        value={formData.password}
                        placeholder="••••••••"
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Confirm Password</label>
                      <input 
                        required
                        type="password"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold font-mono"
                        value={formData.confirmPassword}
                        placeholder="••••••••"
                        onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                      />
                    </div>
                 </div>

                 <div className="bg-slate-50 p-6 rounded-3xl space-y-6">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Shield size={14} className="text-indigo-600" />
                       Operation Permissions
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                       {[
                         { key: 'canEditOrder', label: 'Edit Order' },
                         { key: 'canCancelOrder', label: 'Cancel Order' },
                         { key: 'canGenerateBill', label: 'Generate Bill' },
                         { key: 'canApplyDiscount', label: 'Apply Discount' },
                         { key: 'canReprintKOT', label: 'Reprint KOT' },
                         { key: 'canPrinterAccess', label: 'Printer Access' },
                         { key: 'canCancelBill', label: 'Cancel Bill' }
                       ].map(perm => (
                         <label key={perm.key} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-indigo-500 transition-colors">
                            <input 
                                type="checkbox"
                                checked={(formData.permissions as any)[perm.key]}
                                onChange={e => setFormData({ ...formData, permissions: { ...formData.permissions, [perm.key]: e.target.checked } })}
                                className="w-5 h-5 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] font-black uppercase text-slate-700">{perm.label}</span>
                         </label>
                       ))}
                    </div>
                 </div>

                 <div className="flex justify-end gap-4">
                    <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Discard</button>
                    <button 
                        type="submit"
                        disabled={loading}
                        className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        Sync with Cloud Auth
                    </button>
                 </div>
               </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {captains.map(captain => (
          <motion.div 
            key={captain.id}
            layout
            className={`bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300 ${!captain.active ? 'opacity-60 grayscale' : ''}`}
          >
            <div className="p-6 flex justify-between items-start">
               <div className="flex gap-4 items-center">
                 <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                    <UserCircle2 size={32} />
                 </div>
                 <div>
                    <h4 className="font-black text-slate-800 text-lg uppercase leading-tight">{captain.name}</h4>
                    <p className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-widest mt-0.5">ID: {captain.uid.slice(0, 8)}</p>
                 </div>
               </div>
               <div className="flex gap-1">
                  <button onClick={() => setConfirmDeleteUser(captain)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-colors">
                     <Trash2 size={16} />
                  </button>
               </div>
            </div>

            <div className="px-6 py-4 space-y-4 bg-slate-50/50">
               <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <Mail size={14} className="text-slate-300" />
                  {captain.email}
               </div>
               <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <Phone size={14} className="text-slate-300" />
                  {captain.phone || 'N/A'}
               </div>
            </div>

            <div className="p-6 space-y-6">
               <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Permission Matrix</p>
                  <div className="grid grid-cols-2 gap-2">
                     {Object.entries(captain.permissions || {}).map(([key, val]: [string, any]) => (
                        <div key={key} className={`px-3 py-2 rounded-xl flex items-center gap-2 border ${val ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                           {val ? <CheckCircle size={10} /> : <XCircle size={10} />}
                           <span className="text-[9px] font-black uppercase tracking-tighter">
                              {key.slice(3)}
                           </span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <button 
                    onClick={() => handleUpdate(captain.uid, { active: !captain.active })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${captain.active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                  >
                    {captain.active ? 'Active' : 'Offline'}
                  </button>
                  <div className="flex gap-2">
                     <button 
                       onClick={() => handleResetPassword(captain.email)}
                       className="p-2 hover:bg-slate-100 text-slate-300 hover:text-amber-500 transition-colors rounded-xl" 
                       title="Reset Password"
                     >
                        <Key size={16} />
                     </button>
                     <button 
                       onClick={() => setEditingCaptain(captain)}
                       className="p-2 hover:bg-slate-100 text-slate-300 hover:text-indigo-500 transition-colors rounded-xl" 
                       title="Edit Profile"
                     >
                        <Settings2 size={16} />
                     </button>
                  </div>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingCaptain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-10 max-w-2xl w-full shadow-2xl space-y-8 relative"
            >
               <button 
                 onClick={() => setEditingCaptain(null)}
                 className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-colors"
               >
                 <X size={28} />
               </button>

               <div>
                 <h3 className="text-2xl font-black text-slate-900 uppercase">Edit Captain Profile</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Modify credentials and permissions for {editingCaptain.name}</p>
               </div>

               <form onSubmit={handleEditProfile} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Full Name</label>
                      <input 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold"
                        value={editingCaptain.name}
                        onChange={e => setEditingCaptain({ ...editingCaptain, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Phone Number</label>
                      <input 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold"
                        value={editingCaptain.phone || ''}
                        onChange={e => setEditingCaptain({ ...editingCaptain, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl space-y-6">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Shield size={14} className="text-indigo-600" />
                       Update Operation Permissions
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                       {[
                         { key: 'canGenerateBill', label: 'Generate Bill' },
                         { key: 'canApplyDiscount', label: 'Apply Discount' },
                         { key: 'canReprintKOT', label: 'Reprint KOT' },
                         { key: 'canCancelOrder', label: 'Cancel Order' },
                         { key: 'canCancelBill', label: 'Cancel Bill' }
                       ].map(perm => (
                         <label key={perm.key} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-indigo-500 transition-colors">
                            <input 
                                type="checkbox"
                                checked={(editingCaptain.permissions as any)[perm.key]}
                                onChange={e => setEditingCaptain({ 
                                  ...editingCaptain, 
                                  permissions: { ...editingCaptain.permissions, [perm.key]: e.target.checked } 
                                })}
                                className="w-5 h-5 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] font-black uppercase text-slate-700">{perm.label}</span>
                         </label>
                       ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={() => setEditingCaptain(null)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                    <button 
                        type="submit"
                        disabled={loading}
                        className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        Save Changes
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl text-center space-y-6"
            >
               <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[1.5rem] flex items-center justify-center mx-auto">
                  <Trash2 size={32} />
               </div>
               <div>
                 <h4 className="text-xl font-black text-slate-900 uppercase">Revoke Access?</h4>
                 <p className="text-sm font-bold text-slate-500 leading-relaxed mt-2">
                   This will permanently remove <span className="text-slate-900">{confirmDeleteUser.name}</span> from the system. 
                   They will lose all access to the {profile?.restaurantId} orchestration.
                 </p>
               </div>
               <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleDelete}
                    className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
                  >
                    Confirm Deletion
                  </button>
                  <button 
                    onClick={() => setConfirmDeleteUser(null)}
                    className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffManagement;
