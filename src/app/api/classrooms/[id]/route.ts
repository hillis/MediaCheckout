import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getClassroomContext } from '@/lib/classroom-context'
import { canChangeClassroomSettings, canDeleteClassroom, canPermanentlyDeleteClassroom } from '@/lib/permissions'

const updateClassroomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/classrooms/[id] - Get classroom details
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

    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 404 })
    }

    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        _count: {
          select: {
            members: true,
            equipment: true,
            checkouts: true,
            reservations: true,
          },
        },
      },
    })

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
    }

    // Include join code only for admins/owners
    const canSeeJoinCode = canChangeClassroomSettings(context.userRole, session.user.role, context.isOwner)

    return NextResponse.json({
      ...classroom,
      joinCode: canSeeJoinCode ? classroom.joinCode : undefined,
      joinCodeExpiresAt: canSeeJoinCode ? classroom.joinCodeExpiresAt : undefined,
      memberRole: context.userRole,
      isOwner: context.isOwner,
    })
  } catch (error) {
    console.error('Error fetching classroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/classrooms/[id] - Update classroom
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

    if (!canChangeClassroomSettings(context.userRole, session.user.role, context.isOwner)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateClassroomSchema.parse(body)

    const classroom = await prisma.classroom.update({
      where: { id },
      data: validatedData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            equipment: true,
          },
        },
      },
    })

    return NextResponse.json(classroom)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating classroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/classrooms/[id] - Delete (deactivate) or permanently delete classroom
// Query params: permanent=true for hard delete (SUPER_ADMIN only, must be archived)
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
    const permanent = searchParams.get('permanent') === 'true'

    const classroom = await prisma.classroom.findUnique({
      where: { id },
      select: {
        ownerId: true,
        isActive: true,
        _count: {
          select: {
            checkouts: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      },
    })

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
    }

    const isOwner = classroom.ownerId === session.user.id

    // Handle permanent deletion
    if (permanent) {
      if (!canPermanentlyDeleteClassroom(session.user.role)) {
        return NextResponse.json({ error: 'Only super admins can permanently delete classrooms' }, { status: 403 })
      }

      if (classroom.isActive) {
        return NextResponse.json({ error: 'Classroom must be archived before permanent deletion' }, { status: 400 })
      }

      if (classroom._count.checkouts > 0) {
        return NextResponse.json({
          error: 'Cannot delete classroom with active checkouts',
          activeCheckouts: classroom._count.checkouts
        }, { status: 400 })
      }

      // Get counts of affected records for response
      const affectedCounts = await prisma.$transaction(async (tx) => {
        const members = await tx.classroomMember.count({ where: { classroomId: id } })
        const equipment = await tx.classroomEquipment.count({ where: { classroomId: id } })
        const reservations = await tx.reservation.count({
          where: { classroomId: id, status: 'PENDING' }
        })

        // Cancel pending reservations
        await tx.reservation.updateMany({
          where: { classroomId: id, status: 'PENDING' },
          data: { status: 'CANCELLED' }
        })

        // Delete classroom (cascades members, equipment links, settings)
        await tx.classroom.delete({ where: { id } })

        return { members, equipment, reservations }
      })

      return NextResponse.json({
        success: true,
        permanent: true,
        affected: affectedCounts
      })
    }

    // Handle soft delete (archive)
    if (!canDeleteClassroom(session.user.role, isOwner)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Soft delete - mark as inactive
    await prisma.classroom.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting classroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
