import { getDbHealthStatus } from "../utils/db";
import { RedisConnectionManager } from "./queue/redisConnection";
import { QueueManager } from "./queue/queueManager";
import { WorkerBootstrap } from "./queue/workerBootstrap";

export interface AlertInstance {
  id: string;
  type: "DATABASE_DISCONNECTED" | "REDIS_DISCONNECTED" | "RESOURCE_EXHAUSTION" | "QUEUE_BACKLOG_SPIKE" | "PRINTER_HARDWARE_OFFLINE";
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  timestamp: string;
  resolvedAt?: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  active: boolean;
  createdAt: string;
}

class AlertingService {
  private activeAlerts: Map<string, AlertInstance> = new Map();
  private alertHistory: AlertInstance[] = [];
  
  // Enterprise default simulated or real webhooks config
  private webhooks: WebhookConfig[] = [
    {
      id: "webhook-primary-slack",
      name: "Slack Ops Channel",
      url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXX",
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "webhook-secondary-pagerduty",
      name: "PagerDuty Router",
      url: "https://events.pagerduty.com/v2/enqueue",
      active: false,
      createdAt: new Date().toISOString()
    }
  ];

  /**
   * Dispatches a new alarm into active list and alerts all external receivers
   */
  async triggerAlert(
    type: AlertInstance["type"],
    message: string,
    severity: AlertInstance["severity"] = "WARNING"
  ) {
    const alertKey = `${type}:${severity}`;
    
    // Alert Storm suppression: ignore if already active in the list
    if (this.activeAlerts.has(alertKey)) {
      return;
    }

    const alert: AlertInstance = {
      id: `ALERT-${Math.floor(100000 + Math.random() * 900000)}`,
      type,
      severity,
      message,
      timestamp: new Date().toISOString()
    };

    this.activeAlerts.set(alertKey, alert);
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > 100) {
      this.alertHistory.pop();
    }

    // Direct structured terminal and console alarm logging output
    console.error(JSON.stringify({
      level: "error",
      timestamp: alert.timestamp,
      type: "alert_dispatched",
      alertId: alert.id,
      alertType: alert.type,
      severity: alert.severity,
      message: alert.message
    }));

    // Dispatch webhook notifications
    await this.dispatchWebhooks(alert);

