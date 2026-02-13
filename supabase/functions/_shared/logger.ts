/**
 * Secure Logger for Supabase Edge Functions
 * Masks PII (Personally Identifiable Information) before logging
 */

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Mask phone number: 254712345678 -> 254****5678
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '[empty]';
  const str = String(phone);
  if (str.length < 8) return '***';
  return str.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
}

/**
 * Mask email: user@example.com -> u***@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '[empty]';
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

/**
 * Mask amount: 5000.50 -> ***
 */
export function maskAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '[empty]';
  return '***';
}

/**
 * Mask transaction ID: QGH7XYZ123 -> QGH7***
 */
export function maskTransactionId(txId: string | null | undefined): string {
  if (!txId) return '[empty]';
  const str = String(txId);
  if (str.length <= 4) return '***';
  return str.substring(0, 4) + '***';
}

/**
 * Redact sensitive fields from an object
 */
export function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Redact phone numbers
    if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
      redacted[key] = maskPhone(value as string);
    }
    // Redact emails
    else if (lowerKey.includes('email')) {
      redacted[key] = maskEmail(value as string);
    }
    // Redact amounts
    else if (lowerKey.includes('amount') || lowerKey.includes('price') || lowerKey.includes('total')) {
      redacted[key] = maskAmount(value as number);
    }
    // Redact transaction IDs
    else if (lowerKey.includes('transaction') || lowerKey.includes('receipt')) {
      redacted[key] = maskTransactionId(value as string);
    }
    // Redact passwords, secrets, tokens
    else if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('key')
    ) {
      redacted[key] = '***REDACTED***';
    }
    // Keep safe fields
    else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Safe logger that automatically redacts PII
 */
export const logger = {
  info(message: string, context?: LogContext) {
    const safe = context ? redactSensitiveData(context) : {};
    console.log(`[INFO] ${message}`, safe);
  },

  warn(message: string, context?: LogContext) {
    const safe = context ? redactSensitiveData(context) : {};
    console.warn(`[WARN] ${message}`, safe);
  },

  error(message: string, context?: LogContext) {
    const safe = context ? redactSensitiveData(context) : {};
    console.error(`[ERROR] ${message}`, safe);
  },

  debug(message: string, context?: LogContext) {
    const safe = context ? redactSensitiveData(context) : {};
    console.debug(`[DEBUG] ${message}`, safe);
  },
};

/**
 * Example usage:
 *
 * logger.info('Payment initiated', {
 *   phoneNumber: '254712345678',  // Will be masked
 *   amount: 5000,                  // Will be masked
 *   orderId: 'abc-123',           // Safe, not masked
 * });
 *
 * Output: [INFO] Payment initiated { phoneNumber: '254****5678', amount: '***', orderId: 'abc-123' }
 */
