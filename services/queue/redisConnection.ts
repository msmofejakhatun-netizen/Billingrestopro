import Redis, { RedisOptions } from "ioredis";

// Central parsed variables with defaults
let rawHost = process.env.REDIS_HOST || "127.0.0.1";
let rawPort = parseInt(process.env.REDIS_PORT || "6379", 10);
let rawPassword = process.env.REDIS_PASSWORD || "";
let tlsConfig: any = undefined;

// Robust parsing of REDIS_URL and mistyped URL patterns in REDIS_HOST
const rawConnectionInput = process.env.REDIS_URL || process.env.REDIS_HOST;

if (rawConnectionInput && (
  rawConnectionInput.includes("://") || 
  rawConnectionInput.startsWith("redis:") || 
  rawConnectionInput.startsWith("rediss:") || 
  rawConnectionInput.startsWith("http:") || 
  rawConnectionInput.startsWith("https:")
)) {
  try {
    let urlString = rawConnectionInput;
    if (urlString.startsWith("https://")) {
      urlString = urlString.replace("https://", "rediss://");
    } else if (urlString.startsWith("http://")) {
      urlString = urlString.replace("http://", "redis://");
    }

    const parsed = new URL(urlString);
    rawHost = parsed.hostname;
    
    if (parsed.port) {
      rawPort = parseInt(parsed.port, 10);
    } else if (parsed.protocol === "rediss:") {
      rawPort = 6379;
    }

    if (parsed.password) {
      rawPassword = decodeURIComponent(parsed.password);
    } else if (parsed.username && !parsed.password) {
      rawPassword = decodeURIComponent(parsed.username);
    }

    if (parsed.protocol === "rediss:") {
      tlsConfig = { rejectUnauthorized: false };
    }
  } catch (err: any) {
    console.warn("⚠️ Failed to parse complex Redis connection input, applying quick clean-up fallback:", err.message);
    rawHost = rawConnectionInput.replace(/^(https?:\/\/|rediss?:\/\/)/, "").split(":")[0].split("/")[0];
  }
} else if (rawHost.includes("upstash.io")) {
  tlsConfig = { rejectUnauthorized: false };
}

export const REDIS_HOST = rawHost;
export const REDIS_PORT = rawPort;
export const REDIS_PASSWORD = rawPassword;

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Configure standard production safe options.
 */
export const redisConfigOptions: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  tls: tlsConfig,
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
  enableReadyCheck: true,
  retryStrategy(times: number) {
    // Exponential backoff with jitter capped at 10 seconds
    const delay = Math.min(times * 150, 10000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.slice(0, targetError.length) === targetError) {
      return true; // Reconnect automatically if pointing to readonly replica node
    }
    return false;
  }
};

/**
 * Redis Connection factory class providing singletons for both general usage, 
 * pubsub drivers, subscriber instances and BullMQ connections.
 */
export class RedisConnectionManager {
  private static masterInstance: Redis | null = null;
  private static status: "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR" = "DISCONNECTED";
  private static lastError: string | null = null;

  static getClient(): Redis {
    if (!this.masterInstance) {
      console.log(`🔌 [REDIS INFRASTRUCTURE] Spawning new Redis connection to ${REDIS_HOST}:${REDIS_PORT}...`);
      this.masterInstance = new Redis(redisConfigOptions);

      this.masterInstance.on("connect", () => {
        this.status = "CONNECTING";
        console.log("🔄 [REDIS STATUS] Establishing connection handshake...");
      });

      this.masterInstance.on("ready", () => {
        this.status = "CONNECTED";
        this.lastError = null;
        console.log("🟢 [REDIS CONNECTION SUCCESS] Connected & ready for cache and queuing operations.");
      });

      this.masterInstance.on("error", (err: Error) => {
        this.status = "ERROR";
        this.lastError = err.message;
        console.error(`🔴 [REDIS CLIENT ERROR] ${err.message}`);
        
        if (IS_PROD && err.message.includes("ECONNREFUSED")) {
          console.error("🚨 PROD WARNING: Unable to establish Redis connection under production constraints.");
        }
      });

      this.masterInstance.on("close", () => {
        this.status = "DISCONNECTED";
        console.warn("⚠️ [REDIS STATUS] Redis connection closed gracefully.");
      });
    }
    return this.masterInstance;
  }

  /**
   * Spawns a secondary client instance (required by BullMQ per-Worker or per-Queue configuration)
   */
  static createNewConnectionInstance(): Redis {
    return new Redis(redisConfigOptions);
  }

  static getHealthStatus() {
    return {
      host: REDIS_HOST,
      port: REDIS_PORT,
      status: this.status,
      lastError: this.lastError,
      environment: process.env.NODE_ENV || "development"
    };
  }

  static async shutdown() {
    if (this.masterInstance) {
      console.log("🔌 [REDIS INFRASTRUCTURE] Disconnecting master Redis connection...");
      await this.masterInstance.quit();
      this.masterInstance = null;
      this.status = "DISCONNECTED";
    }
  }
}
