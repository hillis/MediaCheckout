/**
 * Unit tests for rate limiting middleware
 */

import {
  checkRateLimit,
  rateLimit,
  RateLimitConfigs,
  getRateLimitHeaders,
} from '@/lib/rate-limit'
import { RateLimitedError } from '@/lib/api-response'
import { NextRequest } from 'next/server'

// Mock NextRequest
function createMockRequest(ip = '127.0.0.1'): NextRequest {
  return {
    headers: {
      get: (key: string) => (key === 'x-forwarded-for' ? ip : null),
    },
    url: 'http://localhost:3000/api/test',
  } as unknown as NextRequest
}

describe('Rate Limiting', () => {
  // Use unique IPs for each test to avoid interference
  let testCounter = 0
  const getUniqueIp = () => `192.168.${Math.floor(testCounter / 256)}.${testCounter++ % 256}`

  describe('checkRateLimit', () => {
    it('allows requests under the limit', () => {
      const ip = getUniqueIp()
      const request = createMockRequest(ip)
      const config = { maxRequests: 5, windowMs: 60000, keyPrefix: 'test1' }

      const result1 = checkRateLimit(request, config)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(4)

      const result2 = checkRateLimit(request, config)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(3)
    })

    it('blocks requests over the limit', () => {
      const ip = getUniqueIp()
      const request = createMockRequest(ip)
      const config = { maxRequests: 2, windowMs: 60000, keyPrefix: 'test2' }

      checkRateLimit(request, config) // 1
      checkRateLimit(request, config) // 2

      const result = checkRateLimit(request, config) // 3 - over limit
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('uses user ID when provided', () => {
      const ip = getUniqueIp()
      const request = createMockRequest(ip)
      const config = { maxRequests: 3, windowMs: 60000, keyPrefix: 'test3' }
      const userId = `user-${Date.now()}`

      // Requests with user ID should be tracked separately from IP
      const result1 = checkRateLimit(request, config, userId)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(2)

      // Same IP without user ID should have separate counter
      const result2 = checkRateLimit(request, { ...config, keyPrefix: 'test3b' })
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(2)
    })

    it('returns correct reset time', () => {
      const ip = getUniqueIp()
      const request = createMockRequest(ip)
      const config = { maxRequests: 5, windowMs: 60000, keyPrefix: 'test4' }

      const result = checkRateLimit(request, config)
      expect(result.resetTime).toBeGreaterThan(Date.now())
      expect(result.resetTime).toBeLessThanOrEqual(Date.now() + config.windowMs)
    })
  })

  describe('rateLimit', () => {
    it('does not throw when under limit', () => {
      const ip = getUniqueIp()
      const request = createMockRequest(ip)
      const config = { maxRequests: 5, windowMs: 60000, keyPrefix: 'test5' }

      expect(() => rateLimit(request, config)).not.toThrow()
    })

    it('throws RateLimitedError when over limit', () => {
      const ip = getUniqueIp()
      const request = createMockRequest(ip)
      const config = { maxRequests: 1, windowMs: 60000, keyPrefix: 'test6' }

      rateLimit(request, config) // First request OK

      expect(() => rateLimit(request, config)).toThrow(RateLimitedError)
    })
  })

  describe('RateLimitConfigs', () => {
    it('has standard config', () => {
      expect(RateLimitConfigs.standard).toEqual({
        maxRequests: 100,
        windowMs: 60000,
      })
    })

    it('has strict config', () => {
      expect(RateLimitConfigs.strict).toEqual({
        maxRequests: 10,
        windowMs: 60000,
      })
    })

    it('has auth config', () => {
      expect(RateLimitConfigs.auth).toEqual({
        maxRequests: 5,
        windowMs: 60000,
      })
    })

    it('has search config', () => {
      expect(RateLimitConfigs.search).toEqual({
        maxRequests: 30,
        windowMs: 60000,
      })
    })
  })

  describe('getRateLimitHeaders', () => {
    it('returns rate limit headers', () => {
      const ip = getUniqueIp()
      const request = createMockRequest(ip)
      const config = { maxRequests: 10, windowMs: 60000, keyPrefix: 'test7' }

      const headers = getRateLimitHeaders(request, config)

      expect(headers['X-RateLimit-Limit']).toBe('10')
      expect(headers['X-RateLimit-Remaining']).toBeDefined()
      expect(headers['X-RateLimit-Reset']).toBeDefined()
    })
  })
})
