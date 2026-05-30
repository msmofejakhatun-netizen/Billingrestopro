import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, Search, Shield, Eye, Lock, ToggleLeft, ToggleRight, Trash2, 
  Settings, Key, School, Building2, UserCheck, UserX, AlertTriangle, 
  HelpCircle, Check, X, RefreshCw, BarChart3, Database, HardDrive, FileText, Activity
} from 'lucide-react';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { useAuthStore, UserProfile, UserRole } from '../stores/useAuthStore';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, where, limit, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface Owner {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  username?: string;
  role: string;
  assignedRestaurants: string[];
  assignedBranches: string[];
  permissions: {
    reports?: boolean;
    billing?: boolean;
    day_end?: boolean;
    staff_management?: boolean;
    menu?: boolean;
    printer_settings?: boolean;
    [key: string]: boolean | undefined;
  };
  status: 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
  active: boolean;
  createdBy: string;
  createdAt: string;
  lastLogin?: string | null;
  passwordPlain?: string; // stored plainly in Firestore model for convenience of Super Owner
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  userId: string;
  createdAt: string;
}

export default function OwnerManagement() {
  const { restaurants, subscribe: subscribeRestaurants } = useRestaurantStore();
  const { user, profile, setImpersonatedProfile } = useAuthStore();
  
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  
  // Audits log tracking State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedOwnerForLogs, setSelectedOwnerForLogs] = useState<Owner | null>(null);

  // Form Management States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [formFields, setFormFields] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    status: 'ACTIVE' as 'ACTIVE' | 'DISABLED' | 'SUSPENDED',
    assignedRestaurants: [] as string[],
    assignedBranches: [] as string[],
    permissions: {
      reports: true,
      billing: true,
      day_end: true,
      staff_management: true,
      menu: true,
      printer_settings: true,
    }
  });

  // Password Reset Dialog State
  const [resettingOwner, setResettingOwner] = useState<Owner | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Fetch audit logs related to owner administration
  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'auditLogs'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLog[];
      setAuditLogs(logs);
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Subscribe to restaurants list on screen load
  useEffect(() => {
    const unsubRestaurants = subscribeRestaurants();
    fetchAuditLogs();
    fetchOwnersList();
    return () => {
      unsubRestaurants();
    };
  }, []);

  const getAuthHeader = async () => {
    const token = await auth.currentUser?.getIdToken(true);
    return `Bearer ${token}`;
  };

  const fetchOwnersList = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', 'in', ['OWNER', 'owner']));
      const snap = await getDocs(q);
      const fbOwners = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Owner[];
      setOwners(fbOwners);
    } catch (fbErr: any) {
      console.error(fbErr);
      toast.error("Failed to load owner registry: " + fbErr.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (editingOwner) {
        // Edit flow - Direct DB write on client
        const uRef = doc(db, 'users', editingOwner.uid);
        await updateDoc(uRef, {
          name: formFields.name,
          phone: formFields.phone,
          mobile: formFields.phone,
          status: formFields.status,
          active: formFields.status === 'ACTIVE',
          assignedRestaurants: formFields.assignedRestaurants,
          assignedBranches: formFields.assignedBranches,
          permissions: formFields.permissions
        } as any);
        toast.success("Owner profile updated successfully!");
        setIsFormOpen(false);
        setEditingOwner(null);
        fetchOwnersList();
        fetchAuditLogs();
        return;
      }

      // Onboard flow (creating a new credential)
      if (!formFields.email || !formFields.password || !formFields.name) {
        toast.error("Name, Email, and Password are required fields.");
        return;
      }

      const uid = "owner_" + Math.floor(100000 + Math.random() * 900000);
      const passHash = btoa(formFields.password);

      const ownerData = {
        uid,
        name: formFields.name,
        email: formFields.email.toLowerCase(),
        phone: formFields.phone || "",
        mobile: formFields.phone || "",
        username: formFields.username || formFields.email.split("@")[0],
        passwordHash: passHash,
        passwordPlain: formFields.password,
        role: "OWNER",
        assignedRestaurants: formFields.assignedRestaurants || [],
        assignedBranches: formFields.assignedBranches || [],
        permissions: formFields.permissions || { reports: true, billing: true, day_end: true, staff_management: true, menu: true, printer_settings: true },
        status: formFields.status || "ACTIVE",
        active: (formFields.status || "ACTIVE") === "ACTIVE",
        createdBy: user?.uid || "SUPER_OWNER",
        createdAt: new Date().toISOString(),
        lastLogin: null
      };

      // Register user document in Firestore directly from the authenticated Super Owner client
      await setDoc(doc(db, 'users', uid), ownerData);

      // Add audit log too
      try {
        await setDoc(doc(collection(db, 'auditLogs'), `LOG-${Date.now()}`), {
          id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
          action: "CREATE_OWNER",
          details: `Created owner account: ${formFields.name} (${formFields.email})`,
          restaurantId: formFields.assignedRestaurants?.[0] || "ROOT",
          userId: user?.uid || "SUPER_OWNER",
          userName: "System Super Owner",
          createdAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn("Could not write audit log:", logErr);
      }

      toast.success("Owner registered successfully!");
      setIsFormOpen(false);
      setEditingOwner(null);
      fetchOwnersList();
      fetchAuditLogs();
    } catch (err: any) {
      console.error(err);
      toast.error("Process failed: " + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleOwnerStatus = async (owner: Owner) => {
    setActionLoading(true);
    const targetStatus = owner.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      const uRef = doc(db, 'users', owner.uid);
      await updateDoc(uRef, {
        status: targetStatus,
        active: targetStatus === 'ACTIVE',
        updatedAt: new Date().toISOString()
      });
      
      try {
        await setDoc(doc(collection(db, 'auditLogs'), `LOG-${Date.now()}`), {
          id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
          action: "TOGGLE_OWNER_STATUS",
          details: `Toggled owner status for ${owner.name} (${owner.email}) to ${targetStatus}`,
          restaurantId: owner.assignedRestaurants?.[0] || "ROOT",
          userId: user?.uid || "SUPER_OWNER",
          userName: "System Super Owner",
          createdAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn("Could not write audit log:", logErr);
      }

      toast.success(`Owner ${targetStatus === 'ACTIVE' ? 'activated' : 'disabled'} successfully!`);
      fetchOwnersList();
      fetchAuditLogs();
    } catch (err: any) {
      toast.error("Status toggle update failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingOwner) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/owners/${resettingOwner.uid}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': await getAuthHeader(),
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success("Password reset initiated successfully!");
      setResettingOwner(null);
      
      // Optionally show the password
      alert(`Password reset successfully. The new temporary password is: ${data.tempPassword}. This password has also been emailed to the owner.`);
      
      fetchOwnersList();
      fetchAuditLogs();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to commit password change: " + err.message);
    } finally {
      setActionLoading(false);
      setNewPassword('');
    }
  };

  const handleImpersonate = (owner: Owner) => {
    const impersonatedProfile: UserProfile = {
      uid: owner.uid,
      name: owner.name,
      email: owner.email,
      role: owner.role as UserRole,
      restaurantId: owner.assignedRestaurants?.[0],
      active: owner.active,
      permissions: owner.permissions as Record<string, boolean>
    };
    setImpersonatedProfile(impersonatedProfile);
    toast.success(`Now impersonating ${owner.name}.`);
  };

  const handleDeleteOwner = async (owner: Owner) => {
    if (!confirm(`Are you absolutely sure you want to permanently delete Owner "${owner.name}"? This action is irreversible.`)) {
      return;
    }
    setActionLoading(true);
    try {
      // Direct Doc purge on client-side Firestore
      await deleteDoc(doc(db, 'users', owner.uid));

      try {
        await setDoc(doc(collection(db, 'auditLogs'), `LOG-${Date.now()}`), {
          id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
          action: "DELETE_OWNER",
          details: `Permanently purged owner database record: ${owner.name} (${owner.email})`,
          restaurantId: owner.assignedRestaurants?.[0] || "ROOT",
          userId: user?.uid || "SUPER_OWNER",
          userName: "System Super Owner",
          createdAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn("Could not write audit log:", logErr);
      }

      toast.success("Owner purged permanently.");
      fetchOwnersList();
      fetchAuditLogs();
    } catch (err: any) {
      toast.error("Deletion failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingOwner(null);
    setFormFields({
      name: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      status: 'ACTIVE',
      assignedRestaurants: [],
      assignedBranches: ['Main Branch'],
      permissions: {
        reports: true,
        billing: true,
        day_end: true,
        staff_management: true,
        menu: true,
        printer_settings: true,
      }
    });
    setIsFormOpen(true);
  };

  const openEditForm = (owner: Owner) => {
    setEditingOwner(owner);
    setFormFields({
      name: owner.name,
      email: owner.email,
      phone: owner.phone || owner.mobile || '',
      username: owner.username || '',
      password: '', // Hidden in edits
      status: owner.status || 'ACTIVE',
      assignedRestaurants: owner.assignedRestaurants || [],
      assignedBranches: owner.assignedBranches || ['Main Branch'],
      permissions: {
        reports: owner.permissions?.reports !== false,
        billing: owner.permissions?.billing !== false,
        day_end: owner.permissions?.day_end !== false,
        staff_management: owner.permissions?.staff_management !== false,
        menu: owner.permissions?.menu !== false,
        printer_settings: owner.permissions?.printer_settings !== false,
      }
    });
    setIsFormOpen(true);
  };

  // Compute stats metrics dynamically
  const metrics = useMemo(() => {
    const totalCount = owners.length;
    const activeCount = owners.filter(o => o.status === 'ACTIVE').length;
    const disabledCount = owners.filter(o => o.status !== 'ACTIVE').length;
    
    // Sum earnings of all restaurants assigned to each owner
    let combinedOwnerRevenue = 0;
    restaurants.forEach(rest => {
      combinedOwnerRevenue += rest.earnings || 0;
    });

    return { totalCount, activeCount, disabledCount, combinedOwnerRevenue };
  }, [owners, restaurants]);

  // Filter lists based on search keys and active tab
  const filteredOwners = useMemo(() => {
    return owners.filter(owner => {
      const matchesSearch = 
        owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        owner.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (owner.phone || '').includes(searchQuery);
      
      if (!matchesSearch) return false;
      
      if (activeTab === 'ACTIVE') return owner.status === 'ACTIVE';
      if (activeTab === 'DISABLED') return owner.status !== 'ACTIVE';
      return true;
    });
  }, [owners, searchQuery, activeTab]);

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header section with negative spacing and sleek contrast */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-900">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
                Owner Administration
              </h1>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mt-0.5">
                Enterprise SaaS Access & Permission Center
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={fetchOwnersList}
            className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center"
            title="Refresh Registry"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button 
            onClick={openAddForm}
            className="flex-1 md:flex-none py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-950/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Onboard Owner
          </button>
        </div>
      </div>

      {/* Metric Cards block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-[2rem] relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Global Portfolio Value</p>
          <h2 className="text-3xl font-black text-emerald-400 mt-2">₹{metrics.combinedOwnerRevenue.toLocaleString('en-IN')}</h2>
          <div className="flex items-center gap-1.5 mt-3 text-slate-400 text-xs font-medium">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            Active revenue streams
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-[2rem] relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl" />
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Active Signups</p>
          <h2 className="text-3xl font-black text-white mt-2">{metrics.activeCount} <span className="text-slate-500 text-base font-normal">Registered</span></h2>
          <div className="flex items-center gap-1.5 mt-3 text-slate-400 text-xs font-medium">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
            Authentications validated
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-[2rem] relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl" />
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Suspended Accounts</p>
          <h2 className="text-3xl font-black text-rose-500 mt-2">{metrics.disabledCount} <span className="text-slate-500 text-base font-normal">Locked</span></h2>
          <div className="flex items-center gap-1.5 mt-3 text-slate-400 text-xs font-medium">
            <UserX className="w-3.5 h-3.5 text-rose-500" />
            API & App privileges revoked
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-[2rem] relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Affiliated Outlets</p>
          <h2 className="text-3xl font-black text-white mt-2">{restaurants.length} <span className="text-slate-500 text-base font-normal">Managed</span></h2>
          <div className="flex items-center gap-1.5 mt-3 text-slate-400 text-xs font-medium">
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
            Assigned pos units
          </div>
        </div>
      </div>

      {/* Main Panel layout splits: registry left, log trail right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Registry left */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-6 space-y-6">
            
            {/* Filter and search bars */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                {(['ALL', 'ACTIVE', 'DISABLED'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeTab === tab 
                        ? "bg-slate-900 text-white border border-slate-800" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filter owners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 pl-11 pr-4 py-3 border border-slate-800 rounded-2xl text-slate-100 font-bold text-xs focus:border-indigo-500 outline-none transition-all placeholder-slate-600"
                />
              </div>
            </div>

            {/* Registry table list */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">Retrieving Owner Database...</p>
              </div>
            ) : filteredOwners.length === 0 ? (
              <div className="text-center py-20 bg-slate-950/20 rounded-3xl border border-dashed border-slate-900">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white text-base font-bold">No Owners Registered</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">There are no third-party Owner accounts fitting your filter specifications at this junction.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-[10px] font-mono uppercase text-slate-400 tracking-widest text-left">
                      <th className="pb-4 font-black">Identity</th>
                      <th className="pb-4 font-black">Contacts</th>
                      <th className="pb-4 font-black text-center">Affiliates</th>
                      <th className="pb-4 font-black text-center">Status</th>
                      <th className="pb-4 font-black text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {filteredOwners.map(owner => {
                      const assignedNames = owner.assignedRestaurants?.map(id => {
                        const match = restaurants.find(r => r.id === id);
                        return match ? match.restaurantName : id;
                      }) || [];

                      return (
                        <tr key={owner.uid || owner.id} className="group hover:bg-slate-900/10 transition-colors">
                          <td className="py-4 pr-3">
                            <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors text-sm">{owner.name}</h4>
                            <p className="text-slate-500 text-xs font-semibold">{owner.email}</p>
                            {owner.username && (
                              <span className="inline-block mt-1 text-[9px] font-mono px-2 py-0.5 bg-slate-900 text-slate-400 rounded-md border border-slate-800">
                                @{owner.username}
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-xs font-medium text-slate-300">
                            <span className="font-mono">{owner.phone || owner.mobile || '—'}</span>
                          </td>
                          <td className="py-4 text-center">
                            <div className="inline-flex items-center justify-center px-3 py-1 bg-indigo-950/20 text-indigo-400 border border-indigo-900/30 rounded-xl text-[10px] font-black uppercase tracking-wider">
                              {owner.assignedRestaurants?.length || 0} Outlets
                            </div>
                            {assignedNames.length > 0 && (
                              <p className="text-[10px] text-slate-500 mt-1 max-w-[150px] truncate mx-auto" title={assignedNames.join(', ')}>
                                {assignedNames.join(', ')}
                              </p>
                            )}
                          </td>
                          <td className="py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                              owner.status === 'ACTIVE' 
                                ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/20" 
                                : "bg-rose-950/30 text-rose-400 border-rose-500/20"
                            }`}>
                              {owner.status}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              
                              <button
                                onClick={() => handleToggleOwnerStatus(owner)}
                                className={`p-2.5 rounded-xl border transition-all ${
                                  owner.status === 'ACTIVE'
                                    ? "bg-rose-950/20 border-rose-900/30 text-rose-400 hover:bg-rose-900/20"
                                    : "bg-emerald-950/20 border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/20"
                                }`}
                                title={owner.status === 'ACTIVE' ? "Revoke Login & Access" : "Grant Login & Access"}
                              >
                                {owner.status === 'ACTIVE' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => handleImpersonate(owner)}
                                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                                title="Impersonate Owner"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedOwnerForLogs(owner);
                                }}
                                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                                title="Audit User Activities"
                              >
                                <Activity className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  setResettingOwner(owner);
                                }}
                                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                                title="Reset Key Password"
                              >
                                <Lock className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => openEditForm(owner)}
                                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                                title="Edit Settings"
                              >
                                <Settings className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteOwner(owner)}
                                className="p-2.5 bg-slate-950 hover:bg-red-950/30 border border-slate-800 hover:border-red-900/30 rounded-xl text-slate-500 hover:text-red-400 transition-all"
                                title="Purge Owner Permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Audit Log panel right */}
        <div className="space-y-6">
          <div className="bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-900">
              <div>
                <h3 className="text-base font-black text-white">Auditing Trail</h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">Real-time owner activities log</p>
              </div>
              <button 
                onClick={fetchAuditLogs}
                className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">No recent administrator activity logs recorded.</p>
            ) : (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-900 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] px-2 py-0.5 bg-indigo-950/30 text-indigo-400 border border-indigo-900/30 rounded font-mono uppercase font-black">
                        {log.action}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <p className="text-slate-300 font-semibold text-xs leading-relaxed">{log.details}</p>
                    <p className="text-[10px] font-mono text-slate-600">ID: {log.id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Lookup Dialog Modal */}
      <AnimatePresence>
        {selectedOwnerForLogs && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setSelectedOwnerForLogs(null)}
                className="absolute top-6 right-6 p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <h3 className="text-lg font-black text-white">Activity History</h3>
                <p className="text-xs text-slate-400 font-bold">Auditing records matching &ldquo;{selectedOwnerForLogs.name}&rdquo;</p>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {auditLogs.filter(log => log.userId === selectedOwnerForLogs.uid).length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-10 font-bold uppercase tracking-wider">No specific logs found for this owner</p>
                ) : (
                  auditLogs.filter(log => log.userId === selectedOwnerForLogs.uid).map(log => (
                    <div key={log.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9.5px] px-2 py-0.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded font-mono uppercase font-black">
                          {log.action}
                        </span>
                        <span className="text-[9.5px] text-slate-500 font-mono">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-slate-300 font-bold text-xs leading-relaxed">{log.details}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PASSWORD RESET DIALOG MODAL */}
      <AnimatePresence>
        {resettingOwner && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setResettingOwner(null)}
                className="absolute top-6 right-6 p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Reset Credentials</h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">Authorizing key update</p>
                </div>
              </div>

              <p className="text-slate-300 text-xs font-semibold">
                You are about to issue a manual backend security reset code for the Owner account of <strong className="text-white">{resettingOwner.name}</strong>. A new temporary password will be generated and emailed to the owner.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResettingOwner(null)}
                    className="flex-1 py-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-950/20 flex items-center justify-center gap-2 h-[48px]"
                  >
                    {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Confirm Reset
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATION OR EDITION DRAWER DIALOG MODAL */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative my-8"
            >
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingOwner(null);
                }}
                className="absolute top-6 right-6 p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {editingOwner ? "Modify Owner Configuration" : "Establish Owner Profile"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                    {editingOwner ? "editing registered key indices" : "onboarding external subscriber"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateOrUpdateOwner} className="space-y-6">
                
                {/* Visual grid fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={formFields.name}
                      onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
                      className="w-full bg-slate-950 p-4 border border-slate-800 rounded-2xl text-white font-bold text-xs focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Email Address (Unique Login)</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingOwner}
                      placeholder="john@restaurant-group.com"
                      value={formFields.email}
                      onChange={(e) => setFormFields({ ...formFields, email: e.target.value })}
                      className="w-full bg-slate-950 p-4 border border-slate-800 rounded-2xl text-white font-bold text-xs focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="+919876543210"
                      value={formFields.phone}
                      onChange={(e) => setFormFields({ ...formFields, phone: e.target.value })}
                      className="w-full bg-slate-950 p-4 border border-slate-800 rounded-2xl text-white font-bold text-xs focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Access Username</label>
                    <input
                      type="text"
                      placeholder="johndoe_group"
                      value={formFields.username}
                      onChange={(e) => setFormFields({ ...formFields, username: e.target.value })}
                      className="w-full bg-slate-950 p-4 border border-slate-800 rounded-2xl text-white font-bold text-xs focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  {!editingOwner && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Password Key</label>
                      <input
                        type="password"
                        required
                        placeholder="Establish robust security password (6+ characters)"
                        value={formFields.password}
                        onChange={(e) => setFormFields({ ...formFields, password: e.target.value })}
                        className="w-full bg-slate-950 p-4 border border-slate-800 rounded-2xl text-white font-bold text-xs focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Assigned Outlets block */}
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">Associate Restaurant Outlets</label>
                  <p className="text-[10px] text-slate-500 -mt-1 font-semibold">Select the particular cluster nodes this Owner has authority to command:</p>
                  
                  {restaurants.length === 0 ? (
                    <div className="p-4 bg-slate-955 rounded-2xl border border-slate-800 text-center text-xs text-slate-500 font-bold">
                      No active Outlet Cluster registered. Please build restaurants first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[150px] overflow-y-auto p-1 bg-slate-950 rounded-2xl border border-slate-800">
                      {restaurants.map(rest => {
                        const checked = formFields.assignedRestaurants.includes(rest.id);
                        return (
                          <label 
                            key={rest.id} 
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              checked 
                                ? "bg-indigo-950/20 border-indigo-500/30 text-white" 
                                : "bg-slate-900/10 border-slate-900 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              className="accent-indigo-600 w-4 h-4 rounded"
                              onChange={(e) => {
                                let updated = [...formFields.assignedRestaurants];
                                if (e.target.checked) updated.push(rest.id);
                                else updated = updated.filter(id => id !== rest.id);
                                setFormFields({ ...formFields, assignedRestaurants: updated });
                              }}
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold leading-none">{rest.restaurantName}</p>
                              <p className="text-[9px] font-mono text-slate-500 leading-none mt-1">Code: {rest.restaurantCode}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Permissions Workshop */}
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">Owner Control Permissions</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    {[
                      { key: 'reports', label: 'Access Reports' },
                      { key: 'billing', label: 'Modify Billing' },
                      { key: 'day_end', label: 'Trigger Day-End' },
                      { key: 'staff_management', label: 'Admin Staff HR' },
                      { key: 'menu', label: 'Curate Menu Card' },
                      { key: 'printer_settings', label: 'Printer Terminals' },
                    ].map(perm => {
                      const value = formFields.permissions[perm.key as keyof typeof formFields.permissions] !== false;
                      return (
                        <label 
                          key={perm.key} 
                          className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-slate-900 text-xs font-bold ${
                            value ? "text-indigo-400" : "text-slate-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={value}
                            className="accent-indigo-600 rounded"
                            onChange={(e) => {
                              const updatedPerms = { 
                                ...formFields.permissions,
                                [perm.key]: e.target.checked
                              };
                              setFormFields({ ...formFields, permissions: updatedPerms });
                            }}
                          />
                          <span>{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Submit actions */}
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingOwner(null);
                    }}
                    className="flex-1 py-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-950/20 flex items-center justify-center gap-2 h-[48px]"
                  >
                    {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {editingOwner ? "Apply Changes" : "Confirm Onboarding"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
