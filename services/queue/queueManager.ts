import { Queue, QueueOptions } from "bullmq";
import { RedisConnectionManager } from "./redisConnection";
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS, getDLQName } from "./queueConfig";

export class QueueManager {
  private static queues: Map<string, Queue> = new Map();

  /**
   * Safe getter to initialize and fetch a designated Queue singleton.
   */
  static getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      console.log(`📦 [QUEUE SETUP] Bootstrapping Queue instance for: "${queueName}"...`);
      const connection = RedisConnectionManager.getClient();
      
      const queueOptions: QueueOptions = {
        connection,
      };

      const queue = new Queue(queueName, queueOptions);
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName)!;
  }

  /**
   * Initializes all required queues concurrently during startup
   */
  static initializeAllQueues() {
    for (const name of Object.values(QUEUE_NAMES)) {
      this.getQueue(name);
      // Also register corresponding Dead Letter Queues (DLQ)
      this.getQueue(getDLQName(name));
    }
    console.log("🟢 [QUEUE MANAGER] All enterprise and dead-letter queues mapped and listening.");
  }

  /**
   * Adds a structural task payload with a customized job configuration.
   * If an event requires deduplication (e.g. sync checkpoints), we utilize a unique jobId constraint.
   */
  static async addJob(
    queueName: string,
    jobName: string,
    data: any,
    options: { jobId?: string; delay?: number } = {}
  ) {
    const queue = this.getQueue(queueName);
    
    // Choose backing options corresponding to queue
    let customOpts = { ...options };
    if (queueName === QUEUE_NAMES.OFFLINE_SYNC) {
      customOpts = { ...DEFAULT_JOB_OPTIONS.OFFLINE_SYNC, ...customOpts };
    } else if (queueName === QUEUE_NAMES.PRINTER) {
      customOpts = { ...DEFAULT_JOB_OPTIONS.PRINTER, ...customOpts };
    } else if (queueName === QUEUE_NAMES.NOTIFICATION) {
      customOpts = { ...DEFAULT_JOB_OPTIONS.NOTIFICATION, ...customOpts };
    } else if (queueName === QUEUE_NAMES.ANALYTICS) {
      customOpts = { ...DEFAULT_JOB_OPTIONS.ANALYTICS, ...customOpts };
    } else if (queueName === QUEUE_NAMES.BACKUP) {
      customOpts = { ...DEFAULT_JOB_OPTIONS.BACKUP, ...customOpts };
    }

    try {
      // Dedup helper using Redis key manually for double guarantee
      if (options.jobId && (queueName === QUEUE_NAMES.OFFLINE_SYNC || queueName === QUEUE_NAMES.PRINTER)) {
        const client = RedisConnectionManager.getClient();
        const dedupKey = `dedup:${queueName}:${options.jobId}`;
        const lockAcquired = await (client as any).set(dedupKey, "LOCKED", "EX", 300, "NX"); // 5 minutes lock
        
        if (!lockAcquired) {
          console.log(`⚠️ [JOB DEDUPLICATOR] Discarding duplicate job invocation. Id: "${options.jobId}" under Queue: "${queueName}"`);
          return null;
        }
      }

      const job = await queue.add(jobName, data, customOpts);
      console.log(`🎟️ [QUEUE MANAGER] Job successfully queued to "${queueName}". Job Id: "${job.id}"`);
      return job;
    } catch (err: any) {
      console.error(`🔴 [QUEUE MANAGER ERROR] Failed to dispatch job to "${queueName}": ${err.message}`);
      throw err;
    }
  }

  /**
   * Retrieves fine-grained telemetry tracking for standard dashboard reporting.
   */
  static async getQueueMetrics(queueName: string) {
    const queue = this.getQueue(queueName);
    const dlqQueue = this.getQueue(getDLQName(queueName));

    try {
      const [active, waiting, failed, completed, delayed, dlqCount] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getFailedCount(),
        queue.getCompletedCount(),
        queue.getDelayedCount(),
        dlqQueue.getWaitingCount() // Waiting items in the Dead Letter Queue
      ]);

      return {
        queueName,
        active,
        waiting,
        delayed,
        completed,
        failed,
        deadLetterJobs: dlqCount,
        totalManaged: active + waiting + failed + completed + delayed + dlqCount,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        queueName,
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Retrieves aggregated telemetry of all managed queues.
   */
  static async getAllMetrics() {
    const metrics: any[] = [];
    for (const name of Object.values(QUEUE_NAMES)) {
      metrics.push(await this.getQueueMetrics(name));
    }
    return metrics;
  }

  /**
   * Closes all active Client Queue pipelines during application shutdown.
   */
  static async shutdown() {
    console.log("🔌 [QUEUE SERVICES] Cleaning up and releasing Queue singletons...");
    const closures: Promise<any>[] = [];
    for (const [name, queue] of this.queues.entries()) {
      closures.push(queue.close().then(() => {
        console.log(`- Queue connection for "${name}" closed successfully.`);
      }));
    }
    await Promise.all(closures);
    this.queues.clear();
  }
}
