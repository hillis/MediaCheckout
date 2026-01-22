import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { userHasEquipmentAccess } from '@/lib/classroom-context'
import { canManageEquipment, canManageAllClassrooms } from '@/lib/permissions'

const updateEquipmentSchema = z.object({
  equipmentId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'CHECKED_OUT', 'RESERVED', 'MAINTENANCE']).optional(),
  dailyLateFee: z.number().min(0).optional(),
  maxCheckoutDays: z.number().min(1).optional(),
  isShared: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if user has access to this equipment
    const access = await userHasEquipmentAccess(session.user.id, id, session.user.role)
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Equipment not found or access denied' }, { status: 404 })
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        checkouts: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { name: true, email: true } },
            classroom: { select: { id: true, name: true } },
          },
        },
        reservations: {
          where: { status: 'PENDING' },
          include: {
            user: { select: { name: true, email: true } },
            classroom: { select: { id: true, name: true } },
          },
          orderBy: { pickupDate: 'asc' },
        },
        classrooms: {
          include: {
            classroom: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    // Find the primary (owner) classroom
    const primaryClassroom = equipment.classrooms.find((c) => c.isPrimary)

    return NextResponse.json({
      ...equipment,
      ownerClassroomId: primaryClassroom?.classroomId,
      ownerClassroomName: primaryClassroom?.classroom.name,
    })
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Find the primary classroom for this equipment
    const equipmentClassroom = await prisma.classroomEquipment.findFirst({
      where: { equipmentId: id, isPrimary: true },
      include: {
        classroom: true,
      },
    })

    if (!equipmentClassroom) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    // Check if user can manage equipment in the owner classroom
    const isOwner = equipmentClassroom.classroom.ownerId === session.user.id
    const membership = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId: equipmentClassroom.classroomId,
          userId: session.user.id,
        },
      },
    })

    const classroomRole = membership?.role || (isOwner ? 'ADMIN' : null)
    if (!classroomRole && !canManageAllClassrooms(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (classroomRole && !canManageEquipment(classroomRole, session.user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateEquipmentSchema.parse(body)

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        ...validatedData,
        photoUrl: validatedData.photoUrl === '' ? null : validatedData.photoUrl,
      },
    })

    return NextResponse.json(equipment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Find the primary classroom for this equipment
    const equipmentClassroom = await prisma.classroomEquipment.findFirst({
      where: { equipmentId: id, isPrimary: true },
      include: {
        classroom: true,
      },
    })

    if (!equipmentClassroom) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    // Check if user can manage equipment in the owner classroom
    const isOwner = equipmentClassroom.classroom.ownerId === session.user.id
    const membership = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId: equipmentClassroom.classroomId,
          userId: session.user.id,
        },
      },
    })

    const classroomRole = membership?.role || (isOwner ? 'ADMIN' : null)
    if (!classroomRole && !canManageAllClassrooms(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (classroomRole && !canManageEquipment(classroomRole, session.user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Check for active checkouts
    const activeCheckouts = await prisma.checkout.count({
      where: { equipmentId: id, status: 'ACTIVE' },
    })

    if (activeCheckouts > 0) {
      return NextResponse.json(
        { error: 'Cannot delete equipment with active checkouts' },
        { status: 400 }
      )
    }

    // Delete equipment and all classroom links
    await prisma.$transaction([
      prisma.classroomEquipment.deleteMany({ where: { equipmentId: id } }),
      prisma.equipment.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
