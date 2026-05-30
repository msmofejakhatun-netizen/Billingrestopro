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

    const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
    const [viewDetailsRestaurant, setViewDetailsRestaurant] = useState<Restaurant | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
    useEffect(() => {
      return subscribe();
    }, []);

    const filteredRestaurants = restaurants.filter(r => {
      const matchesSearch = r.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.restaurantCode.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (r.status === 'DELETED') return false;

      const isRestaurantActive = r.status === 'ACTIVE' || (r.status === undefined && r.active);
      const isRestaurantDisabled = r.status === 'DISABLED' || (r.status === undefined && !r.active);

      if (activeTab === 'ACTIVE') {
         return matchesSearch && isRestaurantActive;
      }
      if (activeTab === 'DISABLED') {
         return matchesSearch && isRestaurantDisabled;
      }
      return matchesSearch; // 'ALL' tab
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

    const handleDeleteConfirm = async () => {
      if (!selectedRestaurant) return;
      setLoading(true);
      try {
        await deleteRestaurant(selectedRestaurant.id);
        setIsDeleting(false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const handleEnable = async (r: Restaurant) => {
      try {
        const { enableRestaurant } = useRestaurantStore.getState();
        await enableRestaurant(r.id);
      } catch (err) {
        console.error(err);
      }
    };

    const handleDisable = async (r: Restaurant) => {
      try {
        const { disableRestaurant } = useRestaurantStore.getState();
        await disableRestaurant(r.id, profile?.email || 'Super Owner');
      } catch (err) {
        console.error(err);
      }
    };

    const toggleStatus = async (r: Restaurant) => {
      const isDisabled = r.status === 'DISABLED' || (r.status === undefined && !r.active);
      if (isDisabled) {
        await handleEnable(r);
      } else {
        await handleDisable(r);
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

          {/* Filter Tabs & Add Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
             <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-150">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'ACTIVE', label: 'Active' },
                  { id: 'DISABLED', label: 'Disabled' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeTab === t.id 
                        ? 'bg-slate-900 text-white shadow-md' 
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
             </div>

             <div className="flex items-center gap-2">
                <div className="relative group">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                   <input 
                     type="text" 
                     placeholder="ID OR NAME" 
                     className="bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white transition-all text-[11px] font-black uppercase tracking-widest w-48"
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                   />
                </div>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-150 flex items-center gap-2"
                >
                  <Plus size={16} /> Launch Cluster
                </button>
             </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
           {[
             { label: 'Active Clusters', value: restaurants.filter(r => r.status !== 'DISABLED' && r.active).length, icon: CheckCircle, color: 'emerald' },
             { label: 'Total Managed', value: restaurants.length, icon: Building2, color: 'indigo' },
             { label: 'Disabled Clusters', value: restaurants.filter(r => r.status === 'DISABLED' || !r.active).length, icon: XCircle, color: 'rose' },
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

        {/* Restaurant Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRestaurants.map(r => {
              const isDisabled = r.status === 'DISABLED' || (r.status === undefined && !r.active);
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={r.id} 
                  className={`group relative bg-white p-8 rounded-[2.5rem] border-2 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200 ${
                    isDisabled ? 'border-rose-100 bg-slate-50/50 opacity-75 grayscale-[20%]' : 'border-slate-50'
                  }`}
                >
                  {/* Status Badge & Action Menu Top-Right */}
                  <div className="absolute top-6 right-6 flex items-center gap-2">
                     {isDisabled ? (
                        <span className="px-3 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[8px] font-black uppercase tracking-widest z-10">
                           Disabled
                        </span>
                     ) : (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[8px] font-black uppercase tracking-widest z-10">
                           Active
                        </span>
                     )}

                     {/* Custom dropdown Action Menu */}
                     <div className="relative">
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           setActiveMenuId(activeMenuId === r.id ? null : r.id);
                         }}
                         className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
                         title="Context Operations"
                       >
                         <MoreVertical size={16} />
                       </button>

                       {activeMenuId === r.id && (
                         <>
                           <div 
                             className="fixed inset-0 z-30" 
                             onClick={(e) => {
                               e.stopPropagation();
                               setActiveMenuId(null);
                             }}
                           />
                           <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-150 rounded-2xl shadow-xl py-2 z-40 text-left">
                             <button 
                               onClick={() => {
                                 handleOpenDashboard(r);
                                 setActiveMenuId(null);
                               }}
                               className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                             >
                               <Eye size={14} /> Open POS
                             </button>
                             <button 
                               onClick={() => {
                                 setViewDetailsRestaurant(r);
                                 setActiveMenuId(null);
                               }}
                               className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                             >
                               <Eye size={14} /> View Details
                             </button>
                             <button 
                               onClick={() => {
                                 handleEdit(r);
                                 setActiveMenuId(null);
                               }}
                               className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                             >
                               <Edit2 size={14} /> Edit
                             </button>
                             
                             {isDisabled ? (
                               <button 
                                 onClick={() => {
                                   handleEnable(r);
                                   setActiveMenuId(null);
                                 }}
                                 className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                               >
                                 <CheckCircle size={14} /> Enable
                               </button>
                             ) : (
                               <button 
                                 onClick={() => {
                                   handleDisable(r);
                                   setActiveMenuId(null);
                                 }}
                                 className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2"
                               >
                                 <XCircle size={14} /> Disable
                               </button>
                             )}

                             <button 
                               onClick={() => {
                                 navigate('/branches');
                                 setActiveMenuId(null);
                               }}
                               className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                             >
                               <Building2 size={14} /> Branch Settings
                             </button>

                             <div className="border-t border-slate-100 my-1" />
                             <button 
                               onClick={() => {
                                 confirmDelete(r);
                                 setActiveMenuId(null);
                               }}
                               className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2"
                             >
                               <Trash2 size={14} /> Delete
                             </button>
                           </div>
                         </>
                       )}
                     </div>
                  </div>

                  {/* Logo and Name */}
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

                  {/* Attributes Panel */}
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

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-6 border-t border-slate-50">
                     <button 
                       onClick={() => handleOpenDashboard(r)}
                       disabled={isDisabled}
                       className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm group/btn disabled:opacity-50 disabled:hover:bg-indigo-50 disabled:hover:text-indigo-600"
                       title={isDisabled ? "Restaurant is disabled" : "Open POS Dashboard"}
                     >
                       <Eye size={16} />
                     </button>
                     <button 
                       onClick={() => handleEdit(r)}
                       className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-sm"
                     >
                       <Edit2 size={14} /> Edit
                     </button>
                     {profile?.role === 'super_owner' || profile?.role === 'owner' ? (
                       <>
                        <button 
                          onClick={() => toggleStatus(r)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            isDisabled ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          }`}
                        >
                          {isDisabled ? 'Enable' : 'Disable'}
                        </button>
                        <button 
                          onClick={() => confirmDelete(r)}
                          className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-slate-100"
                          title="Purge Restaurant"
                        >
                          <Trash2 size={16} />
                        </button>
                       </>
                     ) : null}
                  </div>
                </motion.div>
              );
            })}
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

          {/* Delete Confirmation Popup */}
          {isDeleting && (
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 text-center"
             >
                <motion.div 
                   initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                   className="bg-white w-full max-w-md rounded-[3rem] p-10 overflow-hidden shadow-2xl"
                >
                   <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-rose-100/50">
                      <Trash2 size={40} />
                   </div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Delete Restaurant</h3>
                   <p className="text-slate-500 text-sm leading-relaxed mb-8 font-extrabold text-center px-2">
                      Are you sure you want to delete this restaurant?
                   </p>
                   <p className="text-slate-400 text-xs leading-relaxed mb-8">
                      This will permanently delete restaurant <span className="text-slate-950 font-black uppercase text-xs">{selectedRestaurant?.restaurantName}</span> and cascade remove all menus, orders, tables, settings, and linked operational modules.
                   </p>
                   
                   <div className="flex gap-4">
                      <button 
                        onClick={() => { setIsDeleting(false); setSelectedRestaurant(null); }}
                        className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all font-mono"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleDeleteConfirm}
                        disabled={loading}
                        className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-250 hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
                      >
                        {loading && <Loader2 className="animate-spin w-4 h-4" />}
                        Delete Permanently
                      </button>
                   </div>
                </motion.div>
             </motion.div>
          )}

          {/* View Details Modal */}
          {viewDetailsRestaurant && (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
             >
                <motion.div 
                   initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
                   className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100"
                >
                   <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                         <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Cluster Metadata</h3>
                         <p className="text-xs font-mono text-slate-400 uppercase leading-none mt-1">Identity Details</p>
                      </div>
                      <button 
                        onClick={() => setViewDetailsRestaurant(null)}
                        className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-150 text-slate-400 hover:text-slate-700"
                      >
                        <X size={18} />
                      </button>
                   </div>

                   <div className="p-8 space-y-6">
                      <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                         <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white overflow-hidden border border-slate-200">
                            {viewDetailsRestaurant.logo ? <img src={viewDetailsRestaurant.logo} alt="" className="w-full h-full object-cover" /> : <Utensils size={28} className="text-indigo-400" />}
                         </div>
                         <div>
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{viewDetailsRestaurant.restaurantName}</h4>
                            <p className="text-xs font-mono text-indigo-600 font-extrabold tracking-widest">{viewDetailsRestaurant.restaurantCode}</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-5 gap-x-6 text-sm">
                         <div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Status</span>
                            {(viewDetailsRestaurant.status === 'DISABLED' || (viewDetailsRestaurant.status === undefined && !viewDetailsRestaurant.active)) ? (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[8.5px] font-black uppercase tracking-widest inline-block">
                                 DISABLED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[8.5px] font-black uppercase tracking-widest inline-block">
                                 ACTIVE
                              </span>
                            )}
                         </div>

                         <div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Admin Owner</span>
                            <span className="font-bold text-slate-800">{viewDetailsRestaurant.ownerName || 'Cluster Owner'}</span>
                         </div>

                         <div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Owner Email</span>
                            <span className="text-xs font-bold text-slate-800 break-all">{viewDetailsRestaurant.ownerEmail}</span>
                         </div>

                         <div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Phone Number</span>
                            <span className="font-bold text-slate-800">{viewDetailsRestaurant.phone || 'N/A'}</span>
                         </div>

                         <div className="col-span-2">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Full Location Address</span>
                            <span className="font-bold text-slate-800 block text-xs leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                               {viewDetailsRestaurant.address || 'Address is empty'}, {viewDetailsRestaurant.city || 'N/A'}, {viewDetailsRestaurant.state || 'N/A'}
                            </span>
                         </div>

                         {viewDetailsRestaurant.status === 'DISABLED' && (
                            <div className="col-span-2 bg-rose-50 border border-rose-100 p-4 rounded-2xl text-xs space-y-2 text-rose-800">
                               <p className="font-black uppercase tracking-wider text-[10px]">Disabled Information</p>
                               <p className="font-bold leading-normal">
                                  Disabled At: <span className="font-mono">{viewDetailsRestaurant.disabledAt ? new Date(viewDetailsRestaurant.disabledAt).toLocaleString() : 'N/A'}</span>
                               </p>
                               <p className="font-bold leading-normal">
                                  Disabled By: <span className="font-black uppercase">{viewDetailsRestaurant.disabledBy || 'Super Owner'}</span>
                               </p>
                            </div>
                         )}
                      </div>
                   </div>

                   <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                      <button 
                        onClick={() => {
                          setViewDetailsRestaurant(null);
                          handleEdit(viewDetailsRestaurant);
                        }}
                        className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all font-mono"
                      >
                        Edit Cluster
                      </button>
                      <button 
                        onClick={() => setViewDetailsRestaurant(null)}
                        className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                      >
                        Done
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
