import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { canShareEquipment, canManageAllClassrooms } from '@/lib/permissions'

const shareSchema = z.object({
  isShared: z.boolean(),
})

const addToClassroomSchema = z.object({
  classroomId: z.string(),
})

// PATCH /api/equipment/[id]/share - Toggle equipment sharing
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

    // Check permissions
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

    if (classroomRole && !canShareEquipment(classroomRole, session.user.role, isOwner)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { isShared } = shareSchema.parse(body)

    // Update equipment sharing status
    const equipment = await prisma.equipment.update({
      where: { id },
      data: { isShared },
    })

    // If unsharing, remove from all non-primary classrooms
    if (!isShared) {
      await prisma.classroomEquipment.deleteMany({
        where: {
          equipmentId: id,
          isPrimary: false,
        },
      })
    }

    return NextResponse.json(equipment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating equipment sharing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/equipment/[id]/share - Add shared equipment to a classroom
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
    const body = await request.json()
    const { classroomId } = addToClassroomSchema.parse(body)

    // Check if equipment exists and is shared
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { isShared: true },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    if (!equipment.isShared) {
      return NextResponse.json({ error: 'Equipment is not available for sharing' }, { status: 400 })
    }

    // Check if user has permission in target classroom
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { ownerId: true },
    })

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
    }

    const isOwner = classroom.ownerId === session.user.id
    const membership = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId,
          userId: session.user.id,
        },
      },
    })

    const classroomRole = membership?.role || (isOwner ? 'ADMIN' : null)
    if (!classroomRole && !canManageAllClassrooms(session.user.role)) {
      return NextResponse.json({ error: 'Access denied to classroom' }, { status: 403 })
    }

    // Check if already linked
    const existing = await prisma.classroomEquipment.findUnique({
      where: {
        classroomId_equipmentId: {
          classroomId,
          equipmentId: id,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Equipment already in classroom' }, { status: 400 })
    }

    // Add equipment to classroom (non-primary)
    const link = await prisma.classroomEquipment.create({
      data: {
        classroomId,
        equipmentId: id,
        isPrimary: false,
      },
    })

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error adding shared equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/equipment/[id]/share?classroomId=xxx - Remove shared equipment from a classroom
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
    const classroomId = searchParams.get('classroomId')

    if (!classroomId) {
      return NextResponse.json({ error: 'classroomId is required' }, { status: 400 })
    }

    // Check if link exists and is not primary
    const link = await prisma.classroomEquipment.findUnique({
      where: {
        classroomId_equipmentId: {
          classroomId,
          equipmentId: id,
        },
      },
    })

    if (!link) {
      return NextResponse.json({ error: 'Equipment not found in classroom' }, { status: 404 })
    }

    if (link.isPrimary) {
      return NextResponse.json({ error: 'Cannot remove equipment from its owner classroom' }, { status: 400 })
    }

    // Check permissions
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { ownerId: true },
    })

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
    }

    const isOwner = classroom.ownerId === session.user.id
    const membership = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId,
          userId: session.user.id,
        },
      },
    })

    const classroomRole = membership?.role || (isOwner ? 'ADMIN' : null)
    if (!classroomRole && !canManageAllClassrooms(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await prisma.classroomEquipment.delete({
      where: {
        classroomId_equipmentId: {
          classroomId,
          equipmentId: id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing shared equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
