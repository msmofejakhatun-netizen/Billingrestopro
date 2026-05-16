import React, { useState } from 'react';
import { useRestaurantStore } from '../../stores/useRestaurantStore';
import { IndianRupee, Save, Hash, Percent, FileText, ToggleLeft, ToggleRight, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const TaxationTab = ({ restaurant }: { restaurant: any }) => {
  const { updateRestaurant } = useRestaurantStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    gstEnabled: restaurant?.gstEnabled ?? false,
    gstNumber: restaurant?.gstNumber || '',
    gstPercentage: restaurant?.gstPercentage || 5,
    serviceChargePercentage: restaurant?.serviceChargePercentage || 0,
    footerMessage: restaurant?.footerMessage || 'Thank you for dining with us!'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateRestaurant(restaurant.id, formData);
      toast.success('Tax parameters synchronized');
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-10 bg-slate-50/50 border-b border-slate-100">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Billing & Taxation</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Regulate tax logic and receipt aesthetics</p>
              </div>
              <button 
                onClick={() => setFormData({ ...formData, gstEnabled: !formData.gstEnabled })}
                className="transition-all hover:scale-110 active:scale-95"
              >
                {formData.gstEnabled ? <ToggleRight size={56} className="text-indigo-600" /> : <ToggleLeft size={56} className="text-slate-300" />}
              </button>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">GST Identification Number</label>
                  <div className="relative">
                    <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      disabled={!formData.gstEnabled}
                      value={formData.gstNumber}
                      onChange={e => setFormData({ ...formData, gstNumber: e.target.value })}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-black text-indigo-600 font-mono disabled:opacity-40"
                      placeholder="27AAAAA0000A1Z5"
                    />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">GST Rate (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="number"
                        disabled={!formData.gstEnabled}
                        value={formData.gstPercentage}
                        onChange={e => setFormData({ ...formData, gstPercentage: Number(e.target.value) })}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-black text-slate-700 disabled:opacity-40"
                      />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Service Charge (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="number"
                        value={formData.serviceChargePercentage}
                        onChange={e => setFormData({ ...formData, serviceChargePercentage: Number(e.target.value) })}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-black text-slate-700"
                      />
                    </div>
                 </div>
               </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Receipt Footer Disclaimer</label>
                  <div className="relative">
                    <FileText className="absolute left-5 top-6 text-slate-300" size={18} />
                    <textarea 
                      value={formData.footerMessage}
                      onChange={e => setFormData({ ...formData, footerMessage: e.target.value })}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700 h-40 resize-none"
                    />
                  </div>
               </div>
            </div>
          </div>

          <div className="pt-10 border-t border-slate-50 flex items-center justify-between">
             <div className="flex items-center gap-3 text-emerald-500">
               <ShieldCheck size={20} />
               <span className="text-[10px] font-black uppercase tracking-widest leading-none">Compliant Billing Engine Active</span>
             </div>
             <button 
                type="submit"
                disabled={loading}
                className="px-12 py-5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
             >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Lock Parameters
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaxationTab;
