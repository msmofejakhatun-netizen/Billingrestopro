import { Worker, Job } from "bullmq";
import { exec } from "child_process";
import path from "path";
import { RedisConnectionManager } from "./redisConnection";
import { QUEUE_NAMES, CONCURRENCY_CONFIGS, getDLQName } from "./queueConfig";
import { QueueManager } from "./queueManager";

export class WorkerBootstrap {
  private static workers: Map<string, Worker> = new Map();
  private static workerStatuses: Map<string, { status: "RUNNING" | "STOPPED"; lastJobProcessedAt?: string; lastError?: string }> = new Map();

  /**
   * Initializes all queue workers side-by-side with appropriate processors.
   */
  static bootstrapAllWorkers() {
    console.log("👷 [WORKER BOOTSTRAP] Initializing multi-instance queue workers...");

    // 1. Offline Sync Worker
    this.createWorker(QUEUE_NAMES.OFFLINE_SYNC, async (job) => {
      console.log(`[Offline Sync Worker] Processing job ${job.id} for device/branch...`);
      const { deviceId, branchId, deltaData } = job.data;
      
      if (!deviceId || !branchId) {
        throw new Error("Missing critical parameters: 'deviceId' and 'branchId' are mandatory.");
      }
      
      // Simulate real conflict evaluation & temporal sequence merge (LWW)
      console.log(`- Device ID: ${deviceId} | Branch ID: ${branchId}`);
      console.log(`- Sequence Payload metrics: ${JSON.stringify(deltaData || {})}`);
      
      // Introduce variable simulated processing delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { success: true, processedSyncAt: new Date().toISOString() };
    });

    // 2. Printer Worker
    this.createWorker(QUEUE_NAMES.PRINTER, async (job) => {
      console.log(`[Printer Worker] Printing KOT/Receipt job ${job.id}...`);
      const { printerId, payload, isUrgent } = job.data;
      
      if (!printerId || !payload) {
        throw new Error("Cannot queue print job: Missing target 'printerId' or raw 'payload'.");
      }
      
      // Simulating ESCPOS paper cuts and network state routing
      console.log(`- Route Target IP: ${printerId} | Priority: ${isUrgent ? "HIGH" : "STANDARD"}`);
      console.log(`- Payload Byte Stream size: ${payload.length} chars`);

      if (printerId === "PRN-FAILED-OFFLINE") {
        throw new Error("Timeout: Target printer hardware reports state OFFLINE; connection split.");
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, printerAckCode: "ESC_P_ACK_01", printedAt: new Date().toISOString() };
    });

    // 3. Notification Worker
    this.createWorker(QUEUE_NAMES.NOTIFICATION, async (job) => {
      console.log(`[Notification Worker] Dispatching push trigger job ${job.id}...`);
      const { audience, message, channel } = job.data;

      if (!message) {
        throw new Error("Notification payload content 'message' must be supplied.");
      }

      console.log(`- Broadcast Mode: ${channel || "SOCKETIO_ROOM"} | Target: ${audience || "ALL_CAPTAINS"}`);
      console.log(`- Message Alert Level: "${message}"`);

      // Mock real websockets room emit parameters or FCM gateway handshake
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { success: true, broadcastCount: audience === "ALL_CAPTAINS" ? 142 : 1 };
    });

    // 4. Analytics Worker
    this.createWorker(QUEUE_NAMES.ANALYTICS, async (job) => {
      console.log(`[Analytics Worker] Pre-computing restaurant telemetry datasets ${job.id}...`);
      const { reportType, branchId, daysPeriod } = job.data;

      console.log(`- Report parameters: ${reportType || "DASHBOARD_TELEMETRY"} | Days range: ${daysPeriod || 30}`);
      
      // Simulates intensive AI sales forecasting models regression analysis
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        success: true,
        compiledAt: new Date().toISOString(),
        confidenceInterval: 0.96,
        modelName: "RestoPro LSTM-Regressive Core v4"
      };
    });

    // 5. Backup Worker
    this.createWorker(QUEUE_NAMES.BACKUP, async (job) => {
      console.log(`[Backup Worker] Running automated database snapshot job ${job.id}...`);
      const backupScriptPath = path.join(process.cwd(), "backup_rotate.sh");

      return new Promise((resolve, reject) => {
        exec(`bash ${backupScriptPath}`, (err, stdout, stderr) => {
          if (err) {
            console.error(`🔴 [Backup Task Engine Error]: ${err.message}`);
            return reject(new Error(`Backup script execution failed: ${err.message}`));
          }
          console.log(`🟢 [Backup Task Engine stdout]:\n${stdout}`);
          if (stderr) {
            console.warn(`⚠️ [Backup Task Engine stderr]:\n${stderr}`);
          }
          resolve({ success: true, output: stdout, timestamp: new Date().toISOString() });
        });
      });
    });

