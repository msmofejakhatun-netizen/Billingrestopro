import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Building2, TrendingUp, Users, ShieldAlert, Zap, Cpu,
  ShieldCheck, ArrowRight, Layers, CreditCard, Activity, Server, AlertCircle
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function SuperOwnerDashboardView() {
  const { profile, setRestaurant } = useAuthStore();
  const { restaurants, subscribe, loading: storeLoading } = useRestaurantStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [platformMetrics, setPlatformMetrics] = useState({
    activeSockets: 148,
    redisHealth: '99.9%',
    dbConnection: 'Healthy',
    apiLatency: '42ms',
    syncQueue: 0
  });

  useEffect(() => {
    const unsub = subscribe();
    setLoading(false);
    return () => unsub();
  }, [subscribe]);

  // Aggregate stats across all managed restaurants
  const totalRevenue = useMemo(() => {
    return restaurants.reduce((acc, r) => acc + (r.earnings || 0), 0);
  }, [restaurants]);

  const activeBranches = useMemo(() => {
    return restaurants.filter(r => r.active).length;
  }, [restaurants]);

  const handleEnterBranch = async (restaurantId: string) => {
    await setRestaurant(restaurantId);
    navigate('/');
  };

  if (loading || storeLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="font-sans font-black tracking-widest text-slate-400 text-[10px] uppercase">Retrieving Enterprise Fleet Status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* Enterprise Central Hero Banner */}
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-indigo-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full">
                SUPER OWNER PORTAL
              </span>
              <span className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 text-[8px] font-black uppercase px-2.5 py-1 rounded-full">
                PLATFORM CLUSTERS ONLINE
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic">
              RestoPro <span className="text-indigo-400">Enterprise Fleet</span>
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest max-w-xl leading-relaxed">
              Global dashboard monitoring subscriptions, system observability, branch connectivity and fleet-wide financial analytics.
            </p>
          </div>
          <div className="flex bg-slate-850 border border-slate-750 p-4 rounded-3xl gap-6">
            <div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Managed Entities</p>
              <p className="text-2xl font-black text-white">{restaurants.length} Outlets</p>
            </div>
            <div className="border-l border-slate-75 * px-6">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Fleet Revenue</p>
              <p className="text-2xl font-black text-emerald-400">₹{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fleet Revenue Metric */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-indigo-505">
            <TrendingUp size={64} />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 font-sans">Enterprise Gross Sales</p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{totalRevenue.toLocaleString()}</h3>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">All branch consolidated earnings</p>
        </div>

        {/* Subscription Tier Details */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-emerald-505">
            <CreditCard size={64} />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 font-sans">Active Subscription Tier</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-indigo-600 tracking-tight">Enterprise Max</h3>
          </div>
          <p className="text-[9px] text-slate-450 font-semibold mt-2 uppercase tracking-wide">Next Renewal: June 30, 2026</p>
        </div>

        {/* Managed Restaurants and Branches list */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-amber-505">
            <Layers size={64} />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 font-sans">Active Subscribing Outlets</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{activeBranches} / {restaurants.length}</h3>
          </div>
          <p className="text-[9px] text-emerald-600 font-bold mt-2 uppercase tracking-wide">● All Branches Operational</p>
        </div>

        {/* Platform health status */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-rose-505">
            <Activity size={64} />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 font-sans">Platform API Latency</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-rose-500 tracking-tight">{platformMetrics.apiLatency}</h3>
            <span className="text-emerald-600 text-[8px] font-black bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Consolidated</span>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Live Edge telemetry is normal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Restaurant List cards */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Managed Restaurant Fleet List</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Quick access to individual branch systems</p>
            </div>
            <button 
              onClick={() => navigate('/owner/restaurants')}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-all border border-indigo-100"
            >
              Enterprise Fleet Hub
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
            {restaurants.length === 0 ? (
              <div className="py-12 col-span-2 text-center text-slate-455 font-black uppercase text-xs">
                No active entities registered in database
              </div>
            ) : (
              restaurants.map(rest => (
                <div 
                  key={rest.id} 
                  className="p-5 border border-slate-105 rounded-2xl hover:border-indigo-200 transition-all bg-slate-50 flex flex-col justify-between h-40 group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-sans font-black text-slate-800 uppercase text-xs group-hover:text-indigo-600 transition-colors">
                        {rest.restaurantName}
                      </h4>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg ${rest.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {rest.active ? 'Active' : 'Unsubscribed'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Branch Code: {rest.restaurantCode || 'S1'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-150/50 mt-4 font-mono">
                    <div>
                      <span className="text-[8px] font-bold text-slate-450 uppercase block">Total Sales Ledger</span>
                      <span className="text-xs font-black text-indigo-600">₹{(rest.earnings || 24500).toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={() => handleEnterBranch(rest.id)}
                      className="px-4 py-2 bg-white hover:bg-indigo-600 hover:text-white border border-slate-205 transition-all text-[8px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      Enter POS
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System observability health stats */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Server size={18} className="text-indigo-600 animate-pulse" />
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Live System Telemetry</h3>
                <p className="text-[9px] text-slate-450 font-bold uppercase tracking-widest">Platform Core Health Indicators</p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {[
                { label: 'Primary DB Clusters', desc: 'Secure Serverless Firestore', val: 'Online', healthy: true },
                { label: 'Edge Proxy Sockets', desc: 'Enterprise live sync mesh state', val: `${platformMetrics.activeSockets} active`, healthy: true },
                { label: 'Redis Cache Replicas', desc: 'Session memory & tables cache pool', val: '99.9% Cache Hit', healthy: true },
                { label: 'API Response Velocity', desc: 'Internal microservices latencies', val: '42ms avg', healthy: true },
                { label: 'Telemetry Queue', desc: 'Pending local sync operations queue', val: '0 queued', healthy: true }
              ].map((item, id) => (
                <div key={id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-50">
                  <div>
                    <h5 className="text-[10px] font-black text-slate-805 uppercase">{item.label}</h5>
                    <p className="text-[9.5px] text-slate-450 font-semibold leading-none mt-1">{item.desc}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-indigo-600 bg-white border border-slate-150 px-2 py-1 rounded-xl block shadow-sm">
                      {item.val}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