    // Dispatch Simulated Email Hook
    this.sendAlertEmail(alert);
  }

  /**
   * Mark an actively firing alert as resolved
   */
  resolveAlert(type: AlertInstance["type"]) {
    let resolvedAny = false;
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.type === type) {
        alert.resolvedAt = new Date().toISOString();
        this.activeAlerts.delete(key);
        resolvedAny = true;

        console.log(JSON.stringify({
          level: "info",
          timestamp: alert.resolvedAt,
          type: "alert_resolved",
          alertId: alert.id,
          alertType: alert.type,
          message: `RESOLVED: ${alert.message}`
        }));
      }
    }
    return resolvedAny;
  }

  /**
   * Executes scheduled background system-wide telemetry scans to flag potential failures pro-actively.
   */
  async runTelemetryCheckRoutine() {
    try {
      // 1. Check MongoDB connectivity
      const dbHealth = getDbHealthStatus();
      if (dbHealth.status === "DISCONNECTED") {
        await this.triggerAlert(
          "DATABASE_DISCONNECTED",
          "Production database connection state is offline. Read-write pipelines blocked.",
          "CRITICAL"
        );
      } else {
        this.resolveAlert("DATABASE_DISCONNECTED");
      }

      // 2. Check Redis cached storage indicators
      const redisHealth = RedisConnectionManager.getHealthStatus();
      if (redisHealth.status === "ERROR" || redisHealth.status === "DISCONNECTED") {
        await this.triggerAlert(
          "REDIS_DISCONNECTED",
          `Redis caching and queue state store is offline. Error: ${redisHealth.lastError || "Unknown"}`,
          "CRITICAL"
        );
      } else {
        this.resolveAlert("REDIS_DISCONNECTED");
      }

      // 3. Monitor memory ceiling
      const memory = process.memoryUsage();
      const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
      const rssMB = Math.round(memory.rss / 1024 / 1024);
      // Warning on resource exhaustion if RSS exceeds 1.25 GB or heapUsed exceeds 800 MB
      if (rssMB > 1250 || heapUsedMB > 800) {
        await this.triggerAlert(
          "RESOURCE_EXHAUSTION",
          `Node instance resources exhausted. Current heap: ${heapUsedMB}MB | Resident Set Size (RSS): ${rssMB}MB`,
          "WARNING"
        );
      } else {
        this.resolveAlert("RESOURCE_EXHAUSTION");
      }

      // 4. Inspect queues backlog sizes
      const queuesMetrics = await QueueManager.getAllMetrics();
      for (const q of queuesMetrics) {
        if ("error" in q) continue;
        const waitingJobs = q.waiting || 0;
        const dlqJobs = q.deadLetterJobs || 0;

        if (waitingJobs > 100) {
          await this.triggerAlert(
            "QUEUE_BACKLOG_SPIKE",
            `Queue "${q.queueName}" backlog is high: ${waitingJobs} waiting jobs. Potential worker blockage!`,
            "WARNING"
          );
        }
        if (dlqJobs > 10) {
          await this.triggerAlert(
            "QUEUE_BACKLOG_SPIKE",
            `Queue "${q.queueName}" Dead Letter Queue (DLQ) contains ${dlqJobs} poisoned tasks requiring manual purge/retry.`,
            "WARNING"
          );
        }
      }

    } catch (e: any) {
      console.error("🔴 Standard telemetry checks runner encountered unexpected failure:", e.message);
    }
  }

  /**
   * Webhook router delivering operational signals to configured integrations
   */
  private async dispatchWebhooks(alert: AlertInstance) {
    const activeWebhooks = this.webhooks.filter(w => w.active);
    for (const hook of activeWebhooks) {
      try {
        console.log(`📡 [WEBHOOK DISPATCH] Sending alert ${alert.id} to endpoint "${hook.name}" (${hook.url})...`);
        
        // Use standard fetch if internet-accessible, otherwise safe mock fallback
        // We simulate the fetch safely within try/catch wrapper
        const payload = {
          text: `🚨 [*RestoPro Enterprise Alert*] - *${alert.severity}*`,
          attachments: [{
            color: alert.severity === "CRITICAL" ? "#ef4444" : alert.severity === "WARNING" ? "#f59e0b" : "#3b82f6",
            fields: [
              { title: "Exception Type", value: alert.type, short: true },
              { title: "Triggered At", value: alert.timestamp, short: true },
              { title: "Incident Summary", value: alert.message, short: false }
            ]
          }]
        };

        // Pro-active HTTP delivery check inside standard platform
        // Since we are running on real system container without live Slack hook URL,
        // we write the dispatch trace clearly but bypass direct calling unless a real URL is present.
        if (hook.url && !hook.url.includes("XXXXXX")) {
          await fetch(hook.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        }
      } catch (err: any) {
        console.error(`⚠️ Webhook transmission failed for "${hook.name}": ${err.message}`);
      }
    }
  }

  /**
   * Dispatch simulated alert email hooks
   */
  private sendAlertEmail(alert: AlertInstance) {
    console.log(`✉️ [ALERT-EMAIL HOOK] Trigger-Alert notification email drafted:\n` +
      `- Target Audients: Tech-Operations Alert List <ops@restopro.com>\n` +
      `- Subject: [RESTOPRO ALARM] - ${alert.severity}: ${alert.type}\n` +
      `- Body: Incident ${alert.id} started firing at ${alert.timestamp} on PID ${process.pid}.\n` +
      `  Message Detail: "${alert.message}"`);
  }

  /**
   * Expose system active alarms for admin overview endpoints
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Expose alerts audit log list
   */
  getAlertHistory() {
    return this.alertHistory;
  }

  /**
   * Webhook manager registration
   */
  addWebhook(name: string, url: string, active = true) {
    const hook: WebhookConfig = {
      id: `WEBHOOK-${Math.floor(100000 + Math.random() * 900000)}`,
      name,
      url,
      active,
      createdAt: new Date().toISOString()
    };
    this.webhooks.push(hook);
    return hook;
  }

  getWebhooks() {
    return this.webhooks;
  }

  toggleWebhook(id: string, active: boolean) {
    const hook = this.webhooks.find(w => w.id === id);
    if (hook) {
      hook.active = active;
      return true;
    }
    return false;
  }
}

export const alertingService = new AlertingService();
