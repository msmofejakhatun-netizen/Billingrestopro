import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Centralized telemetry memory data structure
export interface ApiEndpointMetric {
  path: string;
  method: string;
  count: number;
  totalDurationMs: number;
  avgDurationMs: number;
  statusCodes: Record<number, number>;
  lastCalledAt: string;
}

export const telemetryMetrics = {
  totalRequests: 0,
  activeRequests: 0,
  errorRequests5xx: 0,
  errorRequests4xx: 0,
  socketConnectionsActive: 0,
  socketEventsReceived: 0,
  socketEventsSent: 0,
  endpoints: {} as Record<string, ApiEndpointMetric>,
  recentErrors: [] as { timestamp: string; requestId: string; method: string; path: string; status: number; message: string }[]
};

/**
 * Clean path formatting helper to group dynamic route segments together
 */
function normalizePath(originalPath: string): string {
  // Replace alphanumeric/UUID IDs (like mongodb IDs or UUIDs) with ":id" placeholder
  return originalPath
    .replace(/\/[0-9a-fA-F]{24}(\/|$)/g, "/:id$1")
    .replace(/\/[0-9a-fA-F-]{36}(\/|$)/g, "/:id$1")
    .replace(/\/\d+(\/|$)/g, "/:id$1")
    .split("?")[0];
}

/**
 * Telemetry and Request Tracing Middleware
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();
  const requestId = req.headers["x-request-id"] as string || crypto.randomUUID();
  
  // Set response headers for client tracing trace-ability
  res.setHeader("X-Request-ID", requestId);

  // Increment atomic stats
  telemetryMetrics.totalRequests += 1;
  telemetryMetrics.activeRequests += 1;

  const originalPath = req.baseUrl + req.path;
  
  // Skip logic: do not log or track telemetry for Vite source assets/bundles/icons/fonts in dev mode
  const isStaticOrDevAsset = 
    originalPath.startsWith("/src/") ||
    originalPath.startsWith("/node_modules/") ||
    originalPath.startsWith("/@") ||
    originalPath.startsWith("/favicon.ico") ||
    /(\.(ts|tsx|js|jsx|css|map|png|jpg|jpeg|gif|svg|ico|woff2?|html))$/i.test(originalPath);

  if (isStaticOrDevAsset && !originalPath.startsWith("/api/")) {
    return next();
  }

  const method = req.method;
  const normalizedPath = normalizePath(originalPath);

  // Structured request Logging on start (trace audit log)
  if (process.env.NODE_ENV !== "test") {
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      type: "api_request",
      requestId,
      method,
      path: originalPath,
      normalizedPath,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"]
    }));
  }

  // Intercept the end of clean response serving to finish timing calculation
  res.on("finish", () => {
    telemetryMetrics.activeRequests = Math.max(0, telemetryMetrics.activeRequests - 1);
    
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6; // converts ns to ms
    const status = res.statusCode;

    // Categorize response code groups
    if (status >= 500) {
      telemetryMetrics.errorRequests5xx += 1;
    } else if (status >= 400) {
      telemetryMetrics.errorRequests4xx += 1;
    }

    // Capture errors in recent errors sliding buffer
    if (status >= 400) {
      telemetryMetrics.recentErrors.unshift({
        timestamp: new Date().toISOString(),
        requestId,
        method,
        path: originalPath,
        status,
        message: res.statusMessage || `HTTP Failure ${status}`
      });
      // Cap at most 30 recent errors to guard heap allocation
      if (telemetryMetrics.recentErrors.length > 30) {
        telemetryMetrics.recentErrors.pop();
      }
    }

    // Save endpoint fine group statistics
    const key = `${method} ${normalizedPath}`;
    if (!telemetryMetrics.endpoints[key]) {
      telemetryMetrics.endpoints[key] = {
        path: normalizedPath,
        method,
        count: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        statusCodes: {},
        lastCalledAt: ""
      };
    }

    const metric = telemetryMetrics.endpoints[key];
    metric.count += 1;
    metric.totalDurationMs += durationMs;
    metric.avgDurationMs = Math.round((metric.totalDurationMs / metric.count) * 100) / 100;
    metric.statusCodes[status] = (metric.statusCodes[status] || 0) + 1;
    metric.lastCalledAt = new Date().toISOString();

    // Structuring standard operational response logging output format matching PM2 expectations
    if (process.env.NODE_ENV !== "test") {
      const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      console.log(JSON.stringify({
        level: logLevel,
        timestamp: new Date().toISOString(),
        type: "api_response",
        requestId,
        method,
        path: originalPath,
        status,
        durationMs: Math.round(durationMs * 100) / 100,
        bytesSent: res.getHeader("content-length") || "unknown"
      }));
    }
  });

  next();
}

/**
 * Tracks Socket IO events for real-time traffic statistics
 */
export const socketTelemetryTracker = {
  recordConnection() {
    telemetryMetrics.socketConnectionsActive += 1;
  },
  recordDisconnect() {
    telemetryMetrics.socketConnectionsActive = Math.max(0, telemetryMetrics.socketConnectionsActive - 1);
  },
  recordInboundEvent() {
    telemetryMetrics.socketEventsReceived += 1;
  },
  recordOutboundEvent() {
    telemetryMetrics.socketEventsSent += 1;
  }
};
