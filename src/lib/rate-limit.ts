import { NextRequest } from 'next/server'
import { RateLimitedError } from './api-response'

/**
 * Simple in-memory rate limiter for API routes.
 *
 * Note: This is suitable for single-instance deployments.
 * For production with multiple instances, use Redis or a similar
 * distributed cache.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }

  lastCleanup = now
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Key prefix for namespacing different rate limits */
  keyPrefix?: string
}

/**
 * Default rate limit configurations for different use cases
 */
export const RateLimitConfigs = {
  /** Standard API rate limit: 100 requests per minute */
  standard: { maxRequests: 100, windowMs: 60 * 1000 },
  /** Strict rate limit for sensitive operations: 10 requests per minute */
  strict: { maxRequests: 10, windowMs: 60 * 1000 },
  /** Auth rate limit: 5 requests per minute */
  auth: { maxRequests: 5, windowMs: 60 * 1000 },
  /** Search rate limit: 30 requests per minute */
  search: { maxRequests: 30, windowMs: 60 * 1000 },
} as const

/**
 * Get client identifier from request (IP address or user ID)
 *
 * @param request - NextRequest object
 * @param userId - Optional user ID for authenticated requests
 * @returns Client identifier string
 */
function getClientIdentifier(request: NextRequest, userId?: string): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `ip:${ip}`
}

/**
 * Check if a request is rate limited.
 *
 * @param request - NextRequest object
 * @param config - Rate limit configuration
 * @param userId - Optional user ID for authenticated rate limiting
 * @returns Rate limit result with remaining requests
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RateLimitConfigs.standard,
  userId?: string
): RateLimitResult {
  // Clean up expired entries periodically
  cleanupExpiredEntries()

  const clientId = getClientIdentifier(request, userId)
  const key = `${config.keyPrefix || 'default'}:${clientId}`
  const now = Date.now()

  let entry = rateLimitStore.get(key)

  // Initialize or reset if window has passed
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
  }

  // Increment request count
  entry.count++
  rateLimitStore.set(key, entry)

  const allowed = entry.count <= config.maxRequests
  const remaining = Math.max(0, config.maxRequests - entry.count)

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  }
}

/**
 * Rate limit middleware function.
 * Throws RateLimitedError if rate limit is exceeded.
 *
 * @param request - NextRequest object
 * @param config - Rate limit configuration
 * @param userId - Optional user ID
 * @throws RateLimitedError if rate limit exceeded
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const session = await requireAuth()
 *   rateLimit(request, RateLimitConfigs.strict, session.user.id)
 *   // ... rest of handler
 * }
 */
export function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = RateLimitConfigs.standard,
  userId?: string
): void {
  const result = checkRateLimit(request, config, userId)

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
    throw new RateLimitedError(
      `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
    )
  }
}

/**
 * Decorator-style rate limit check that returns headers for the response.
 * Use this when you want to include rate limit headers in successful responses.
 *
 * @param request - NextRequest object
 * @param config - Rate limit configuration
 * @param userId - Optional user ID
 * @returns Headers object with rate limit information
 */
export function getRateLimitHeaders(
  request: NextRequest,
  config: RateLimitConfig = RateLimitConfigs.standard,
  userId?: string
): Record<string, string> {
  const result = checkRateLimit(request, config, userId)
  const resetTimeSeconds = Math.ceil(result.resetTime / 1000)

  return {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': resetTimeSeconds.toString(),
  }
}