    console.log("🟢 [WORKER BOOTSTRAP] All queue workers successfully configured, running, and listening to Redis channels.");
  }

  /**
   * Spawns a dedicated Worker runner with custom configuration and failure listening channels mapped.
   */
  private static createWorker(queueName: string, processor: (job: Job) => Promise<any>) {
    const connection = RedisConnectionManager.createNewConnectionInstance();
    
    // Concurrency lookup mapping
    let concurrency = 1;
    if (queueName === QUEUE_NAMES.OFFLINE_SYNC) concurrency = CONCURRENCY_CONFIGS.OFFLINE_SYNC;
    else if (queueName === QUEUE_NAMES.PRINTER) concurrency = CONCURRENCY_CONFIGS.PRINTER;
    else if (queueName === QUEUE_NAMES.NOTIFICATION) concurrency = CONCURRENCY_CONFIGS.NOTIFICATION;
    else if (queueName === QUEUE_NAMES.ANALYTICS) concurrency = CONCURRENCY_CONFIGS.ANALYTICS;
    else if (queueName === QUEUE_NAMES.BACKUP) concurrency = CONCURRENCY_CONFIGS.BACKUP;

    const worker = new Worker(queueName, processor, {
      connection,
      concurrency,
      lockDuration: 30000, // Keep lock alive for 30s safely
    });

    worker.on("active", (job: Job) => {
      this.workerStatuses.set(queueName, {
        status: "RUNNING",
        lastJobProcessedAt: new Date().toISOString(),
      });
    });

    worker.on("completed", (job: Job, returnvalue: any) => {
      console.log(`🎉 [WORKER SUCCESS] Queue "${queueName}" processed Job "${job.id}" correctly. Return:`, returnvalue);
    });

    worker.on("failed", async (job: Job | undefined, err: Error) => {
      console.error(`🚨 [WORKER ERROR] Queue "${queueName}" Job ${job ? `"${job.id}"` : "Unknown"} failed: ${err.message}`);
      
      const currentStatus = this.workerStatuses.get(queueName) || { status: "RUNNING" };
      this.workerStatuses.set(queueName, {
        ...currentStatus,
        lastError: err.message
      });

      if (job) {
        // DEAD-LETTER QUEUE (DLQ) ROUTING STRATEGY
        // Checked when maximum allowable retries are fully depleted without any successful outcomes.
        if (job.attemptsMade >= job.opts.attempts) {
          console.warn(`⚠️ [DEAD LETTER QUEUE ROUTER] Job "${job.id}" in "${queueName}" exhausted all retry limits. Moving to DLQ...`);
          try {
            await QueueManager.addJob(getDLQName(queueName), job.name, {
              originalJobId: job.id,
              exhaustedQueue: queueName,
              failedReason: err.message,
              attemptsMade: job.attemptsMade,
              originalData: job.data,
              failedTimestamp: new Date().toISOString()
            });
            console.log(`📥 [DLQ SUCCESS] Logged failover checkpoint to: "${getDLQName(queueName)}" for manual operator inspection.`);
          } catch (dlqErr: any) {
            console.error(`❌ [DLQ PATHWAY ERROR] Could not log original job failure inside DLQ database: ${dlqErr.message}`);
          }
        }
      }
    });

    this.workers.set(queueName, worker);
    this.workerStatuses.set(queueName, { status: "RUNNING" });
  }

  /**
   * Retrieves fine-grained status parameters of all running workers.
   */
  static getWorkerStatuses() {
    const statuses: any[] = [];
    for (const [name, meta] of this.workerStatuses.entries()) {
      statuses.push({
        queueName: name,
        concurrencyLimit: CONCURRENCY_CONFIGS[name as keyof typeof CONCURRENCY_CONFIGS] || 1,
        ...meta
      });
    }
    return statuses;
  }

  /**
   * Graceful and safe cancellation lock release wrapper during container termination
   */
  static async shutdown() {
    console.log("🔌 [WORKER SERVICES] Releasing worker processors and locking channels...");
    const closures: Promise<any>[] = [];
    for (const [name, worker] of this.workers.entries()) {
      closures.push(worker.close().then(() => {
        this.workerStatuses.set(name, { status: "STOPPED" });
        console.log(`- Worker runner for "${name}" stopped gracefully.`);
      }));
    }
    await Promise.all(closures);
    this.workers.clear();
  }
}
