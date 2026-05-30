import { QueueOptions, JobsOptions } from "bullmq";

export const QUEUE_NAMES = {
  OFFLINE_SYNC: "offline-sync-queue",
  PRINTER: "printer-queue",
  NOTIFICATION: "notification-queue",
  ANALYTICS: "analytics-queue",
  BACKUP: "backup-queue",
};

/**
 * Enterprise Concurrency limits for workers
 */
export const CONCURRENCY_CONFIGS = {
  OFFLINE_SYNC: 5,     // Scale sync workers for branch handshakes
  PRINTER: 3,          // Print task execution sequentially per register
  NOTIFICATION: 10,    // Broadcasts and alerts run at high concurrency
  ANALYTICS: 2,        // Intensive regression computation runs throttled
  BACKUP: 1,           // Resource intensive disk writes must run single-threaded
};

/**
 * Standard retry and backoff options for highly robust, resilient queue pipelines.
 */
export const DEFAULT_JOB_OPTIONS = {
  OFFLINE_SYNC: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000, // Starts with 2s, doubling on each try up to max attempts
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  } as JobsOptions,

  PRINTER: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000, // Fast retries for immediate physical operations response
    },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  } as JobsOptions,

  NOTIFICATION: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 500, // Ultra-fast notification retries
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  } as JobsOptions,

  ANALYTICS: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // Slower backoff for heavy process loads
    },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 10 },
  } as JobsOptions,

  BACKUP: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 10000, // 10-second gap before retrying backup procedure
    },
    removeOnComplete: { count: 5 },
    removeOnFail: { count: 5 },
  } as JobsOptions,
};

/**
 * Standard dead-letter queue (DLQ) designation mapper helper.
 */
export function getDLQName(queueName: string): string {
  return `${queueName}-dlq`;
}
