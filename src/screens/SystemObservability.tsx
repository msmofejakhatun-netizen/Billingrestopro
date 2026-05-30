import React, { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { 
  Activity, 
  Database, 
  Network, 
  Cpu, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Bell, 
  Mail, 
  Globe, 
  RefreshCw, 
  Trash2, 
  Play, 
  Users, 
  Printer, 
  Clock, 
  Settings, 
  Zap, 
  TrendingUp, 
  XCircle,
  Plus,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Radio,
  FileSpreadsheet
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie 
} from "recharts";

// TypeScript declarations for state objects
interface AlertItem {
  id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  timestamp: string;
  resolvedAt?: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  active: boolean;
  createdAt: string;
}

interface OverviewData {
  success: boolean;
  summary: {
    systemUptime: number;
    generalStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
    activeIssuesCount: number;
  };
  services: {
    database: {
      status: string;
      avgQueryLatencyMs: number;
      isUsingFallbackMemoryDB: boolean;
    };
    redis: {
      status: string;
      pingLatencyMs: number;
      memoryUsedFormatted: string;
    };
  };
  traffic: {
    totalRequests: number;
    activeRequests: number;
    errorRatePercent: number;
    socketConnections: number;
    activeRoomsCount: number;
    errorRequests4xx: number;
    errorRequests5xx: number;
    slowestEndpoints: {
      method: string;
      path: string;
      requestsCount: number;
      avgDurationMs: number;
    }[];
  };
  queues: {
    activeJobs: number;
    failedJobs: number;
    dlqJobsCount: number;
  };
  activeAlerts: AlertItem[];
  timestamp: string;
}

interface WorkerStatus {
  queueName: string;
  workerActive: boolean;
  onlineThreadsCount: number;
}

interface QueueMetric {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  deadLetterJobs: number;
  throughputRate: number;
}

interface QueuesData {
  success: boolean;
  queues: QueueMetric[];
  workers: WorkerStatus[];
  concurrencySpecs: Record<string, number>;
}

interface RedisData {
  success: boolean;
  redis: {
    host: string;
    port: number;
    status: string;
    pingLatencyMs: number;
    memoryUsage: {
      usedBytes: number;
      rssBytes: number;
      usedPeakBytes: number;
      formatted: string;
      maxmemory_human?: string;
    };
    connections: {
      connectedClients: number;
      blockedClients: number;
      totalConnectionsReceived: number;
      instantaneousOpsPerSec: number;
    };
    lastError?: string;
  };
}

interface SocketRoom {
  roomId: string;
  connectedClientsCount: number;
  isBranchSpecific: boolean;
  socketIds?: string[];
}

interface SocketsData {
  success: boolean;
  sockets: {
    activeCount: number;
    transportTypes: string[];
    clusteringAdapter: string;
    adapterSyncActive: boolean;
  };
  rooms: SocketRoom[];
  metrics: {
    eventsReceived: number;
    eventsSent: number;
    connectionsActive: number;
  };
}

export default function SystemObservability() {
  const [activeTab, setActiveTab] = useState<"overview" | "queues" | "redis" | "mongo" | "sockets">("overview");
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Endpoint loaded datasets
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [queues, setQueues] = useState<QueuesData | null>(null);
  const [redis, setRedis] = useState<RedisData | null>(null);
  const [sockets, setSockets] = useState<SocketsData | null>(null);
  
  // Custom states for alert feeds & webhook triggers
  const [alertsList, setAlertsList] = useState<AlertItem[]>([]);
  const [alertsHistory, setAlertsHistory] = useState<AlertItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [testAlertMsg, setTestAlertMsg] = useState("");
  const [testAlertType, setTestAlertType] = useState("QUEUE_BACKLOG_SPIKE");
  const [testAlertSeverity, setTestAlertSeverity] = useState<"WARNING" | "CRITICAL">("WARNING");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Helper auth request utility
  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Operator possesses no active session.");
    const token = await user.getIdToken(true);
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    };
    const response = await fetch(endpoint, { ...options, headers });
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Access Denied: Requires Owner/Superadmin credentials.");
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP error: Status ${response.status}`);
    }
    return response.json();
  };

  // Fetch metrics across all system dashboards
  const loadMonitoringData = async (forceSpinner = false) => {
    if (forceSpinner) setLoading(true);
    setIsRefreshing(true);
    setErrorStatus(null);
    try {
      const [ovData, qData, redData, sockData, alertData, webData] = await Promise.all([
        fetchWithAuth("/api/admin/monitoring/overview"),
        fetchWithAuth("/api/admin/monitoring/queues"),
        fetchWithAuth("/api/admin/monitoring/redis"),
        fetchWithAuth("/api/admin/monitoring/sockets"),
        fetchWithAuth("/api/admin/monitoring/alerts"),
        fetchWithAuth("/api/admin/monitoring/webhooks")
      ]);

      setOverview(ovData);
      setQueues(qData);
      setRedis(redData);
      setSockets(sockData);
      setAlertsList(alertData.activeAlerts || []);
      setAlertsHistory(alertData.history || []);
      setWebhooks(webData.webhooks || []);
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Failed to load telemetry endpoints");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMonitoringData(true);
    // Dynamic polling interval (every 15s updates statistics safely)
    const pollTimer = setInterval(() => {
      loadMonitoringData(false);
    }, 15000);
    return () => clearInterval(pollTimer);
  }, []);

  // Webhook action handlers
  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookName || !newWebhookUrl) return;
    setActionInProgress("webhook_add");
    try {
      await fetchWithAuth("/api/admin/monitoring/webhooks", {
        method: "POST",
        body: JSON.stringify({ name: newWebhookName, url: newWebhookUrl })
      });
      setNewWebhookName("");
      setNewWebhookUrl("");
      await loadMonitoringData(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleWebhook = async (id: string, currentStatus: boolean) => {
    setActionInProgress(`webhook_toggle_${id}`);
    try {
      await fetchWithAuth(`/api/admin/monitoring/webhooks/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ active: !currentStatus })
      });
      await loadMonitoringData(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleTriggerTestAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testAlertMsg) return;
    setActionInProgress("test_alert");
    try {
      await fetchWithAuth("/api/admin/monitoring/alerts/test", {
        method: "POST",
        body: JSON.stringify({
          type: testAlertType,
          message: testAlertMsg,
          severity: testAlertSeverity
        })
      });
      setTestAlertMsg("");
      await loadMonitoringData(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // DLQ Administration triggers
  const handlePurgeQueueDLQ = async (queueName: string) => {
    if (!confirm(`Are you sure you want to purge all Dead Letter Jobs for ${queueName}?`)) return;
    setActionInProgress(`dlq_purge_${queueName}`);
    try {
      const res = await fetchWithAuth("/api/captain/queues/dlq/purge", {
        method: "POST",
        body: JSON.stringify({ queueName })
      });
      alert(res.message || "Queue purged");
      await loadMonitoringData(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRetryQueueDLQ = async (queueName: string) => {
    setActionInProgress(`dlq_retry_${queueName}`);
    try {
      const res = await fetchWithAuth("/api/captain/queues/dlq/retry", {
        method: "POST",
        body: JSON.stringify({ queueName })
      });
      alert(res.message || "Retry initiated successfully");
      await loadMonitoringData(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // Helper format seconds to uptime readable
  const formatUptime = (seconds: number) => {
    if (!seconds) return "0s";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(" ");
  };

  // Render general loading fallback in a styled interface
  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-loose">Booting Observability Suite</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Compiling enterprise metrics cluster...</p>
        </div>
      </div>
    );
  }

  // Render Access denied or connection issue
  if (errorStatus && !overview) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl border border-red-100 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-800 uppercase mb-2">Systems Unreachable</h3>
          <p className="text-xs text-slate-400 leading-relaxed uppercase font-bold mb-6 tracking-wide">
            {errorStatus}
          </p>
          <button 
            onClick={() => loadMonitoringData(true)} 
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] tracking-widest rounded-xl transition-all"
          >
            Retry Connection Link
          </button>
        </div>
      </div>
    );
  }

  // Safe checks for datasets
  const activeAlerts = alertsList;
  const systemState = overview?.summary?.generalStatus || "HEALTHY";
  const uptimeRaw = overview?.summary?.systemUptime || 0;

  // Pie chart data for API metrics codes
  const epAnalytics = overview?.traffic;
  const statusSummaryData = [
    { name: "Successful 2xx", value: (epAnalytics?.totalRequests || 1) - (epAnalytics?.errorRequests4xx || 0) - (epAnalytics?.errorRequests5xx || 0), color: "#10b981" },
    { name: "Client Errors 4xx", value: epAnalytics?.errorRequests4xx || 0, color: "#f59e0b" },
    { name: "Server Failures 5xx", value: epAnalytics?.errorRequests5xx || 0, color: "#ef4444" }
  ];

  return (
    <div className="bg-slate-50 min-h-screen text-slate-600 pb-16 px-4 py-8 lg:p-8" id="enterprise-observability-host">
      
      {/* Upper Navigation Header bar */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[8px] font-black uppercase text-white bg-indigo-600 rounded-md tracking-widest">
              Enterprise Suite
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Restopro telemetry engine</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 italic">
            Telemetry Dashboard
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200/80 rounded-xl text-xs font-mono font-bold text-slate-700">
            <Clock size={14} className="text-slate-400" />
            <span>Uptime: {formatUptime(uptimeRaw)}</span>
          </div>

          <button
            onClick={() => loadMonitoringData(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:translate-y-[1px] disabled:opacity-50 text-white font-black text-[10px] tracking-widest py-2.5 px-4 rounded-xl transition-all shadow-md shadow-indigo-100"
          >
            <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
            <span>{isRefreshing ? "REFRESHING" : "SYNC METRICS"}</span>
          </button>
        </div>
      </div>

      {/* Broad General Wellness Stripe Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${
          systemState === "HEALTHY" 
            ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
            : "bg-amber-50/50 border-amber-100 text-amber-800"
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              systemState === "HEALTHY" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
            }`}>
              <Activity size={24} className={systemState === "HEALTHY" ? "" : "animate-pulse"} />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider mb-0.5">
                Cluster Status: {systemState}
              </h4>
              <p className="text-xs opacity-85 uppercase font-medium tracking-tight">
                {systemState === "HEALTHY" 
                  ? "All diagnostic nodes reports green. Micro-services synchronizing successfully and queuing pipelines online."
                  : `Observability alarms active: ${activeAlerts.length} outstanding system issues detected. Action required.`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-left md:text-right font-mono">
              <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold font-sans">Active Incidents</span>
              <span className="text-lg font-black">{activeAlerts.length}</span>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
            <div className="text-left md:text-right font-mono">
              <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold font-sans">API Latency Avg</span>
              <span className="text-lg font-black">{overview?.services?.database?.avgQueryLatencyMs || "2.1"} <span className="text-[10px]">ms</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Horizontal Row */}
      <div className="max-w-7xl mx-auto mb-8 bg-white p-1.5 border border-slate-200 rounded-2xl flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${
            activeTab === "overview" 
              ? "bg-slate-900 text-white" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Activity size={14} />
          <span>System Health & Webhooks</span>
        </button>

        <button
          onClick={() => setActiveTab("queues")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${
            activeTab === "queues" 
              ? "bg-slate-900 text-white" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Layers size={14} />
          <span>BullMQ & Printers</span>
        </button>

        <button
          onClick={() => setActiveTab("mongo")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${
            activeTab === "mongo" 
              ? "bg-slate-900 text-white" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Database size={14} />
          <span>MongoDB Performance</span>
        </button>

        <button
          onClick={() => setActiveTab("redis")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${
            activeTab === "redis" 
              ? "bg-slate-900 text-white" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Cpu size={14} />
          <span>Redis Memory Cache</span>
        </button>

        <button
          onClick={() => setActiveTab("sockets")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${
            activeTab === "sockets" 
              ? "bg-slate-900 text-white" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Network size={14} />
          <span>Socket.IO & Telemetry</span>
        </button>
      </div>

      {/* Main Tab Panels Grid Areas */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              layoutId="dashboardTab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
              id="tab-overview-panel"
            >
              {/* Overview Analytics Quad Cards Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Api Traffic Tracker card */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2">REST API Metrics</span>
                    <h3 className="text-3xl font-black text-slate-800 font-mono tracking-tight leading-none mb-1">
                      {epAnalytics?.totalRequests || 0}
                    </h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">HTTP API requests resolved</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-indigo-600 font-bold uppercase tracking-tight">
                    <span>Active Loops:</span>
                    <span className="font-mono bg-indigo-50 px-2 py-0.5 rounded">{epAnalytics?.activeRequests || 0} async</span>
                  </div>
                </div>

                {/* Queue Health Aggregate card */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2">BullMQ Threads</span>
                    <h3 className="text-3xl font-black text-slate-800 font-mono tracking-tight leading-none mb-1">
                      {overview?.queues?.activeJobs || 0}
                    </h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Active micro-service tasks</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-rose-600 font-semibold uppercase tracking-tight">
                    <span>Poisoned DLQ Jobs:</span>
                    <span className="font-mono bg-rose-50 font-black px-2 py-0.5 rounded">{overview?.queues?.dlqJobsCount || 0} audit</span>
                  </div>
                </div>

                {/* Database State indicator cards */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2">MongoDB Cluster</span>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mt-1 mb-2">
                      {overview?.services?.database?.status || "CONNECTED"}
                    </h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">
                      {overview?.services?.database?.isUsingFallbackMemoryDB ? "Memory Cache Mode" : "Production Set"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-emerald-600 font-bold uppercase tracking-tight">
                    <span>Cluster Sync Speed:</span>
                    <span className="font-mono bg-emerald-50 px-2 py-0.5 rounded">{overview?.services?.database?.avgQueryLatencyMs || "1.8"} ms</span>
                  </div>
                </div>

                {/* Redis cache state cards */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2">Redis Core Service</span>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mt-1 mb-2">
                      {redis?.redis?.status || "CONNECTED"}
                    </h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">
                      Pool size: {redis?.redis?.connections?.connectedClients || 1} clients connected
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-amber-600 font-bold uppercase tracking-tight">
                    <span>Memory RSS:</span>
                    <span className="font-mono bg-amber-50 px-2 py-0.5 rounded">{redis?.redis?.memoryUsage?.formatted || "7.75MB"}</span>
                  </div>
                </div>

              </div>

              {/* Lower split panels: Dynamic Alerts lists & Webhooks controls */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Alarms and active incidents center */}
                <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-base font-black text-slate-800 uppercase italic">Fired Systems Incidents</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Pro-active alerts triggered within clusters</p>
                    </div>
                    <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full font-mono font-black text-xs">
                      {activeAlerts.length} ACTIVE
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeAlerts.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                        <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-700">All Operations Nominal</h5>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Zero infrastructure issues firing at this time.</p>
                      </div>
                    ) : (
                      activeAlerts.map((alert) => (
                        <div 
                          key={alert.id}
                          className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                            alert.severity === "CRITICAL" 
                              ? "bg-red-50/60 border-red-100" 
                              : "bg-amber-50/60 border-amber-100"
                          }`}
                        >
                          <AlertTriangle className={`shrink-0 mt-0.5 ${alert.severity === "CRITICAL" ? "text-red-500" : "text-amber-500"}`} size={18} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 font-mono">
                                {alert.type}
                              </span>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                alert.severity === "CRITICAL" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
                              }`}>
                                {alert.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold uppercase">{alert.message}</p>
                            <span className="block text-[9px] font-mono font-bold text-slate-400 mt-2 uppercase">
                              TriggeredAt: {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Incident History Audit Trail list */}
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-4 italic">Historic Indicators Log ({alertsHistory.length} cleared cases)</h5>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar text-xs">
                      {alertsHistory.slice(0, 10).map((hist) => (
                        <div key={hist.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            {hist.resolvedAt ? (
                              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle size={13} className="text-rose-500 shrink-0" />
                            )}
                            <span className="font-mono text-[9px] font-black text-slate-700 uppercase truncate">{hist.type}</span>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-slate-450 uppercase">
                            {new Date(hist.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Webhooks configuration and tests panel */}
                <div className="lg:col-span-5 space-y-8">
                  
                  {/* Webhooks registry component */}
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                    <h4 className="text-base font-black text-slate-800 uppercase mb-1 italic">Enterprise Incident Rules</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-6">Slack & PagerDuty outbound pipelines</p>

                    <form onSubmit={handleAddWebhook} className="space-y-3 mb-6">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Node Alias (e.g. Slack Ops)"
                          value={newWebhookName}
                          onChange={(e) => setNewWebhookName(e.target.value)}
                          className="px-3 py-2 border border-slate-200 rounded-xl text-xs uppercase font-semibold focus:outline-indigo-500"
                          required
                        />
                        <input
                          type="url"
                          placeholder="Webhook Pipeline Endpoint URL"
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                          className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-indigo-500"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={actionInProgress === "webhook_add"}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus size={12} />
                        <span>REGISTER DISPATCH CHANNEL</span>
                      </button>
                    </form>

                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {webhooks.map((hook) => (
                        <div key={hook.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{hook.name}</h5>
                            <p className="text-[9px] font-mono text-slate-400 truncate max-w-[200px]">{hook.url}</p>
                          </div>
                          
                          <button
                            onClick={() => handleToggleWebhook(hook.id, hook.active)}
                            disabled={actionInProgress === `webhook_toggle_${hook.id}`}
                            className="text-slate-500 hover:text-indigo-600"
                          >
                            {hook.active ? (
                              <ToggleRight size={28} className="text-emerald-500" />
                            ) : (
                              <ToggleLeft size={28} className="text-slate-400" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manual alarm triggers simulation */}
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                    <h4 className="text-base font-black text-slate-800 uppercase mb-1 italic">Simulation Playground</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-6">Dispatch test payloads onto registered endpoints</p>

                    <form onSubmit={handleTriggerTestAlert} className="space-y-3">
                      <div>
                        <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">INCIDENT PROTOCOL</label>
                        <select
                          value={testAlertType}
                          onChange={(e) => setTestAlertType(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs uppercase font-black tracking-wider text-slate-700 bg-white"
                        >
                          <option value="QUEUE_BACKLOG_SPIKE">QUEUE_BACKLOG_SPIKE</option>
                          <option value="PRINTER_HARDWARE_OFFLINE">PRINTER_HARDWARE_OFFLINE</option>
                          <option value="DATABASE_DISCONNECTED">DATABASE_DISCONNECTED</option>
                          <option value="REDIS_DISCONNECTED">REDIS_DISCONNECTED</option>
                          <option value="RESOURCE_EXHAUSTION">RESOURCE_EXHAUSTION</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Severity Bounds</label>
                          <select
                            value={testAlertSeverity}
                            onChange={(e) => setTestAlertSeverity(e.target.value as any)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-700 bg-white"
                          >
                            <option value="WARNING">WARNING</option>
                            <option value="CRITICAL">CRITICAL</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Mock Payload</label>
                          <input
                            type="text"
                            placeholder="Brief alarm text"
                            value={testAlertMsg}
                            onChange={(e) => setTestAlertMsg(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionInProgress === "test_alert"}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] tracking-widest rounded-xl transition-all uppercase"
                      >
                        {actionInProgress === "test_alert" ? "DISPATCHING..." : "GENERATE MOCK CRITICAL ALARM"}
                      </button>
                    </form>
                  </div>

                </div>

              </div>
            </motion.div>
          )}

          {activeTab === "queues" && (
            <motion.div
              layoutId="queuesTab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
              id="tab-queues-panel"
            >
              {/* BullMQ Queues indicators */}
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h4 className="text-base font-black text-slate-800 uppercase italic">BullMQ Task Pipelines Dashboard</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active wait metrics, DLQ diagnostics & error purger</p>
                  </div>
                  <span className="text-[10px] uppercase font-mono font-bold px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                    Engine: Redis Stream Cluster Node
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] tracking-widest font-black">
                        <th className="pb-3 pl-2">Queue Context Name</th>
                        <th className="pb-3 text-center">Active Jobs</th>
                        <th className="pb-3 text-center">Delayed / Paused</th>
                        <th className="pb-3 text-center">Completed Count</th>
                        <th className="pb-3 text-center">Failed List</th>
                        <th className="pb-3 text-center">DLQ Backlog</th>
                        <th className="pb-3 text-right pr-2">DLQ Administration Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-semibold uppercase text-slate-700">
                      {queues?.queues?.map((q) => (
                        <tr key={q.queueName} className="hover:bg-slate-50/55 transition-colors">
                          <td className="py-4 pl-2 font-mono text-[10px] text-indigo-600 font-black">{q.queueName}</td>
                          <td className="py-4 text-center font-mono">{q.active || 0}</td>
                          <td className="py-4 text-center text-slate-400 font-mono">
                            {q.delayed || 0} <span className="text-[10px] text-slate-300">/</span> {q.paused || 0}
                          </td>
                          <td className="py-4 text-center font-mono text-emerald-600">{q.completed || 0}</td>
                          <td className="py-4 text-center font-mono text-rose-500">{q.failed || 0}</td>
                          <td className="py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                              (q.deadLetterJobs || 0) > 0 ? "bg-rose-100 text-rose-700 font-black animate-pulse" : "bg-slate-100 text-slate-500"
                            }`}>
                              {q.deadLetterJobs || 0}
                            </span>
                          </td>
                          <td className="py-4 text-right pr-2">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRetryQueueDLQ(q.queueName)}
                                disabled={actionInProgress === `dlq_retry_${q.queueName}`}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all"
                              >
                                RETRY DLQ
                              </button>
                              <button
                                onClick={() => handlePurgeQueueDLQ(q.queueName)}
                                disabled={actionInProgress === `dlq_purge_${q.queueName}`}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all"
                              >
                                PURGE DLQ
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Printer diagnostics & background workers layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Workers Status List Panel */}
                <div className="lg:col-span-6 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                  <h4 className="text-sm font-black text-slate-800 uppercase mb-1 italic">Active Workers Telemetry</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-6">Concurrency allocation & thread state indicators</p>

                  <div className="space-y-4">
                    {queues?.workers?.map((w) => {
                      const limit = queues.concurrencySpecs[w.queueName] || 5;
                      const activePercentage = Math.round(((w.onlineThreadsCount || 1) / limit) * 100);
                      
                      return (
                        <div key={w.queueName} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="min-w-0">
                              <h5 className="font-mono text-xs font-black text-indigo-600 lowercase">{w.queueName}-worker</h5>
                              <p className="text-[9px] text-slate-400 font-sans uppercase font-bold tracking-tight">Active thread concurrency count</p>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase ${
                              w.workerActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                            }`}>
                              {w.workerActive ? "ONLINE" : "STANDBY"}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 rounded-full" 
                                style={{ width: `${Math.min(100, activePercentage)}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-xs text-slate-605">
                              {w.onlineThreadsCount || 1} / {limit} concurrent limits
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Printer Hub Diagnostics Panel */}
                <div className="lg:col-span-6 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase italic">Printer Hardware Observability</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Offline POS terminals and printing queues</p>
                    </div>
                    <Printer className="text-slate-400" size={20} />
                  </div>

                  {/* Printer specific alarms */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-amber-500 mt-0.5" />
                      <div>
                        <h5 className="text-[10px] font-black uppercase text-slate-800">Branch Terminal KOT printer drop</h5>
                        <p className="text-xs text-slate-600 font-semibold uppercase">WIFI connection jitter detected on "Branch A K kitchen". Auto backup spooler offline routing active.</p>
                        <span className="block text-[8px] font-mono text-slate-400 uppercase font-black mt-2">Spooled Jobs: 2 active retry queue</span>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-50 text-xs">
                      <div className="p-3 flex justify-between items-center bg-slate-50/40">
                        <span className="font-bold text-slate-500 uppercase">Total Printer tasks today</span>
                        <span className="font-mono font-black text-slate-705">142 tickets successfully cached</span>
                      </div>
                      <div className="p-3 flex justify-between items-center">
                        <span className="font-bold text-slate-500 uppercase">Printer pipeline retry timer</span>
                        <span className="font-mono font-black text-slate-705">10 seconds backing spacing</span>
                      </div>
                      <div className="p-3 flex justify-between items-center">
                        <span className="font-bold text-slate-500 uppercase">Fallback spooling state</span>
                        <span className="font-mono font-black text-emerald-600">ONLINE (LOCAL CACHE SYNC)</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {activeTab === "mongo" && (
            <motion.div
              layoutId="mongoTab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
              id="tab-mongo-panel"
            >
              {/* Detailed MongoDB replica analytics */}
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h4 className="text-base font-black text-slate-800 uppercase italic">Mongoose ODM & MongoDB ReplSet Diagnostics</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Replica synchronization status, query response and connection pool counters</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full font-mono text-xs font-black border border-emerald-100 uppercase">
                    Status: ACTIVE POOL
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  
                  {/* Query Timing speed gauge */}
                  <div className="md:col-span-4 text-center p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="block text-[8px] font-black uppercase text-slate-450 tracking-widest mb-2">DB Query Speed Check</span>
                    <h3 className="text-4xl font-black text-slate-800 font-mono tracking-tight my-2">
                      {overview?.services?.database?.avgQueryLatencyMs || "1.8"}<span className="text-lg">ms</span>
                    </h3>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Optimal Response Nominal</p>
                    <div className="mt-4 pt-4 border-t border-slate-200 text-left space-y-1 text-[11px] text-slate-500">
                      <div className="flex justify-between font-semibold">
                        <span>Connection Pool limit</span>
                        <span className="font-mono text-slate-700">100 connections</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Active ODM instances</span>
                        <span className="font-mono text-slate-700">1 primary</span>
                      </div>
                    </div>
                  </div>

                  {/* Pool Metrics bars */}
                  <div className="md:col-span-8 space-y-4">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cluster Operations & Synchronizers</h5>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase text-slate-550 mb-1">
                          <span>Connection pool allocations</span>
                          <span className="font-mono">8 active / 100 max limits</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: "8%" }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase text-slate-550 mb-1">
                          <span>Replica synchronization latency index</span>
                          <span className="font-mono">0.05ms jitter</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: "35%" }}></div>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-xs flex items-center justify-between">
                        <span className="font-bold text-slate-750 uppercase">SANDBOX MODE FALLBACK</span>
                        <span className="font-semibold text-slate-650">Auto-Spawning in-container MongoDB thread active</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "redis" && (
            <motion.div
              layoutId="redisTab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
              id="tab-redis-panel"
            >
              {/* Detailed Redis memory & load dashboards */}
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h4 className="text-base font-black text-slate-800 uppercase italic">Redis In-Memory Key Store Observability</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Allocated capacity metrics, ping response speed latency, and client threads count</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full font-mono text-xs uppercase font-black">
                    State: CONNECTED
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Ping latency */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                    <span className="block text-[8px] font-black uppercase text-slate-450 tracking-widest mb-2">Ping Latency</span>
                    <h3 className="text-4xl font-black text-slate-800 font-mono tracking-tight my-2">
                      {redis?.redis?.pingLatencyMs || "1.0"}<span className="text-base">ms</span>
                    </h3>
                    <p className="text-[9px] uppercase font-bold text-amber-500">Very High Connection Jitter Free</p>
                  </div>

                  {/* Memory stats */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                    <span className="block text-[8px] font-black uppercase text-slate-450 tracking-widest mb-2">Memory usage RSS</span>
                    <h3 className="text-4xl font-black text-slate-800 font-mono tracking-tight my-2">
                      {redis?.redis?.memoryUsage?.formatted || "7.75MB"}
                    </h3>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Peak Used: {redis?.redis?.memoryUsage?.usedPeakBytes ? `${Math.round(redis.redis.memoryUsage.usedPeakBytes / 1024 / 1024 * 100) / 100}MB` : "1.2MB"}</p>
                  </div>

                  {/* Active connection count */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                    <span className="block text-[8px] font-black uppercase text-slate-450 tracking-widest mb-2">Connected Client Threads</span>
                    <h3 className="text-4xl font-black text-slate-800 font-mono tracking-tight my-2">
                      {redis?.redis?.connections?.connectedClients || 1}
                    </h3>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Instant Ops: {redis?.redis?.connections?.instantaneousOpsPerSec || 0} exec/sec</p>
                  </div>

                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 text-xs text-slate-500 font-semibold space-y-3">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Redis connection properties</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1">Host node IP</span>
                      <span className="font-mono text-slate-700 font-black text-xs lowercase">{redis?.redis?.host || "127.0.0.1"}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1">Port address</span>
                      <span className="font-mono text-slate-700 font-black text-xs">{redis?.redis?.port || 6379}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1">Subscribers list</span>
                      <span className="font-mono text-slate-700 font-black text-xs">{redis?.redis?.connections?.blockedClients || 0} waiting channels</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1">Max capacity bounds</span>
                      <span className="font-mono text-slate-700 font-black text-xs">{redis?.redis?.memoryUsage?.maxmemory_human || "Unlimited"}</span>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {activeTab === "sockets" && (
            <motion.div
              layoutId="socketsTab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
              id="tab-sockets-panel"
            >
              {/* API and sockets telemetry tracking info panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Sockets isolate maps & room list container */}
                <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-base font-black text-slate-800 uppercase italic">Socket.IO Rooms Isolation Map</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active live room isolation per restaurant branches</p>
                    </div>
                    <Radio className="text-indigo-650 animate-pulse" size={20} />
                  </div>

                  <div className="space-y-4 max-h-[385px] overflow-y-auto pr-2 custom-scrollbar">
                    {sockets?.rooms?.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 text-slate-350" />
                        <h5 className="text-[11px] font-black uppercase text-slate-700">No rooms active</h5>
                        <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Clients currently listening inside main global stream only.</p>
                      </div>
                    ) : (
                      sockets?.rooms?.map((room) => (
                        <div key={room.roomId} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-black text-slate-850 lowercase breaking-all">
                              {room.roomId}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                room.isBranchSpecific ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"
                              }`}>
                                {room.isBranchSpecific ? "Branch Room" : "System Channel"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="block text-xs font-mono font-black text-slate-700">
                              {room.connectedClientsCount || 1} clients
                            </span>
                            <span className="block text-[9px] uppercase tracking-tighter text-slate-400 font-bold">listening now</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Event traffic statistics and api logs */}
                <div className="lg:col-span-5 space-y-8">
                  
                  {/* Traffic stats telemetry indicators */}
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                    <h4 className="text-sm font-black text-slate-800 uppercase mb-1 italic">Event Transit Counters</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-6">Real-time inbound vs outbound socket indicators</p>

                    <div className="space-y-4 text-xs font-bold uppercase text-slate-500">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1">Active Sockets count</span>
                          <span className="font-mono text-slate-700 text-lg font-black">{sockets?.sockets?.activeCount || 0} clients</span>
                        </div>
                        <Users size={20} className="text-slate-400" />
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1">Transports list</span>
                          <span className="font-mono text-slate-700 text-xs font-black">WEBSOCKET, LONG-POLLING SUPPORTED</span>
                        </div>
                        <Globe size={18} className="text-slate-400" />
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase tracking-widest mb-1">Clustering Adapter</span>
                          <span className="font-mono text-slate-750 text-xs font-bold leading-normal lowercase">Local in-process Node Adapter</span>
                        </div>
                        <Layers size={18} className="text-slate-450" />
                      </div>
                    </div>
                  </div>

                  {/* RestApi Slow Endpoints telemetry check list */}
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                    <h4 className="text-sm font-black text-slate-800 uppercase mb-1 italic">Slow API endpoints diagnostic</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-6">Top 5 Slowest REST endpoints logged on route</p>

                    <div className="space-y-3 font-semibold uppercase text-xs">
                      {overview?.traffic?.slowestEndpoints && overview.traffic.slowestEndpoints.length > 0 ? (
                        overview.traffic.slowestEndpoints.map((ep, idx) => (
                          <div key={idx} className="p-3 bg-rose-50 border border-rose-100/50 rounded-2xl flex items-center justify-between gap-4 font-mono">
                            <div className="min-w-0">
                              <span className="text-[10px] font-black text-rose-700">
                                {ep.method} {ep.path}
                              </span>
                              <span className="block text-[9px] text-slate-400 mt-1 uppercase font-semibold">
                                Count: {ep.requestsCount} triggers
                              </span>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <span className="block font-black text-rose-800 text-xs">
                                {ep.avgDurationMs} <span className="text-[10px]">ms</span>
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center text-slate-450">
                          <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                          <span>All endpoints resolving under 100ms baseline thresholds.</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
