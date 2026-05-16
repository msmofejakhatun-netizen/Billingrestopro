import React, { useState } from 'react';
import { Settings, Printer, CreditCard, Utensils, IndianRupee, ShieldCheck, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRestaurantStore } from '../../stores/useRestaurantStore';
import { toast } from 'sonner';

const SettingsTab = ({ restaurant, initialSubTab = 'general' }: { restaurant: any, initialSubTab?: string }) => {
  const { updateRestaurant } = useRestaurantStore();
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    gstEnabled: restaurant?.gstEnabled ?? false,
    gstNumber: restaurant?.gstNumber || '',
    gstPercentage: restaurant?.gstPercentage || 18,
    serviceChargePercentage: restaurant?.serviceChargePercentage || 5,
    autoPrintKOT: true,
    autoPrintBill: false,
    billingCurrency: 'INR',
    footerMessage: restaurant?.footerMessage || 'Thank you for dining with us!',
    kotHeader: 'KITCHEN COPY',
    kotFooter: '---'
  });

  const handleUpdate = async () => {
     setLoading(true);
     try {
       await updateRestaurant(restaurant.id, settings);
       toast.success('Settings synchronized');
     } catch (e) {
       toast.error('Sync failed');
     } finally {
       setLoading(false);
     }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'taxes', label: 'Taxes', icon: IndianRupee },
    { id: 'printer', label: 'Printer', icon: Printer },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'kot', label: 'KOT Settings', icon: Utensils },
  ];

  const renderContent = () => {
    switch (activeSubTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Bill Footer Message</label>
              <textarea 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700 h-24"
                value={settings.footerMessage}
                onChange={e => setSettings({ ...settings, footerMessage: e.target.value })}
              />
            </div>
          </div>
        );
      case 'taxes':
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div>
                   <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">Enable GST System</h5>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toggle tax calculations on bills</p>
                </div>
                <button onClick={() => setSettings({ ...settings, gstEnabled: !settings.gstEnabled })} className="text-indigo-600">
                    {settings.gstEnabled ? <ToggleRight size={40} /> : <ToggleLeft size={40} className="text-slate-300" />}
                </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">GST Number</label>
                  <input 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-black text-indigo-600 font-mono"
                    value={settings.gstNumber}
                    disabled={!settings.gstEnabled}
                    onChange={e => setSettings({ ...settings, gstNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">GST Percentage (%)</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-black text-indigo-600"
                    value={settings.gstPercentage}
                    disabled={!settings.gstEnabled}
                    onChange={e => setSettings({ ...settings, gstPercentage: Number(e.target.value) })}
                  />
                </div>
            </div>
          </div>
        );
      case 'printer':
        return (
          <div className="space-y-6">
             <div className="p-8 bg-indigo-50 rounded-3xl border border-indigo-100 text-center">
                <Printer size={48} className="text-indigo-300 mx-auto mb-4" />
                <h5 className="text-lg font-black text-indigo-900 uppercase tracking-tight">Cloud Print Engine</h5>
                <p className="text-xs font-bold text-indigo-500 mt-2">Connect your thermal printers via IP or USB Relay</p>
                <button className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Search Printers</button>
             </div>
          </div>
        );
      case 'kot':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">KOT Header Text</label>
              <input 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 transition-all font-bold text-slate-700"
                value={settings.kotHeader}
                onChange={e => setSettings({ ...settings, kotHeader: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div>
                   <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">Auto-Print KOT on Punch</h5>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Send directly to kitchen printer</p>
                </div>
                <button onClick={() => setSettings({ ...settings, autoPrintKOT: !settings.autoPrintKOT })} className="text-indigo-600">
                    {settings.autoPrintKOT ? <ToggleRight size={40} /> : <ToggleLeft size={40} className="text-slate-300" />}
                </button>
            </div>
          </div>
        );
      default:
        return <div className="text-slate-400 italic">Advanced billing configuration coming soon.</div>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="lg:col-span-1 space-y-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-black text-[10px] uppercase tracking-widest ${
              activeSubTab === tab.id 
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 translate-x-2' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl min-h-[500px] flex flex-col">
        <div className="flex-1">
          {renderContent()}
        </div>
        
        <div className="pt-8 border-t border-slate-50 flex justify-between items-center">
           <div className="flex items-center gap-2 text-emerald-500">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Secure Cloud Settings</span>
           </div>
           <button 
              onClick={handleUpdate}
              disabled={loading}
              className="px-10 py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
           >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Update Parameters
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
