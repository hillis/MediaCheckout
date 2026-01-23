import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/**
 * Standardized API response types for consistent error handling across all routes.
 */

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: unknown
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: ApiError
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Custom error classes for specific error types
 */
export class ApiException extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiException'
  }
}

export class UnauthorizedError extends ApiException {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends ApiException {
  constructor(message = 'Permission denied') {
    super('FORBIDDEN', message, 403)
  }
}

export class NotFoundError extends ApiException {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404)
  }
}

export class BadRequestError extends ApiException {
  constructor(message = 'Invalid request', details?: unknown) {
    super('BAD_REQUEST', message, 400, details)
  }
}

export class ConflictError extends ApiException {
  constructor(message = 'Resource already exists') {
    super('CONFLICT', message, 409)
  }
}

export class RateLimitedError extends ApiException {
  constructor(message = 'Too many requests') {
    super('RATE_LIMITED', message, 429)
  }
}

/**
 * Response helper functions
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status }
  )
}

/**
 * Centralized error handler for API routes.
 * Handles different error types and returns appropriate responses.
 *
 * @param error - The error to handle
 * @param context - Optional context string for logging (e.g., 'creating equipment')
 * @returns NextResponse with appropriate error structure
 */
export function handleApiError(
  error: unknown,
  context?: string
): NextResponse<ApiErrorResponse> {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }))
    return errorResponse('VALIDATION_ERROR', 'Validation failed', 400, formattedErrors)
  }

  // Handle custom API exceptions
  if (error instanceof ApiException) {
    return errorResponse(error.code, error.message, error.statusCode, error.details)
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: { target?: string[] } }

    // Unique constraint violation
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target?.join(', ') || 'field'
      return errorResponse('CONFLICT', `A record with this ${target} already exists`, 409)
    }

    // Record not found
    if (prismaError.code === 'P2025') {
      return errorResponse('NOT_FOUND', 'Record not found', 404)
    }

    // Foreign key constraint failed
    if (prismaError.code === 'P2003') {
      return errorResponse('BAD_REQUEST', 'Related record not found', 400)
    }
  }

  // Log unexpected errors
  const contextStr = context ? ` while ${context}` : ''
  console.error(`Unexpected error${contextStr}:`, error)

  // Return generic error for unhandled cases
  return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500)
}

/**
 * Type guard to check if a response is an error response
 */
export function isApiError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return !response.success
}

/**
 * Helper to parse request body with error handling
 */
export async function parseRequestBody<T>(
  request: Request,
  maxSize = 1024 * 1024 // 1MB default
): Promise<T> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new BadRequestError('Request body too large')
  }

  try {
    return await request.json()
  } catch {
    throw new BadRequestError('Invalid JSON in request body')
  }
}
