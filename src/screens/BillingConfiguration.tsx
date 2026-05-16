import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Save, 
  RotateCcw, 
  Store, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Hash, 
  MessageSquare, 
  Image as ImageIcon, 
  QrCode, 
  Check,
  ToggleLeft,
  ToggleRight,
  Printer,
  ChevronRight,
  Eye,
  Info,
  ShieldCheck
} from 'lucide-react';
import { useConfigStore } from '../stores/useConfigStore';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from 'sonner';

const BillingConfiguration = () => {
  const { profile } = useAuthStore();
  const { config, fetchConfig, saveConfig, resetToDefaults, loading } = useConfigStore();
  const [formData, setFormData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'display' | 'printer' | 'tax' | 'preview'>('details');

  useEffect(() => {
    if (profile?.restaurantId) {
      fetchConfig(profile.restaurantId);
    }
  }, [profile?.restaurantId]);

  useEffect(() => {
    if (config) {
      setFormData(config);
    } else if (!loading) {
      setFormData({
        restaurantId: profile?.restaurantId,
        restaurantName: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        gstNumber: '',
        fssaiNumber: '',
        footerMessage: 'Thank you for dining with us!',
        thankYouMessage: 'Please visit again!',
        logoUrl: '',
        qrCodeUrl: '',
        upiId: '',
        showLogo: true,
        showGst: true,
        showItemTax: false,
        showCaptainName: true,
        showTableName: true,
        showQrCode: false,
        showUpiQr: false,
        showCustomerCopy: true,
        showKitchenCopy: true,
        paperWidth: '80mm',
        fontSize: 'medium',
        margin: 0,
        autoCut: true,
        boldHeadings: true,
        gstPercentage: 5,
        isGstInclusive: true,
        serviceChargePercentage: 0,
        billNumberPrefix: '',
        billNumberPattern: 'YY-MM-XXXX',
      });
    }
  }, [config, loading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleToggle = (name: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    await saveConfig(formData);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to restore default settings?")) {
      if (profile?.restaurantId) {
        resetToDefaults(profile.restaurantId);
      }
    }
  };

  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
        activeTab === id 
        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
        : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100 italic font-black text-2xl">
            B
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Billing Configuration</h1>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-2 flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-500" /> Administrative Controls
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleReset}
            className="px-6 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-100 hover:text-indigo-600 transition-all flex items-center gap-2"
          >
            <RotateCcw size={14} /> Restore Defaults
          </button>
          <button 
            onClick={handleSubmit}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
          >
            <Save size={14} /> Save Configuration
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Settings Form */}
        <div className="flex-1 w-full bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          <div className="flex items-center overflow-x-auto no-scrollbar border-b border-slate-100 bg-slate-50/30">
            <TabButton id="details" label="Business Details" icon={Store} />
            <TabButton id="display" label="Receipt Content" icon={ToggleRight} />
            <TabButton id="printer" label="Printer Params" icon={Printer} />
            <TabButton id="tax" label="Taxes & Patterns" icon={Hash} />
          </div>

          <div className="p-8">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* ... same content ... */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-indigo-600 pl-3">Basic Information</h3>
                  
                  <div className="group relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Restaurant Name</label>
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <input 
                        type="text" 
                        name="restaurantName"
                        value={formData.restaurantName}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Ex: Golden Spoon Bistro"
                      />
                    </div>
                  </div>

                  <div className="group relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <textarea 
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm min-h-[100px]"
                        placeholder="Full street address, area, and city"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="group relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
                        <input 
                          type="text" 
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-11 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="group relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">GST Number</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
                        <input 
                          type="text" 
                          name="gstNumber"
                          value={formData.gstNumber}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-11 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="group relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">FSSAI Number</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <input 
                        type="text" 
                        name="fssaiNumber"
                        value={formData.fssaiNumber}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Ex: 12345678901234"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-indigo-600 pl-3">Contact & Links</h3>
                  
                  <div className="group relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <input 
                        type="email" 
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="group relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <input 
                        type="text" 
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="group relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Logo URL</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <input 
                        type="text" 
                        name="logoUrl"
                        value={formData.logoUrl}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Public HTTPS URL for restaurant logo"
                      />
                    </div>
                  </div>

                  <div className="group relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">UPI ID (For QR)</label>
                    <div className="relative">
                      <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <input 
                        type="text" 
                        name="upiId"
                        value={formData.upiId}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Ex: merchant@bankupi"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { key: 'showLogo', label: 'Display Logo', icon: ImageIcon },
                    { key: 'showGst', label: 'Show GST Details', icon: Hash },
                    { key: 'showItemTax', label: 'Show Item Wise Tax', icon: Info },
                    { key: 'showCaptainName', label: 'Show Captain Name', icon: Check },
                    { key: 'showTableName', label: 'Show Table Number', icon: Store },
                    { key: 'showQrCode', label: 'Show Menu QR', icon: QrCode },
                    { key: 'showUpiQr', label: 'Show UPI QR', icon: QrCode },
                    { key: 'showCustomerCopy', label: 'Print Customer Copy', icon: Printer },
                    { key: 'showKitchenCopy', label: 'Print Kitchen/Captain Copy', icon: Printer },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => handleToggle(item.key)}
                      className={`flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all ${
                        formData[item.key] 
                        ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${formData[item.key] ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                          <item.icon size={16} />
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-tight ${formData[item.key] ? 'text-indigo-900' : 'text-slate-500'}`}>
                          {item.label}
                        </span>
                      </div>
                      {formData[item.key] ? (
                        <div className="w-10 h-6 bg-indigo-600 rounded-full relative p-1 flex items-center justify-end transition-all">
                          <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                      ) : (
                        <div className="w-10 h-6 bg-slate-200 rounded-full relative p-1 flex items-center justify-start transition-all">
                          <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Footer Message</label>
                    <textarea 
                      name="footerMessage"
                      value={formData.footerMessage}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm min-h-[80px]"
                      placeholder="Ex: Price includes all taxes"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Thank You Statement</label>
                    <textarea 
                      name="thankYouMessage"
                      value={formData.thankYouMessage}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm min-h-[80px]"
                      placeholder="Ex: Hope to see you again soon!"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'printer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-indigo-600 pl-3 mb-6">Hardware & Scaling</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Paper Width</label>
                       <select 
                         name="paperWidth"
                         value={formData.paperWidth}
                         onChange={handleChange}
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                       >
                         <option value="58mm">58mm (2-inch)</option>
                         <option value="80mm">80mm (3-inch)</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Font Size</label>
                       <select 
                         name="fontSize"
                         value={formData.fontSize}
                         onChange={handleChange}
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                       >
                         <option value="small">Small</option>
                         <option value="medium">Medium</option>
                         <option value="large">Large</option>
                       </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Side Margin (mm)</label>
                       <input 
                         type="number" 
                         name="margin"
                         value={formData.margin}
                         onChange={handleChange}
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                       />
                    </div>
                    <div className="flex items-end gap-3 pb-2">
                       <button
                         onClick={() => handleToggle('autoCut')}
                         className={`flex-1 py-4 px-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                           formData.autoCut ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'
                         }`}
                       >
                         Auto Cut {formData.autoCut ? 'ON' : 'OFF'}
                       </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle('boldHeadings')}
                    className={`w-full py-5 px-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                      formData.boldHeadings ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'
                    }`}
                  >
                    {formData.boldHeadings ? <Check size={14} /> : null}
                    Bold & High Contrast Headings
                  </button>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
                   <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                         <Info size={18} className="text-white" />
                      </div>
                      <h4 className="text-xs font-black uppercase tracking-widest">Printer Pro Tip</h4>
                   </div>
                   <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
                     "Using <span className="text-white font-bold">80mm</span> allows for better tabulation of items. If using <span className="text-white font-bold">58mm</span>, try setting the font size to 'Small' to ensure long item names don't wrap and break the visual structure."
                   </p>
                   <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Selected Hardware</span>
                         <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{formData.paperWidth} Bluetooth/USB</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Scaling Factor</span>
                         <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{formData.fontSize.toUpperCase()}</span>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'tax' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-indigo-600 pl-3">Taxes & Charges</h3>
                    
                    <div className="group relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">GST Percentage (%)</label>
                      <input 
                        type="number" 
                        name="gstPercentage"
                        value={formData.gstPercentage}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Ex: 5"
                      />
                    </div>

                    <div className="group relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Service Charge (%)</label>
                      <input 
                        type="number" 
                        name="serviceChargePercentage"
                        value={formData.serviceChargePercentage}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Ex: 0"
                      />
                    </div>

                    <button
                      onClick={() => handleToggle('isGstInclusive')}
                      className={`w-full flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all ${
                        formData.isGstInclusive 
                        ? 'bg-emerald-50/50 border-emerald-200' 
                        : 'bg-indigo-50/50 border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                         <div className={`p-2.5 rounded-xl ${formData.isGstInclusive ? 'bg-emerald-600' : 'bg-indigo-600'} text-white`}>
                           <Check size={16} />
                         </div>
                         <div className="text-left">
                            <span className="text-[11px] font-black uppercase tracking-tight block">Tax Type</span>
                            <span className="text-[10px] font-bold text-slate-400">{formData.isGstInclusive ? 'Inclusive (Calculated in menu price)' : 'Exclusive (Added over subtotal)'}</span>
                         </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300" />
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-indigo-600 pl-3">Bill Numbering</h3>
                    
                    <div className="group relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Prefix (Shortcode)</label>
                      <input 
                        type="text" 
                        name="billNumberPrefix"
                        value={formData.billNumberPrefix}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Ex: RST - or B2B -"
                      />
                    </div>

                    <div className="group relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Structure Pattern</label>
                      <input 
                        type="text" 
                        name="billNumberPattern"
                        value={formData.billNumberPattern}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                        placeholder="Ex: YYMM-XXXX"
                      />
                      <p className="text-[9px] font-bold text-indigo-500 mt-2 px-1">Available tags: YY (Year), MM (Month), XXXX (Counter)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </div>
      </div>

      {/* Live Preview Sidebar */}
      <div className="w-full lg:w-[420px] lg:sticky lg:top-8 flex flex-col gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                <Eye size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest">Live Preview</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Real-time Print Simulation</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Active</span>
            </div>
          </div>

          <div className="flex justify-center py-6 bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10">
            <div className={`bg-white shadow-2xl p-8 transition-all duration-500 origin-top overflow-hidden rounded-sm ${formData.paperWidth === '58mm' ? 'w-[280px]' : 'w-[320px]'}`}>
              <div className="text-center space-y-2 mb-6">
                {formData.showLogo && (
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center border border-slate-100 mb-4 overflow-hidden shadow-inner">
                     {formData.logoUrl ? (
                       <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     ) : (
                       <ImageIcon size={20} className="text-slate-200" />
                     )}
                  </div>
                )}
                <h2 className={`font-black uppercase tracking-tight text-slate-900 leading-none ${formData.fontSize === 'large' ? 'text-lg' : formData.fontSize === 'small' ? 'text-sm' : 'text-base'}`}>
                  {formData.restaurantName || 'RESTAURANT NAME'}
                </h2>
                <p className="text-[8px] font-bold text-slate-400 leading-tight">
                  {formData.address || '123 Street Name, City, State - 000000'}
                </p>
                <p className="text-[8px] font-black text-slate-800">Ph: {formData.phone || '+91 00000 00000'}</p>
                {formData.showGst && formData.gstNumber && (
                  <p className="text-[7px] font-black text-slate-400">GST: {formData.gstNumber}</p>
                )}
              </div>

              <div className="border-y border-slate-900 border-dashed py-2 flex justify-between mb-4">
                <div className="text-[7px] font-black uppercase text-slate-400">
                   <p className="mb-0.5">Bill: {formData.billNumberPrefix || ''}26-0001</p>
                   <p>Date: 14 May 2026</p>
                </div>
                <div className="text-[7px] font-black uppercase text-slate-900 text-right">
                   {formData.showTableName && <p className="mb-0.5">Table: T-12</p>}
                   {formData.showCaptainName && <p>Captain: ADMIN</p>}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-[8px] font-black border-b border-slate-100 pb-1 uppercase tracking-widest text-slate-400">
                   <span>Item</span>
                   <div className="flex gap-4">
                      <span>Qty</span>
                      <span>Amt</span>
                   </div>
                </div>
                <div className="space-y-2">
                   <div className="flex justify-between text-[9px] font-black text-slate-800">
                      <span className="truncate max-w-[100px]">Classic Paneer Tikka</span>
                      <div className="flex gap-5">
                         <span>1</span>
                         <span>240</span>
                      </div>
                   </div>
                   <div className="flex justify-between text-[9px] font-black text-slate-800">
                      <span className="truncate max-w-[100px]">Butter Garlic Naan</span>
                      <div className="flex gap-5">
                         <span>2</span>
                         <span>120</span>
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-4 mb-4">
                <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                   <span>Subtotal</span>
                   <span>360.00</span>
                </div>
                {formData.showGst && (
                  <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                     <span>GST ({formData.gstPercentage}%)</span>
                     <span>18.00</span>
                  </div>
                )}
                {formData.serviceChargePercentage > 0 && (
                  <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                     <span>Service Charge</span>
                     <span>10.00</span>
                  </div>
                )}
                <div className="flex justify-between text-[12px] font-black text-slate-900 uppercase pt-2 border-t border-slate-900 border-dotted mt-2">
                   <span className="tracking-tighter">TOTAL</span>
                   <span className="text-sm">388.00</span>
                </div>
              </div>

              <div className="text-center space-y-3">
                {formData.showQrCode && (
                  <div className="w-16 h-16 border border-slate-100 mx-auto rounded-xl bg-slate-50 flex items-center justify-center p-2 shadow-inner">
                     <QrCode size={32} className="text-slate-800" strokeWidth={1.5} />
                  </div>
                )}
                
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-900 tracking-tight leading-tight">
                     {formData.footerMessage || 'Thank you for your visit'}
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">
                     {formData.thankYouMessage || 'RestoPro POS Enterprise'}
                  </p>
                </div>
                
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[6px] font-black uppercase tracking-[0.2em] text-slate-300">
                    Print Test Pass · Validated
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <Printer size={16} className="text-indigo-400" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Auto-Detect</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">Printer Status: Ready</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default BillingConfiguration;
