import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getClassroomContext } from '@/lib/classroom-context'
import { canManageMembers, canViewClassroom } from '@/lib/permissions'
import { ClassroomRole } from '@/types'
import {
  handleApiError,
  successResponse,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '@/lib/api-response'
import { requireAuth } from '@/lib/api-middleware'
import { rateLimit, RateLimitConfigs } from '@/lib/rate-limit'
import { AuditLog } from '@/lib/audit-log'

/**
 * Schema for adding a member to a classroom
 */
const addMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']).default('STUDENT'),
})

/**
 * Schema for updating a member's role
 */
const updateMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']),
})

/**
 * GET /api/classrooms/[id]/members
 *
 * List all members of a classroom, including the owner.
 *
 * @param params.id - Classroom ID
 * @returns Array of classroom members with user details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    rateLimit(request, RateLimitConfigs.standard, session.user.id)

    const { id } = await params
    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context || !canViewClassroom(context.userRole, session.user.role)) {
      throw new NotFoundError('Classroom not found or access denied')
    }

    // Get classroom with owner
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    })

    if (!classroom) {
      throw new NotFoundError('Classroom not found')
    }

    // Get all members
    const members = await prisma.classroomMember.findMany({
      where: { classroomId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    })

    // Include owner in the response if they're not already a member
    const ownerIsMember = members.some((m) => m.userId === classroom.ownerId)
    const allMembers = ownerIsMember
      ? members.map((m) => ({ ...m, isOwner: m.userId === classroom.ownerId }))
      : [
          {
            id: 'owner',
            classroomId: id,
            userId: classroom.ownerId,
            role: 'ADMIN' as ClassroomRole,
            joinedAt: classroom.createdAt,
            user: classroom.owner,
            isOwner: true,
          },
          ...members.map((m) => ({ ...m, isOwner: false })),
        ]

    return successResponse(allMembers)
  } catch (error) {
    return handleApiError(error, 'fetching members')
  }
}

/**
 * POST /api/classrooms/[id]/members
 *
 * Add a new member to a classroom by email.
 *
 * @param params.id - Classroom ID
 * @returns Created membership with user details
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    rateLimit(request, RateLimitConfigs.strict, session.user.id)

    const { id } = await params
    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context) {
      throw new NotFoundError('Classroom not found or access denied')
    }

    if (!canManageMembers(context.userRole, session.user.role, context.isOwner)) {
      throw new ForbiddenError('Permission denied to manage members')
    }

    const body = await request.json()
    const { email, role } = addMemberSchema.parse(body)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      throw new NotFoundError('User not found with that email')
    }

    // Check if already a member
    const existingMember = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId: id,
          userId: user.id,
        },
      },
    })

    if (existingMember) {
      throw new ConflictError('User is already a member of this classroom')
    }

    // Check if user is the owner
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (classroom?.ownerId === user.id) {
      throw new BadRequestError('User is the owner of this classroom')
    }

    // Create membership
    const member = await prisma.classroomMember.create({
      data: {
        classroomId: id,
        userId: user.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    })

    // Audit log
    await AuditLog.memberAdded(session.user.id, user.id, id, { email, role })

    return successResponse(member, 201)
  } catch (error) {
    return handleApiError(error, 'adding member')
  }
}

/**
 * PATCH /api/classrooms/[id]/members
 *
 * Update a member's role in the classroom.
 *
 * @param params.id - Classroom ID
 * @returns Updated membership with user details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    rateLimit(request, RateLimitConfigs.strict, session.user.id)

    const { id } = await params
    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context) {
      throw new NotFoundError('Classroom not found or access denied')
    }

    if (!canManageMembers(context.userRole, session.user.role, context.isOwner)) {
      throw new ForbiddenError('Permission denied to manage members')
    }

    const body = await request.json()
    const { userId, role } = updateMemberSchema.parse(body)

    // Can't update own role (unless super admin)
    if (userId === session.user.id && !context.isSuperAdmin) {
      throw new BadRequestError('Cannot update your own role')
    }

    // Check if user is the owner
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (classroom?.ownerId === userId) {
      throw new BadRequestError("Cannot change the owner's role")
    }

    // Get current role for audit
    const currentMember = await prisma.classroomMember.findUnique({
      where: { classroomId_userId: { classroomId: id, userId } },
      select: { role: true },
    })

    const member = await prisma.classroomMember.update({
      where: {
        classroomId_userId: {
          classroomId: id,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    })

    // Audit log
    if (currentMember?.role !== role) {
      await AuditLog.memberRoleChanged(session.user.id, userId, id, {
        fromRole: currentMember?.role || 'UNKNOWN',
        toRole: role,
      })
    }

    return successResponse(member)
  } catch (error) {
    return handleApiError(error, 'updating member')
  }
}

/**
 * DELETE /api/classrooms/[id]/members?userId=xxx
 *
 * Remove a member from the classroom.
 * Users can remove themselves, admins can remove others.
 *
 * @param params.id - Classroom ID
 * @param searchParams.userId - User ID to remove
 * @returns Success confirmation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    rateLimit(request, RateLimitConfigs.strict, session.user.id)

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      throw new BadRequestError('userId parameter is required')
    }

    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context) {
      throw new NotFoundError('Classroom not found or access denied')
    }

    // Users can remove themselves, or admins can remove others
    const isSelf = userId === session.user.id
    if (!isSelf && !canManageMembers(context.userRole, session.user.role, context.isOwner)) {
      throw new ForbiddenError('Permission denied to remove members')
    }

    // Can't remove the owner
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (classroom?.ownerId === userId) {
      throw new BadRequestError('Cannot remove the classroom owner')
    }

    // Get member info for audit before deletion
    const memberToRemove = await prisma.classroomMember.findUnique({
      where: { classroomId_userId: { classroomId: id, userId } },
      include: { user: { select: { email: true } } },
    })

    await prisma.classroomMember.delete({
      where: {
        classroomId_userId: {
          classroomId: id,
          userId,
        },
      },
    })

    // Audit log
    await AuditLog.memberRemoved(session.user.id, userId, id, {
      email: memberToRemove?.user.email || 'Unknown',
    })

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'removing member')
  }
}
