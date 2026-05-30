import { Request, Response } from "express";
import { QueueManager } from "../services/queue/queueManager";
import { WorkerBootstrap } from "../services/queue/workerBootstrap";
import { RedisConnectionManager } from "../services/queue/redisConnection";
import { QUEUE_NAMES, getDLQName } from "../services/queue/queueConfig";

export class QueueController {

  /**
   * GET /api/captain/queues/metrics
   * Retrieves fine-grained metrics for all registered primary & dead letter queues.
   */
  static async getMetrics(req: Request, res: Response) {
    try {
      const redisHealth = RedisConnectionManager.getHealthStatus();
      const queuesMetrics = await QueueManager.getAllMetrics();
      const workerStatuses = WorkerBootstrap.getWorkerStatuses();

      return res.json({
        success: true,
        redis: redisHealth,
        queues: queuesMetrics,
        workers: workerStatuses,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/captain/queues/trigger
   * Triggers a manual task into any queue for diagnostic, load testing or manual operations.
   */
  static async triggerManualJob(req: Request, res: Response) {
    const { queueName, jobName, payload, options } = req.body;

    if (!queueName || !jobName) {
      return res.status(400).json({
        success: false,
        error: "Parameters 'queueName' and 'jobName' are mandatory."
      });
    }

    // Verify queue correctness
    const validNames = Object.values(QUEUE_NAMES);
    if (!validNames.includes(queueName)) {
      return res.status(400).json({
        success: false,
        error: `Invalid queue selected. Supported names are: ${validNames.join(", ")}`
      });
    }

    try {
      const job = await QueueManager.addJob(queueName, jobName, payload || {}, options || {});
      return res.json({
        success: true,
        message: `Job introduced with diagnostic metrics priority.`,
        jobId: job ? job.id : "discarded-duplicate"
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/captain/queues/dlq/purge
   * Purges complete entries from a specific Dead Letter Queue.
   */
  static async purgeDLQ(req: Request, res: Response) {
    const { queueName } = req.body;

    if (!queueName) {
      return res.status(400).json({ success: false, error: "Parameter 'queueName' is required." });
    }

    const dlqName = getDLQName(queueName);
    const dlqQueue = QueueManager.getQueue(dlqName);

    try {
      await dlqQueue.clean(0, 10000, "wait");
      await dlqQueue.clean(0, 10000, "failed");
      await dlqQueue.clean(0, 10000, "completed");
      await dlqQueue.drain();

      return res.json({
        success: true,
        message: `Successfully flushed and drained Dead Letter Queue: "${dlqName}"`
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/captain/queues/dlq/retry
   * Moves failed DLQ jobs back into original primary queue.
   */
  static async retryDLQJobs(req: Request, res: Response) {
    const { queueName } = req.body;

    if (!queueName) {
      return res.status(400).json({ success: false, error: "Parameter 'queueName' is required." });
    }

    const dlqName = getDLQName(queueName);
    const dlqQueue = QueueManager.getQueue(dlqName);

    try {
      const jobs = await dlqQueue.getJobs(["waiting", "delayed", "failed"]);
      let reprocessedCount = 0;

      for (const job of jobs) {
        // Safe check parameters
        const originalData = job.data.originalData || {};
        const originalName = job.name || "retry-failed-job";

        // Reintroduce into matching master stream
        await QueueManager.addJob(queueName, originalName, originalData);
        await job.remove();
        reprocessedCount++;
      }

      return res.json({
        success: true,
        message: `Successfully re-queued ${reprocessedCount} jobs from DLQ back into main pipeline.`,
        reprocessedCount
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
