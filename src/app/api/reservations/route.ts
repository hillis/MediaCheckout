import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getClassroomContext, userHasEquipmentAccess } from '@/lib/classroom-context'
import { canManageCheckouts, canManageAllClassrooms, canCheckoutEquipment } from '@/lib/permissions'

const reservationSchema = z.object({
  equipmentId: z.string(),
  classroomId: z.string(),
  pickupDate: z.string(),
  pickupTime: z.string(),
  returnDate: z.string(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const equipmentId = searchParams.get('equipmentId')
    const classroomId = searchParams.get('classroomId')

    // Super admins can see all reservations without classroom filter
    if (!classroomId && canManageAllClassrooms(session.user.role)) {
      const where: Record<string, unknown> = {}
      if (status && status !== 'all') where.status = status
      if (userId) where.userId = userId
      if (equipmentId) where.equipmentId = equipmentId

      const reservations = await prisma.reservation.findMany({
        where,
        include: {
          equipment: {
            select: {
              id: true,
              equipmentId: true,
              name: true,
              category: true,
              photoUrl: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          classroom: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { pickupDate: 'asc' },
      })

      return NextResponse.json(reservations)
    }

    // Classroom-scoped query
    if (!classroomId) {
      // Return user's reservations across all their classrooms
      const where: Record<string, unknown> = { userId: session.user.id }
      if (status && status !== 'all') where.status = status
      if (equipmentId) where.equipmentId = equipmentId

      const reservations = await prisma.reservation.findMany({
        where,
        include: {
          equipment: {
            select: {
              id: true,
              equipmentId: true,
              name: true,
              category: true,
              photoUrl: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          classroom: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { pickupDate: 'asc' },
      })

      return NextResponse.json(reservations)
    }

    const context = await getClassroomContext(session.user.id, session.user.role, classroomId)
    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 403 })
    }

    const where: Record<string, unknown> = { classroomId }

    // Non-managers can only see their own reservations
    if (!canManageCheckouts(context.userRole, session.user.role)) {
      where.userId = session.user.id
    } else if (userId) {
      where.userId = userId
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (equipmentId) {
      where.equipmentId = equipmentId
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        equipment: {
          select: {
            id: true,
            equipmentId: true,
            name: true,
            category: true,
            photoUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { pickupDate: 'asc' },
    })

    return NextResponse.json(reservations)
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = reservationSchema.parse(body)

    // Check classroom access
    const context = await getClassroomContext(
      session.user.id,
      session.user.role,
      validatedData.classroomId
    )

    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 403 })
    }

    if (!canCheckoutEquipment(context.userRole, session.user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Find equipment
    const equipment = await prisma.equipment.findFirst({
      where: {
        OR: [{ id: validatedData.equipmentId }, { equipmentId: validatedData.equipmentId }],
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    // Verify equipment is accessible from this classroom
    const access = await userHasEquipmentAccess(session.user.id, equipment.id, session.user.role)
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Equipment not available in this classroom' }, { status: 403 })
    }

    const pickupDate = new Date(validatedData.pickupDate)
    const returnDate = new Date(validatedData.returnDate)

    // Check for conflicting reservations
    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        equipmentId: equipment.id,
        status: 'PENDING',
        OR: [
          {
            AND: [{ pickupDate: { lte: pickupDate } }, { returnDate: { gte: pickupDate } }],
          },
          {
            AND: [{ pickupDate: { lte: returnDate } }, { returnDate: { gte: returnDate } }],
          },
          {
            AND: [{ pickupDate: { gte: pickupDate } }, { returnDate: { lte: returnDate } }],
          },
        ],
      },
    })

    if (conflictingReservation) {
      return NextResponse.json(
        { error: 'Equipment is already reserved for this time period' },
        { status: 400 }
      )
    }

    const reservation = await prisma.reservation.create({
      data: {
        equipmentId: equipment.id,
        userId: session.user.id,
        classroomId: validatedData.classroomId,
        pickupDate,
        pickupTime: validatedData.pickupTime,
        returnDate,
        notes: validatedData.notes,
      },
      include: {
        equipment: true,
        user: { select: { name: true, email: true } },
        classroom: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(reservation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating reservation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
