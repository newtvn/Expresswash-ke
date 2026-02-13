/**
 * Rate Limiter for Supabase Edge Functions
 * Prevents brute force attacks and API abuse
 *
 * Uses an in-memory cache per Edge Function instance.
 * For distributed rate limiting across instances, use Upstash Redis or similar.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage (resets when Edge Function cold starts)
const limitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limitStore.entries()) {
    if (now > entry.resetTime) {
      limitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Optional custom key generator
   * Default: uses IP address
   */
  keyGenerator?: (req: Request) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  req: Request,
  config: RateLimitConfig
): RateLimitResult {
  // Generate unique key for this client
  const key = config.keyGenerator
    ? config.keyGenerator(req)
    : getClientKey(req);

  const now = Date.now();
  const entry = limitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    limitStore.set(key, newEntry);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Increment counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request
 * Uses IP address as default key
 */
function getClientKey(req: Request): string {
  // Try to get real IP from headers (Cloudflare, Vercel, etc.)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    return `ip:${ip}`;
  }

  // Try Cloudflare's CF-Connecting-IP
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) {
    return `ip:${cfIp}`;
  }

  // Try Real-IP header
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return `ip:${realIp}`;
  }

  // Fallback to connection IP
  return 'ip:unknown';
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  };
}

/**
 * Create 429 Too Many Requests response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: HeadersInit = {}
): Response {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...getRateLimitHeaders(result),
        'Retry-After': retryAfter.toString(),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Rate limit middleware for Edge Functions
 *
 * @example
 * serve(async (req) => {
 *   const rateLimitResult = checkRateLimit(req, {
 *     maxRequests: 10,
 *     windowMs: 60 * 1000, // 1 minute
 *   });
 *
 *   if (!rateLimitResult.allowed) {
 *     return createRateLimitResponse(rateLimitResult, corsHeaders);
 *   }
 *
 *   // Process request...
 * });
 */

/**
 * Preset rate limit configurations
 */
export const RATE_LIMITS = {
  // Authentication: 5 attempts per minute
  AUTH: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },

  // Payment: 3 requests per minute
  PAYMENT: {
    maxRequests: 3,
    windowMs: 60 * 1000,
  },

  // General API: 30 requests per minute
  API: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },

  // Public tracking: 60 requests per minute
  PUBLIC: {
    maxRequests: 60,
    windowMs: 60 * 1000,
  },
};

/**
 * Example: User-specific rate limiting (instead of IP-based)
 */
export function getUserKey(userId: string): string {
  return `user:${userId}`;
}

/**
 * Composite rate limiting (IP + User)
 */
export function checkCompositeRateLimit(
  req: Request,
  userId: string | null,
  config: RateLimitConfig
): RateLimitResult {
  // Check IP-based limit first
  const ipLimit = checkRateLimit(req, config);
  if (!ipLimit.allowed) {
    return ipLimit;
  }

  // If user is authenticated, also check user-specific limit
  if (userId) {
    const userLimit = checkRateLimit(req, {
      ...config,
      keyGenerator: () => getUserKey(userId),
    });
    return userLimit;
  }

  return ipLimit;
}
