import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { Shield, ShieldAlert, CheckCircle, XCircle, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

const PermissionsTab = () => {
  const { profile } = useAuthStore();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.restaurantId) return;

    const q = query(
      collection(db, 'users'),
      where('restaurantId', '==', profile.restaurantId),
      where('role', '==', 'captain')
    );

    return onSnapshot(q, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
  }, [profile?.restaurantId]);

  const togglePermission = async (staffId: string, permission: string, currentVal: boolean) => {
    try {
      await updateDoc(doc(db, 'users', staffId), {
        [`permissions.${permission}`]: !currentVal
      });
      toast.success('Permission updated');
    } catch (e) {
      toast.error('Update failed');
    }
  };

  const permissionKeys = [
    { key: 'canBilling', label: 'Billing' },
    { key: 'canDiscount', label: 'Discount' },
    { key: 'canCancel', label: 'Cancel Order' },
    { key: 'canPrinter', label: 'Printer' },
    { key: 'canKOT', label: 'KOT Print' },
    { key: 'canCancelBill', label: 'Cancel Bill' },
    { key: 'canAnalytics', label: 'Analytics' }
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-slate-200" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
           <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Access Control Matrix</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure individual module privileges</p>
           </div>
           <ShieldAlert size={32} className="text-amber-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Captain Name</th>
                {permissionKeys.map(p => (
                  <th key={p.key} className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {staff.map(member => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                          <Users size={18} />
                       </div>
                       <div>
                         <p className="font-black text-slate-800 leading-none">{member.name}</p>
                         <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">{member.email}</p>
                       </div>
                    </div>
                  </td>
                  {permissionKeys.map(p => {
                    const hasAccess = member.permissions?.[p.key] ?? false;
                    return (
                      <td key={p.key} className="px-4 py-6">
                        <div className="flex justify-center">
                           <button 
                             onClick={() => togglePermission(member.id, p.key, hasAccess)}
                             className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                               hasAccess ? 'bg-emerald-50 text-emerald-600 shadow-lg shadow-emerald-100/50' : 'bg-slate-50 text-slate-300'
                             }`}
                           >
                             {hasAccess ? <CheckCircle size={20} /> : <XCircle size={20} />}
                           </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {staff.length === 0 && (
          <div className="p-20 text-center text-slate-400 italic font-bold uppercase text-xs tracking-widest bg-slate-50/30">
            No active staff records found in global registry
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionsTab;
