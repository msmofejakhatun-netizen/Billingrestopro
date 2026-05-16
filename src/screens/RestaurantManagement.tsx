import React, { useState, useEffect } from 'react';
import { useRestaurantStore, Restaurant } from '../stores/useRestaurantStore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  Utensils, Edit2, Trash2, Shield, Eye, 
  Search, Filter, Plus, X, Building2, 
  Phone, MapPin, CheckCircle, XCircle, 
  Archive, Loader2, MoreVertical, ChevronRight, Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import RestaurantForm from '../components/RestaurantForm';

const RestaurantManagementScreen = () => {
    const { profile } = useAuthStore();
    const { restaurants, subscribe, createRestaurant, updateRestaurant, deleteRestaurant, archiveRestaurant } = useRestaurantStore();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
    const [editData, setEditData] = useState<Partial<Restaurant>>({});
    const [confirmName, setConfirmName] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
  
    useEffect(() => {
      return subscribe();
    }, []);

    const filteredRestaurants = restaurants.filter(r => {
      const matchesSearch = r.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.restaurantCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = showArchived ? true : r.active;
      return matchesSearch && matchesStatus;
    });

    const handleEdit = (r: Restaurant) => {
      setSelectedRestaurant(r);
      setEditData({ ...r });
      setIsEditing(true);
    };

    const confirmDelete = (r: Restaurant) => {
      setSelectedRestaurant(r);
      setIsDeleting(true);
    };

    const handleCreateRestaurant = async (restaurantData: Partial<Restaurant>, adminData: any) => {
      try {
        await createRestaurant(restaurantData, adminData);
        setIsAdding(false);
      } catch (err) {
        console.error(err);
      }
    };

    const handleUpdateRestaurant = async (data: Partial<Restaurant>) => {
      if (selectedRestaurant) {
        await updateRestaurant(selectedRestaurant.id, data);
        setIsEditing(false);
      }
    };

    const navigate = useNavigate();

    const handleOpenDashboard = async (r: Restaurant) => {
      try {
        await useAuthStore.getState().setRestaurant(r.id);
        useRestaurantStore.getState().setCurrentRestaurant(r);
        toast.success(`Switched context to ${r.restaurantName}`);
        navigate('/');
      } catch (err) {
        toast.error('Failed to switch context');
      }
    };

    const handleDelete = async () => {
      if (!selectedRestaurant) return;
      if (confirmName !== selectedRestaurant.restaurantName) {
        return toast.error('Restaurant name mismatch. Type it exactly to confirm purge.');
      }
      setLoading(true);
      try {
        await deleteRestaurant(selectedRestaurant.id);
        setIsDeleting(false);
        setConfirmName('');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const toggleStatus = async (r: Restaurant) => {
      try {
        await updateRestaurant(r.id, { active: !r.active });
      } catch (err) {
        console.error(err);
      }
    };
  
    return (
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
             <div className="p-4 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-100 flex-shrink-0">
                <Building2 size={32} />
             </div>
             <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">
                  Cluster <span className="text-indigo-600">Forge</span>
                </h2>
                <p className="text-[10px] font-mono text-slate-400 uppercase font-black tracking-widest mt-2 flex items-center gap-2">
                   <Shield size={10} /> Central Station / Restaurant Orchestration
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="ID OR NAME" 
                  className="bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-3 outline-none focus:border-indigo-500 focus:bg-white transition-all text-[11px] font-black uppercase tracking-widest w-64"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
             </div>
             <button 
               onClick={() => setShowArchived(!showArchived)}
               className={`p-3 rounded-2xl border-2 transition-all ${showArchived ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}
             >
                <Archive size={20} />
             </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
           {[
             { label: 'Active Clusters', value: restaurants.filter(r => r.active).length, icon: CheckCircle, color: 'emerald' },
             { label: 'Total Managed', value: restaurants.length, icon: Building2, color: 'indigo' },
             { label: 'Offline Nodes', value: restaurants.filter(r => !r.active).length, icon: XCircle, color: 'rose' },
             { label: 'Cloud Status', value: 'OPERATIONAL', icon: Shield, color: 'slate' },
           ].map((stat, i) => (
             <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                   <div className={`p-2 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl`}>
                      <stat.icon size={16} />
                   </div>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">{stat.label}</p>
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tighter uppercase">{stat.value}</p>
             </div>
           ))}
        </div>

        {/* Restaurant Grid / Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRestaurants.map(r => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={r.id} 
                className={`group relative bg-white p-8 rounded-[2.5rem] border-2 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200 ${r.active ? 'border-slate-50' : 'border-rose-100 opacity-75'}`}
              >
                {!r.active && (
                   <div className="absolute top-6 right-6 px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[8px] font-black uppercase tracking-widest z-10">
                      Inactive
                   </div>
                )}

                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <div className="w-20 h-20 bg-slate-900 rounded-[1.75rem] flex items-center justify-center text-white overflow-hidden border-4 border-white shadow-xl">
                      {r.logo ? <img src={r.logo} alt="" className="w-full h-full object-cover" /> : <Utensils size={32} className="text-indigo-400" />}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg truncate leading-none">{r.restaurantName}</h3>
                    <p className="text-[10px] font-mono text-indigo-500 font-black tracking-widest mt-2">{r.restaurantCode}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                   <div className="flex items-center gap-3 text-slate-500">
                     <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                       <Shield size={14} />
                     </div>
                     <div className="min-w-0">
                       <p className="text-[9px] font-black uppercase text-slate-300 tracking-widest leading-none">Primary Admin</p>
                       <p className="text-[11px] font-bold text-slate-700 truncate">{r.ownerName || 'Cluster Root'}</p>
                     </div>
                   </div>

                   <div className="flex items-center gap-3 text-slate-500">
                     <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-400">
                        <CheckCircle size={14} />
                     </div>
                     <div>
                       <p className="text-[9px] font-black uppercase text-slate-300 tracking-widest leading-none">Active Load</p>
                       <p className="text-[11px] font-bold text-slate-700">{r.totalOrders || 0} Orders</p>
                     </div>
                   </div>

                   <div className="flex items-center gap-3 text-slate-500">
                     <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <MapPin size={14} />
                     </div>
                     <p className="text-[11px] font-bold text-slate-700 uppercase truncate">{r.city || 'N/A'}</p>
                   </div>

                   <div className="flex items-center gap-3 text-slate-500">
                     <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Hash size={14} />
                     </div>
                     <p className="text-[11px] font-bold text-slate-700 font-mono">{r.gstNumber ? 'GST ON' : 'GST OFF'}</p>
                   </div>
                </div>

                <div className="flex items-center gap-2 pt-6 border-t border-slate-50">
                   <button 
                     onClick={() => handleOpenDashboard(r)}
                     className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm group/btn"
                     title="Open Dashboard"
                   >
                     <Eye size={16} />
                   </button>
                   <button 
                     onClick={() => handleEdit(r)}
                     className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-sm"
                   >
                     <Edit2 size={14} /> Edit
                   </button>
                   {profile?.role === 'owner' && (
                     <>
                      <button 
                        onClick={() => toggleStatus(r)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${r.active ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                      >
                        {r.active ? 'Disable' : 'Enable'}
                      </button>
                      <button 
                        onClick={() => confirmDelete(r)}
                        className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-slate-100"
                      >
                        <Trash2 size={16} />
                      </button>
                     </>
                   )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {isAdding && (
            <RestaurantForm 
              onClose={() => setIsAdding(false)}
              onSubmit={handleCreateRestaurant}
            />
          )}

          {isEditing && (
            <RestaurantForm 
              initialData={selectedRestaurant || undefined}
              onClose={() => { setIsEditing(false); setSelectedRestaurant(null); }}
              onSubmit={handleUpdateRestaurant}
            />
          )}

          {isDeleting && (
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 text-center"
             >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                  className="bg-white w-full max-w-md rounded-[3rem] p-10 overflow-hidden shadow-2xl"
                >
                   <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-rose-100/50">
                      <Trash2 size={40} />
                   </div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic mb-4">Permanent <span className="text-rose-500">Purge?</span></h3>
                   <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                      You are about to delete <span className="text-slate-900 font-black uppercase">{selectedRestaurant?.restaurantName}</span>. 
                      This will PERMANENTLY erase all menus, tables, orders, and staff records associated with this cluster. This action is irreversible.
                   </p>

                   <div className="space-y-4 mb-8">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Type restaurant name to confirm</p>
                      <input 
                        className="w-full px-6 py-4 bg-rose-50 border-2 border-rose-100 rounded-2xl font-black text-rose-600 outline-none text-center uppercase tracking-tighter"
                        placeholder={selectedRestaurant?.restaurantName}
                        value={confirmName}
                        onChange={e => setConfirmName(e.target.value)}
                      />
                   </div>
                   
                   <div className="flex flex-col gap-4">
                      <button 
                        onClick={handleDelete}
                        disabled={loading || confirmName !== selectedRestaurant?.restaurantName}
                        className="w-full py-5 bg-rose-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-200 flex items-center justify-center gap-3 hover:bg-rose-600 transition-all disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Execute Terminal Purge'}
                      </button>
                      <button 
                        onClick={() => setIsDeleting(false)}
                        className="w-full py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Abort Protocol
                      </button>
                   </div>
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
          onClick={() => setIsAdding(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-200 z-40 lg:hidden"
        >
          <Plus size={32} />
        </motion.button>
      </div>
    );
  };
  
  export default RestaurantManagementScreen;
