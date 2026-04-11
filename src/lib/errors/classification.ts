/**
 * Error classification utilities for better monitoring and error handling.
 */

export enum ErrorType {
  NETWORK = 'network',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  INTERNAL = 'internal',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ClassifiedError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Classify an error based on its properties and message
 */
export function classifyError(error: Error | unknown): ClassifiedError {
  const timestamp = new Date();
  const message = error instanceof Error ? error.message : String(error);

  // Network errors
  if (message.includes('ECONNREFUSED') || 
      message.includes('ETIMEDOUT') || 
      message.includes('ENOTFOUND') ||
      message.includes('fetch failed') ||
      message.includes('network')) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.HIGH,
      message,
      timestamp,
    };
  }

  // Database errors
  if (message.includes('database') || 
      message.includes('connection') || 
      message.includes('prisma') ||
      message.includes('unique constraint') ||
      message.includes('foreign key')) {
    return {
      type: ErrorType.DATABASE,
      severity: ErrorSeverity.CRITICAL,
      message,
      timestamp,
    };
  }

  // Rate limit errors
  if (message.includes('rate limit') || 
      message.includes('429') || 
      message.includes('too many requests')) {
    return {
      type: ErrorType.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      message,
      timestamp,
    };
  }

  // Validation errors
  if (message.includes('validation') || 
      message.includes('invalid') || 
      message.includes('required')) {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      message,
      timestamp,
    };
  }

  // Authentication errors
  if (message.includes('unauthorized') || 
      message.includes('401') || 
      message.includes('authentication')) {
    return {
      type: ErrorType.AUTHENTICATION,
      severity: ErrorSeverity.MEDIUM,
      message,
      timestamp,
    };
  }

  // Authorization errors
  if (message.includes('forbidden') || 
      message.includes('403') || 
      message.includes('authorization')) {
    return {
      type: ErrorType.AUTHORIZATION,
      severity: ErrorSeverity.MEDIUM,
      message,
      timestamp,
    };
  }

  // Not found errors
  if (message.includes('not found') || 
      message.includes('404')) {
    return {
      type: ErrorType.NOT_FOUND,
      severity: ErrorSeverity.LOW,
      message,
      timestamp,
    };
  }

  // External API errors
  if (message.includes('api') || 
      message.includes('external')) {
    return {
      type: ErrorType.EXTERNAL_API,
      severity: ErrorSeverity.HIGH,
      message,
      timestamp,
    };
  }

  // Default to internal error
  return {
    type: ErrorType.INTERNAL,
    severity: ErrorSeverity.MEDIUM,
    message,
    timestamp,
  };
}

/**
 * Create a classified error with additional context
 */
export function createClassifiedError(
  type: ErrorType,
  message: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: Record<string, unknown>
): ClassifiedError {
  return {
    type,
    severity,
    message,
    context,
    timestamp: new Date(),
  };
}

/**
 * Check if an error is critical and should trigger alerts
 */
export function isCriticalError(error: ClassifiedError): boolean {
  return error.severity === ErrorSeverity.CRITICAL;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: ClassifiedError): boolean {
  return [
    ErrorType.NETWORK,
    ErrorType.EXTERNAL_API,
    ErrorType.DATABASE,
    ErrorType.RATE_LIMIT,
  ].includes(error.type);
}
