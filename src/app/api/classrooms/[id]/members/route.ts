import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getClassroomContext } from '@/lib/classroom-context'
import { canManageMembers, canViewClassroom } from '@/lib/permissions'
import { ClassroomRole } from '@prisma/client'

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']).default('STUDENT'),
})

const updateMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']),
})

// GET /api/classrooms/[id]/members - List classroom members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context || !canViewClassroom(context.userRole, session.user.role)) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 404 })
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
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
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
      ? members
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

    return NextResponse.json(allMembers)
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/classrooms/[id]/members - Add a member by email
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 404 })
    }

    if (!canManageMembers(context.userRole, session.user.role, context.isOwner)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { email, role } = addMemberSchema.parse(body)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found with that email' }, { status: 404 })
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
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
    }

    // Check if user is the owner
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (classroom?.ownerId === user.id) {
      return NextResponse.json({ error: 'User is the owner of this classroom' }, { status: 400 })
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

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/classrooms/[id]/members - Update a member's role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 404 })
    }

    if (!canManageMembers(context.userRole, session.user.role, context.isOwner)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role } = updateMemberSchema.parse(body)

    // Can't update own role (unless super admin)
    if (userId === session.user.id && !context.isSuperAdmin) {
      return NextResponse.json({ error: 'Cannot update your own role' }, { status: 400 })
    }

    // Check if user is the owner
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (classroom?.ownerId === userId) {
      return NextResponse.json({ error: 'Cannot change the owner\'s role' }, { status: 400 })
    }

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

    return NextResponse.json(member)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/classrooms/[id]/members?userId=xxx - Remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 404 })
    }

    // Users can remove themselves, or admins can remove others
    const isSelf = userId === session.user.id
    if (!isSelf && !canManageMembers(context.userRole, session.user.role, context.isOwner)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Can't remove the owner
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      select: { ownerId: true },
    })

    if (classroom?.ownerId === userId) {
      return NextResponse.json({ error: 'Cannot remove the classroom owner' }, { status: 400 })
    }

    await prisma.classroomMember.delete({
      where: {
        classroomId_userId: {
          classroomId: id,
          userId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
