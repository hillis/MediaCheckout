import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { Role, ClassroomRole } from '@prisma/client'
import { ClassroomContext } from '@/types'
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  handleApiError,
  successResponse,
} from './api-response'
import { canManageEquipment, canManageAllClassrooms, isSuperAdmin } from './permissions'

/**
 * Session with user data from authentication
 */
export interface AuthenticatedSession {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role: Role
    totalLateFees: number
  }
}

/**
 * Equipment access context returned from authorization checks
 */
export interface EquipmentAccessContext {
  session: AuthenticatedSession
  equipment: {
    id: string
    classroomId: string
    classroomOwnerId: string
  }
  classroomRole: ClassroomRole | null
  isClassroomOwner: boolean
  canManage: boolean
}

/**
 * Require authentication for an API route.
 * Throws UnauthorizedError if not authenticated.
 *
 * @returns Authenticated session
 */
export async function requireAuth(): Promise<AuthenticatedSession> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }
  return session as AuthenticatedSession
}

/**
 * Require super admin role for an API route.
 * Throws ForbiddenError if not a super admin.
 *
 * @returns Authenticated session
 */
export async function requireSuperAdmin(): Promise<AuthenticatedSession> {
  const session = await requireAuth()
  if (!isSuperAdmin(session.user.role)) {
    throw new ForbiddenError('Super admin access required')
  }
  return session
}

/**
 * Get classroom context with authentication and authorization.
 * Throws appropriate errors if not authenticated or not authorized.
 *
 * @param classroomId - The classroom ID to get context for
 * @returns Classroom context with session
 */
export async function requireClassroomAccess(
  classroomId: string
): Promise<{ session: AuthenticatedSession; context: ClassroomContext }> {
  const session = await requireAuth()

  // Super admins have access to all classrooms
  if (isSuperAdmin(session.user.role)) {
    return {
      session,
      context: {
        classroomId,
        userId: session.user.id,
        userRole: 'ADMIN',
        isOwner: false,
        isSuperAdmin: true,
      },
    }
  }

  // Check classroom exists and get ownership
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { ownerId: true },
  })

  if (!classroom) {
    throw new NotFoundError('Classroom not found')
  }

  const isOwner = classroom.ownerId === session.user.id

  // Check membership
  const membership = await prisma.classroomMember.findUnique({
    where: {
      classroomId_userId: {
        classroomId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  })

  // User must be owner or member
  if (!membership && !isOwner) {
    throw new ForbiddenError('Access denied to this classroom')
  }

  return {
    session,
    context: {
      classroomId,
      userId: session.user.id,
      userRole: membership?.role || 'ADMIN',
      isOwner,
      isSuperAdmin: false,
    },
  }
}

/**
 * Get equipment access context with full permission checking.
 * This replaces the repeated permission checking pattern across equipment routes.
 *
 * @param equipmentId - The equipment ID to check access for
 * @returns Equipment access context with session and permissions
 */
export async function requireEquipmentAccess(
  equipmentId: string
): Promise<EquipmentAccessContext> {
  const session = await requireAuth()

  // Find the primary classroom for this equipment
  const equipmentClassroom = await prisma.classroomEquipment.findFirst({
    where: { equipmentId, isPrimary: true },
    include: {
      classroom: {
        select: { id: true, ownerId: true },
      },
    },
  })

  if (!equipmentClassroom) {
    throw new NotFoundError('Equipment not found')
  }

  const classroomId = equipmentClassroom.classroomId
  const classroomOwnerId = equipmentClassroom.classroom.ownerId

  // Super admins can manage all equipment
  if (canManageAllClassrooms(session.user.role)) {
    return {
      session,
      equipment: {
        id: equipmentId,
        classroomId,
        classroomOwnerId,
      },
      classroomRole: 'ADMIN',
      isClassroomOwner: false,
      canManage: true,
    }
  }

  // Check if user is the classroom owner
  const isClassroomOwner = classroomOwnerId === session.user.id

  // Check membership in the owner classroom
  const membership = await prisma.classroomMember.findUnique({
    where: {
      classroomId_userId: {
        classroomId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  })

  const classroomRole = membership?.role || (isClassroomOwner ? 'ADMIN' : null)

  // User must have some role in the classroom
  if (!classroomRole) {
    throw new ForbiddenError('Access denied to this equipment')
  }

  const canManage = canManageEquipment(classroomRole, session.user.role)

  return {
    session,
    equipment: {
      id: equipmentId,
      classroomId,
      classroomOwnerId,
    },
    classroomRole,
    isClassroomOwner,
    canManage,
  }
}

/**
 * Require equipment management permission.
 * Throws ForbiddenError if user cannot manage the equipment.
 *
 * @param equipmentId - The equipment ID to check
 * @returns Equipment access context
 */
export async function requireEquipmentManagement(
  equipmentId: string
): Promise<EquipmentAccessContext> {
  const context = await requireEquipmentAccess(equipmentId)

  if (!context.canManage) {
    throw new ForbiddenError('Permission denied to manage this equipment')
  }

  return context
}

/**
 * Wrapper to handle API route with centralized error handling.
 * This provides a cleaner pattern for API routes.
 *
 * @param handler - The async handler function
 * @param context - Optional context string for error logging
 * @returns NextResponse
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withErrorHandler(async () => {
 *     const session = await requireAuth()
 *     const data = await prisma.equipment.findMany()
 *     return successResponse(data)
 *   }, 'fetching equipment')
 * }
 */
export async function withErrorHandler<T>(
  handler: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await handler()
  } catch (error) {
    throw error // Re-throw to be caught by the route's try-catch
  }
}

/**
 * Parse pagination parameters from request URL
 *
 * @param request - NextRequest object
 * @param defaults - Default values for page and limit
 * @returns Pagination parameters
 */
export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export function parsePaginationParams(
  request: NextRequest,
  defaults: { page?: number; limit?: number } = {}
): PaginationParams {
  const { searchParams } = new URL(request.url)

  const page = Math.max(1, parseInt(searchParams.get('page') || String(defaults.page || 1)))
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || String(defaults.limit || 50)))
  )
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Create paginated response
 *
 * @param data - Array of items
 * @param total - Total count of items
 * @param pagination - Pagination parameters used
 * @returns Paginated response object
 */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pagination.limit)
  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasMore: pagination.page < totalPages,
    },
  }
}
