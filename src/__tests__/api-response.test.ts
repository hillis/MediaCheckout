/**
 * Unit tests for API response utilities
 */

import { NextResponse } from 'next/server'
import {
  ApiException,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  ConflictError,
  RateLimitedError,
  successResponse,
  errorResponse,
  handleApiError,
  isApiError,
  parseRequestBody,
} from '@/lib/api-response'
import { z, ZodError } from 'zod'

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      body: data,
      status: options?.status || 200,
    })),
  },
}))

describe('API Response Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Custom Error Classes', () => {
    describe('UnauthorizedError', () => {
      it('creates error with default message', () => {
        const error = new UnauthorizedError()
        expect(error.message).toBe('Authentication required')
        expect(error.code).toBe('UNAUTHORIZED')
        expect(error.statusCode).toBe(401)
      })

      it('creates error with custom message', () => {
        const error = new UnauthorizedError('Custom auth error')
        expect(error.message).toBe('Custom auth error')
      })
    })

    describe('ForbiddenError', () => {
      it('creates error with default message', () => {
        const error = new ForbiddenError()
        expect(error.message).toBe('Permission denied')
        expect(error.code).toBe('FORBIDDEN')
        expect(error.statusCode).toBe(403)
      })
    })

    describe('NotFoundError', () => {
      it('creates error with default message', () => {
        const error = new NotFoundError()
        expect(error.message).toBe('Resource not found')
        expect(error.code).toBe('NOT_FOUND')
        expect(error.statusCode).toBe(404)
      })
    })

    describe('BadRequestError', () => {
      it('creates error with default message', () => {
        const error = new BadRequestError()
        expect(error.message).toBe('Invalid request')
        expect(error.code).toBe('BAD_REQUEST')
        expect(error.statusCode).toBe(400)
      })

      it('creates error with details', () => {
        const details = { field: 'email', issue: 'invalid format' }
        const error = new BadRequestError('Validation failed', details)
        expect(error.details).toEqual(details)
      })
    })

    describe('ConflictError', () => {
      it('creates error with default message', () => {
        const error = new ConflictError()
        expect(error.message).toBe('Resource already exists')
        expect(error.code).toBe('CONFLICT')
        expect(error.statusCode).toBe(409)
      })
    })

    describe('RateLimitedError', () => {
      it('creates error with default message', () => {
        const error = new RateLimitedError()
        expect(error.message).toBe('Too many requests')
        expect(error.code).toBe('RATE_LIMITED')
        expect(error.statusCode).toBe(429)
      })
    })
  })

  describe('Response Helpers', () => {
    describe('successResponse', () => {
      it('creates success response with default status', () => {
        const data = { id: 1, name: 'Test' }
        successResponse(data)

        expect(NextResponse.json).toHaveBeenCalledWith(
          { success: true, data },
          { status: 200 }
        )
      })

      it('creates success response with custom status', () => {
        const data = { id: 1 }
        successResponse(data, 201)

        expect(NextResponse.json).toHaveBeenCalledWith(
          { success: true, data },
          { status: 201 }
        )
      })
    })

    describe('errorResponse', () => {
      it('creates error response', () => {
        errorResponse('NOT_FOUND', 'Resource not found', 404)

        expect(NextResponse.json).toHaveBeenCalledWith(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Resource not found', details: undefined },
          },
          { status: 404 }
        )
      })

      it('creates error response with details', () => {
        const details = { field: 'email' }
        errorResponse('VALIDATION_ERROR', 'Validation failed', 400, details)

        expect(NextResponse.json).toHaveBeenCalledWith(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
          },
          { status: 400 }
        )
      })
    })
  })

  describe('handleApiError', () => {
    it('handles ZodError', () => {
      const schema = z.object({ email: z.string().email() })
      let zodError: ZodError | null = null

      try {
        schema.parse({ email: 'invalid' })
      } catch (e) {
        zodError = e as ZodError
      }

      handleApiError(zodError!)

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
          }),
        }),
        { status: 400 }
      )
    })

    it('handles ApiException', () => {
      const error = new ForbiddenError('Custom forbidden')
      handleApiError(error)

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Custom forbidden', details: undefined },
        },
        { status: 403 }
      )
    })

    it('handles Prisma unique constraint error (P2002)', () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: ['email'] },
      }
      handleApiError(prismaError)

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONFLICT',
          }),
        }),
        { status: 409 }
      )
    })

    it('handles Prisma record not found error (P2025)', () => {
      const prismaError = { code: 'P2025' }
      handleApiError(prismaError)

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        }),
        { status: 404 }
      )
    })

    it('handles unknown errors', () => {
      const error = new Error('Unknown error')
      handleApiError(error, 'test operation')

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: undefined,
          },
        },
        { status: 500 }
      )
    })
  })

  describe('isApiError', () => {
    it('returns true for error response', () => {
      const response = { success: false as const, error: { code: 'NOT_FOUND' as const, message: 'Not found' } }
      expect(isApiError(response)).toBe(true)
    })

    it('returns false for success response', () => {
      const response = { success: true as const, data: { id: 1 } }
      expect(isApiError(response)).toBe(false)
    })
  })

  describe('parseRequestBody', () => {
    it('parses valid JSON', async () => {
      const mockRequest = {
        headers: new Map([['content-length', '50']]),
        json: jest.fn().mockResolvedValue({ name: 'Test' }),
      }

      const result = await parseRequestBody(mockRequest as any)
      expect(result).toEqual({ name: 'Test' })
    })

    it('throws BadRequestError for oversized body', async () => {
      const mockRequest = {
        headers: {
          get: (key: string) => (key === 'content-length' ? '2000000' : null),
        },
        json: jest.fn(),
      }

      await expect(parseRequestBody(mockRequest as any, 1024 * 1024)).rejects.toThrow(
        BadRequestError
      )
    })

    it('throws BadRequestError for invalid JSON', async () => {
      const mockRequest = {
        headers: {
          get: () => null,
        },
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      }

      await expect(parseRequestBody(mockRequest as any)).rejects.toThrow(BadRequestError)
    })
  })
})
