import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { 
  Shield, Check, X, Users, Loader2, 
  ShoppingBag, ClipboardList, Tag, HelpCircle, 
  Settings, Key, Layers, Calendar, FileText, CheckSquare, Search, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: 'Orders' | 'Tables & KOT' | 'Billing' | 'System';
}

const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Orders
  { key: 'createOrder', label: 'Create Order', description: 'Initiate and submit new orders for active tables', category: 'Orders' },
  { key: 'editRunningOrder', label: 'Edit Running Order', description: 'Reopen and modify items of currently active orders', category: 'Orders' },
  { key: 'addMoreItems', label: 'Add More Items', description: 'Append extra items/quantities to an active table session', category: 'Orders' },
  { key: 'removeItems', label: 'Remove Items', description: 'Delete or void line items from active order states', category: 'Orders' },
  { key: 'cancelOrder', label: 'Cancel Order', description: 'Completely cancel or void entire running orders', category: 'Orders' },

  // Tables & KOT
  { key: 'sendKOT', label: 'Send KOT', description: 'Transmit Kitchen Order Tickets directly to preparation lines', category: 'Tables & KOT' },
  { key: 'reprintKOT', label: 'Reprint KOT', description: 'Produce physical duplicates of printed KOTs', category: 'Tables & KOT' },
  { key: 'transferTable', label: 'Transfer Table', description: 'Shift all running order details from one table to another', category: 'Tables & KOT' },
  { key: 'mergeTable', label: 'Merge Table', description: 'Consolidate multiple table orders into a unified invoice', category: 'Tables & KOT' },
  { key: 'splitTable', label: 'Split Table', description: 'Divide products within a table into distinct subsets', category: 'Tables & KOT' },

  // Billing
  { key: 'generateBill', label: 'Generate Bill', description: 'Lock order modifications, post draft invoice and print bill', category: 'Billing' },
  { key: 'reprintBill', label: 'Reprint Bill', description: 'Re-trigger system printing of an already completed customer bill', category: 'Billing' },
  { key: 'settlePayment', label: 'Settle Payment', description: 'Collect, validate transaction modes and check out tables', category: 'Billing' },
  { key: 'voidBill', label: 'Void Bill', description: 'Un-generate, scrap tax prints or void unpaid active billing drafts', category: 'Billing' },
  { key: 'applyDiscount', label: 'Apply Discount', description: 'Override items/orders with custom subtotal percentage or flat drops', category: 'Billing' },

  // System
  { key: 'openDay', label: 'Open Day', description: 'Post opening balances and initialize terminal trading states', category: 'System' },
  { key: 'closeDay', label: 'Close Day', description: 'Tally registers and commit closing balance audits for daily shift', category: 'System' },
  { key: 'accessReports', label: 'Access Reports', description: 'Browse dashboard analytics, historic performance and cancellation metrics', category: 'System' },
  { key: 'editMenu', label: 'Edit Menu', description: 'Modify prices, create categories, and toggle stock availability', category: 'System' },
  { key: 'manageTables', label: 'Manage Tables', description: 'Add/configure table capacities, locations, and service alignments', category: 'System' },
];

