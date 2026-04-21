/**
 * Client-side logging utility
 * Sends logs to the server in production, uses console in development
 */

const LOG_ENDPOINT = "/api/logs";

interface LogPayload {
  level: "info" | "warn" | "error" | "debug";
  service: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

class ClientLogger {
  private service: string;
  private queue: LogPayload[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(service: string) {
    this.service = service;
  }

  private enqueue(level: LogPayload["level"], message: string, details?: Record<string, unknown>) {
    const entry: LogPayload = {
      level,
      service: this.service,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    // In development, log to console immediately
    if (process.env.NODE_ENV === "development") {
      this.logToConsole(entry);
      return;
    }

    // In production, batch and send to server
    this.queue.push(entry);
    this.scheduleFlush();
  }

  private logToConsole(entry: LogPayload) {
    const prefix = `[${entry.service}]`;
    switch (entry.level) {
      case "info":
        console.info(prefix, entry.message, entry.details || "");
        break;
      case "warn":
        console.warn(prefix, entry.message, entry.details || "");
        break;
      case "error":
        console.error(prefix, entry.message, entry.details || "");
        break;
      case "debug":
        console.debug(prefix, entry.message, entry.details || "");
        break;
    }
  }

  private scheduleFlush() {
    if (this.flushTimeout) return;
    this.flushTimeout = setTimeout(() => this.flush(), 5000);
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, 10); // Send max 10 at a time
    this.flushTimeout = null;

    try {
      await fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: batch }),
        keepalive: true,
      });
    } catch {
      // Silent fail - don't break user experience for logging
    }
  }

  info(message: string, details?: Record<string, unknown>) {
    this.enqueue("info", message, details);
  }

  warn(message: string, details?: Record<string, unknown>) {
    this.enqueue("warn", message, details);
  }

  error(message: string, details?: Record<string, unknown>) {
    this.enqueue("error", message, details);
  }

  debug(message: string, details?: Record<string, unknown>) {
    this.enqueue("debug", message, details);
  }
}

export function createClientLogger(service: string): ClientLogger {
  return new ClientLogger(service);
}
