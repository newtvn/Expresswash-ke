/**
 * Structured Logging Utility
 * Production-ready logging with levels, metadata, and external service integration
 */

import { supabase } from './supabase';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  service: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  serviceName: string;
  minLevel?: LogLevel;
  enableConsole?: boolean;
  enableRemote?: boolean;
  enableSentry?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: Required<LoggerConfig>;
  private sessionId: string;

  constructor(config: LoggerConfig) {
    this.config = {
      minLevel: 'info',
      enableConsole: true,
      enableRemote: import.meta.env.PROD, // Only send to remote in production
      enableSentry: false,
      ...config,
    };

    // Generate session ID for tracking user session logs
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const metadata = entry.metadata ? `\n${JSON.stringify(entry.metadata, null, 2)}` : '';
    return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.service}] ${entry.message}${metadata}`;
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemote) return;

    try {
      // Send to Supabase system_logs table
      await supabase.from('system_logs').insert({
        timestamp: entry.timestamp,
        level: entry.level,
        service: entry.service,
        message: entry.message,
        stack_trace: entry.stackTrace,
        metadata: entry.metadata,
      });
    } catch (error) {
      // Fallback to console if remote logging fails
      console.error('Failed to send log to remote:', error);
    }
  }

  private sendToSentry(entry: LogEntry): void {
    if (!this.config.enableSentry || typeof window === 'undefined') return;

    // Placeholder for Sentry integration
    // Will be implemented when Sentry is added
    if (window.Sentry && entry.level === 'error') {
      window.Sentry.captureException(new Error(entry.message), {
        level: entry.level,
        tags: {
          service: entry.service,
        },
        extra: entry.metadata,
      });
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): LogEntry {
    return {
      level,
      message,
      service: this.config.serviceName,
      timestamp: new Date().toISOString(),
      metadata,
      stackTrace: error?.stack,
      sessionId: this.sessionId,
    };
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, metadata, error);

    // Console logging
    if (this.config.enableConsole) {
      const consoleMethod = level === 'debug' ? 'log' : level;
      console[consoleMethod](this.formatConsoleMessage(entry), error || '');
    }

    // Remote logging (async, non-blocking)
    this.sendToRemote(entry).catch((err) => {
      console.error('Logger remote send failed:', err);
    });

    // Sentry logging
    if (level === 'error') {
      this.sendToSentry(entry);
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log error message with optional Error object
   */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata, error);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config);
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (level, message, metadata, error) => {
      originalLog(level, message, { ...additionalContext, ...metadata }, error);
    };

    return childLogger;
  }

  /**
   * Time a function execution
   */
  async timeAsync<T>(
    label: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const startTime = performance.now();
    this.debug(`Starting: ${label}`, metadata);

    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.info(`Completed: ${label}`, { ...metadata, durationMs: duration.toFixed(2) });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(
        `Failed: ${label}`,
        error instanceof Error ? error : new Error(String(error)),
        { ...metadata, durationMs: duration.toFixed(2) },
      );
      throw error;
    }
  }
}

// Create service-specific loggers
export const createLogger = (serviceName: string, config?: Partial<LoggerConfig>): Logger => {
  return new Logger({
    serviceName,
    ...config,
  });
};

// Pre-configured loggers for common services
export const orderLogger = createLogger('OrderService');
export const invoiceLogger = createLogger('InvoiceService');
export const loyaltyLogger = createLogger('LoyaltyService');
export const authLogger = createLogger('AuthService');
export const driverLogger = createLogger('DriverService');
export const warehouseLogger = createLogger('WarehouseService');
export const auditLogger = createLogger('AuditService');
export const reportLogger = createLogger('ReportService');

// Default logger
export const logger = createLogger('AppService');

// Extend Window interface for Sentry
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: unknown) => void;
    };
  }
}