const PermissionsTab = () => {
  const { profile } = useAuthStore();
  const [captains, setCaptains] = useState<any[]>([]);
  const [selectedCaptain, setSelectedCaptain] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch captains
  useEffect(() => {
    if (!profile?.restaurantId) return;

    const q = query(
      collection(db, 'users'),
      where('restaurantId', '==', profile.restaurantId),
      where('role', '==', 'captain')
    );

    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCaptains(docs);
      
      // Select first captain by default if none selected or old selected missing
      if (docs.length > 0) {
        setSelectedCaptain((prev: any) => {
          if (!prev) return docs[0];
          const found = docs.find(d => d.id === prev.id);
          return found || docs[0];
        });
      } else {
        setSelectedCaptain(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
  }, [profile?.restaurantId]);

  const handleTogglePermission = async (captainId: string, permissionKey: string, currentVal: boolean) => {
    try {
      await updateDoc(doc(db, 'users', captainId), {
        [`permissions.${permissionKey}`]: !currentVal
      });
      // Selected captain will automatically sync due to the parent snapshot subscription
      toast.success('Permission updated successfully');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to change permission');
    }
  };

  const handleToggleAllCategory = async (captainId: string, category: string, enable: boolean) => {
    try {
      const updateData: Record<string, boolean> = {};
      ALL_PERMISSIONS.forEach(perm => {
        if (perm.category === category) {
          updateData[`permissions.${perm.key}`] = enable;
        }
      });
      await updateDoc(doc(db, 'users', captainId), updateData);
      toast.success(`${enable ? 'Enabled' : 'Disabled'} all ${category} permissions`);
    } catch (e) {
      toast.error('Failed to update category permissions');
    }
  };

  const filteredCaptains = captains.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getEnabledCount = (cap: any) => {
    if (!cap?.permissions) return 0;
    return Object.values(cap.permissions).filter(Boolean).length;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Captain Profiles...</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Dynamic Permissions Matrix Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Captain List */}
        <div className="lg:col-span-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
          <div className="p-6 border-b border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Captains Directory</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Active Staff Accounts</p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 font-extrabold text-[10px] rounded-full uppercase">
                {captains.length} CAPTAINS
              </span>
            </div>

            {/* Quick Filter Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search staff keys or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-100 focus:bg-white transition-all text-ellipsis"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
            {filteredCaptains.map(captain => {
              const isSelected = selectedCaptain?.id === captain.id;
              const enabledCount = getEnabledCount(captain);
              return (
                <button
                  key={captain.id}
                  onClick={() => setSelectedCaptain(captain)}
                  className={`w-full text-left p-4 rounded-3xl flex items-center justify-between transition-all ${
                    isSelected 
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15 scale-[0.99]' 
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base ${
                      isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {captain.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-black text-sm tracking-tight leading-none mb-1">{captain.name}</h4>
                      <p className={`text-[10px] font-medium ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>{captain.email}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-xl font-bold text-[9px] uppercase tracking-wider ${
                      isSelected 
                        ? 'bg-white/10 text-emerald-400' 
                        : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {enabledCount} / 20 Set
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredCaptains.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-black uppercase text-[10px] tracking-widest italic col-span-full">
                No active captain matches
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Permission Grid */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCaptain ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
              
              {/* Header Details */}
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.25rem] flex items-center justify-center">
                    <Shield size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                      {selectedCaptain.name}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Permissions Configurer &middot; Role: Captain
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const updateData: Record<string, boolean> = {};
                        ALL_PERMISSIONS.forEach(p => updateData[`permissions.${p.key}`] = true);
                        await updateDoc(doc(db, 'users', selectedCaptain.id), updateData);
                        toast.success('Enabled all available console permissions');
                      } catch (e) {
                        toast.error('Failed to enable all');
                      }
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Grant All
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const updateData: Record<string, boolean> = {};
                        ALL_PERMISSIONS.forEach(p => updateData[`permissions.${p.key}`] = false);
                        await updateDoc(doc(db, 'users', selectedCaptain.id), updateData);
                        toast.success('Revoked all available privileges');
                      } catch (e) {
                        toast.error('Failed to revoke all');
                      }
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Revoke All
                  </button>
                </div>
              </div>

              {/* Toggles Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {['Orders', 'Tables & KOT', 'Billing', 'System'].map((cat) => {
                  const categoryPermissions = ALL_PERMISSIONS.filter(p => p.category === cat);
                  const allActive = categoryPermissions.every(p => selectedCaptain.permissions?.[p.key]);
                  
                  return (
                    <div key={cat} className="space-y-4">
                      {/* Section Title with quick category toggles */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Layers size={14} className="text-slate-400" />
                          {cat} Group
                        </span>
                        
                        <button
                          onClick={() => handleToggleAllCategory(selectedCaptain.id, cat, !allActive)}
                          className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                        >
                          {allActive ? 'Uncheck Group' : 'Check All Group'}
                        </button>
                      </div>

                      {/* Bento Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categoryPermissions.map(perm => {
                          const isEnabled = selectedCaptain.permissions?.[perm.key] ?? false;
                          return (
                            <button
                              key={perm.key}
                              onClick={() => handleTogglePermission(selectedCaptain.id, perm.key, isEnabled)}
                              className={`p-4 rounded-3xl border text-left flex items-start gap-3 transition-all ${
                                isEnabled 
                                  ? 'bg-indigo-50/40 border-indigo-100/60 shadow-sm' 
                                  : 'bg-white border-slate-50 hover:border-slate-100'
                              }`}
                            >
                              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center ${
                                isEnabled ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-transparent'
                              }`}>
                                <Check size={12} strokeWidth={4} />
                              </div>
                              <div className="flex-1 space-y-1">
                                <span className="font-extrabold text-xs text-slate-800">{perm.label}</span>
                                <p className="text-[10px] text-slate-400 font-medium leading-normal">{perm.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-12 text-center h-[25rem] flex flex-col items-center justify-center space-y-4">
              <Shield size={48} className="text-slate-300 animate-pulse" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">
                Select a captain profile from the left registry
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PermissionsTab;
