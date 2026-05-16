import React, { useState } from 'react';
import { useRestaurantStore } from '../../stores/useRestaurantStore';
import { Building2, Phone, MapPin, Hash, User, Camera, Save, Loader2, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';

const RestaurantProfile = ({ restaurant }: { restaurant: any }) => {
  const { updateRestaurant } = useRestaurantStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    restaurantName: restaurant?.restaurantName || '',
    address: restaurant?.address || '',
    city: restaurant?.city || '',
    state: restaurant?.state || '',
    phone: restaurant?.phone || '',
    gstNumber: restaurant?.gstNumber || '',
    logo: restaurant?.logo || '',
    ownerName: restaurant?.ownerName || '',
    gstEnabled: restaurant?.gstEnabled ?? false,
    gstPercentage: restaurant?.gstPercentage || 0,
    serviceChargePercentage: restaurant?.serviceChargePercentage || 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateRestaurant(restaurant.id, formData);
      toast.success('Restaurant details updated');
    } catch (error) {
      toast.error('Failed to update details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      <div className="p-8 border-b border-slate-50 bg-slate-50/30">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2rem] bg-white border-2 border-slate-100 shadow-lg flex items-center justify-center overflow-hidden">
              {formData.logo ? (
                <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={48} className="text-slate-200" />
              )}
            </div>
            <button 
                type="button"
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-all"
            >
              <Camera size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-2">
             <div className="flex items-center gap-3">
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{restaurant.restaurantName}</h3>
               <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">{restaurant.restaurantCode}</span>
             </div>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                <MapPin size={12} />
                {restaurant.city || 'Location Pending'}, {restaurant.state || 'India'}
             </p>
             <div className="flex gap-2 pt-2">
                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${restaurant.active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {restaurant.active ? 'Operational' : 'Paused'}
                </span>
             </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Basic Details */}
          <div className="space-y-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Basic Identity
            </h4>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Restaurant Business Name</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  value={formData.restaurantName}
                  onChange={e => setFormData({ ...formData, restaurantName: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Owner Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  value={formData.ownerName}
                  onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Contact Phone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700" 
                />
              </div>
            </div>
          </div>

          {/* Location & Tax */}
          <div className="space-y-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Location & Tax Info
            </h4>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Full Address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700" 
                  placeholder="Street, Area"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">City</label>
                <input 
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">State</label>
                <input 
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">GST Identification Number</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  value={formData.gstNumber}
                  onChange={e => setFormData({ ...formData, gstNumber: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-black text-indigo-600 font-mono" 
                  placeholder="27AAAAA0000A1Z5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* GST Settings Section in point 6 */}
        <div className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100 space-y-6">
           <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <IndianRupee size={16} className="text-indigo-600" />
                  Tax Configuration
              </h4>
              <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, gstEnabled: !formData.gstEnabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${formData.gstEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.gstEnabled ? 'left-7' : 'left-1'}`} />
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">GST Percentage</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Applied to all items</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            disabled={!formData.gstEnabled}
                            value={formData.gstPercentage}
                            onChange={e => setFormData({ ...formData, gstPercentage: Number(e.target.value) })}
                            className="w-16 p-2 bg-slate-50 rounded-lg text-center font-black text-indigo-600 outline-none border border-slate-100" 
                        />
                        <span className="text-sm font-black text-slate-400">%</span>
                    </div>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Service Charge</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Optional floor charge</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            value={formData.serviceChargePercentage}
                            onChange={e => setFormData({ ...formData, serviceChargePercentage: Number(e.target.value) })}
                            className="w-16 p-2 bg-slate-50 rounded-lg text-center font-black text-indigo-600 outline-none border border-slate-100" 
                        />
                        <span className="text-sm font-black text-slate-400">%</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit"
            disabled={loading}
            className="px-12 py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Synchronize Profile
          </button>
        </div>
      </form>
    </div>
  );
};

export default RestaurantProfile;
