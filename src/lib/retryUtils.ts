/**
 * Retry Utility with Exponential Backoff
 * Handles network failures gracefully for production environments
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: ['NetworkError', 'TimeoutError', 'FetchError', 'AbortError'],
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  // Check error name
  if (retryableErrors.includes(error.name)) {
    return true;
  }

  // Check error message for common network issues
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'network',
    'timeout',
    'fetch',
    'aborted',
    'econnrefused',
    'enotfound',
    'etimedout',
    'failed to fetch',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter (±25%) to prevent thundering herd
  const jitter = clampedDelay * 0.25 * (Math.random() - 0.5);

  return Math.floor(clampedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @example
 * const data = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     return response.json();
 *   },
 *   { maxRetries: 3, onRetry: (attempt, error) => console.log(`Retry ${attempt}:`, error) }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    retryableErrors,
    onRetry,
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if we've exhausted retries
      if (attempt > maxRetries) {
        throw lastError;
      }

      // Don't retry if error is not retryable
      if (!isRetryableError(lastError, retryableErrors)) {
        throw lastError;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Calculate and apply delay
      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Wrapper for Supabase queries with automatic retry
 *
 * @example
 * const { data, error } = await retrySupabaseQuery(
 *   () => supabase.from('orders').select('*')
 * );
 */
export async function retrySupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>,
  options: RetryOptions = {},
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await retryWithBackoff(async () => {
      const { data, error } = await queryFn();

      // Throw error to trigger retry if query failed
      if (error) {
        throw error;
      }

      return { data, error: null };
    }, options);

    return result;
  } catch (error) {
    // Return error in Supabase format
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Batch retry multiple operations
 * Fails fast if any operation fails after retries
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {},
): Promise<T[]> {
  return Promise.all(
    operations.map((op) => retryWithBackoff(op, options))
  );
}

/**
 * Batch retry with individual error handling
 * Returns results with success/failure status for each operation
 */
export async function retryBatchSettled<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {},
): Promise<Array<{ success: boolean; data?: T; error?: Error }>> {
  const results = await Promise.allSettled(
    operations.map((op) => retryWithBackoff(op, options))
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { success: true, data: result.value };
    } else {
      return {
        success: false,
        error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
      };
    }
  });
}
