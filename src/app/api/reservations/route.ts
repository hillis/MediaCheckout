import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reservationSchema = z.object({
  equipmentId: z.string(),
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

    const where: Record<string, unknown> = {}

    // Non-admins can only see their own reservations
    if (session.user.role !== 'ADMIN') {
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

    // Find equipment
    const equipment = await prisma.equipment.findFirst({
      where: {
        OR: [{ id: validatedData.equipmentId }, { equipmentId: validatedData.equipmentId }],
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
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
        pickupDate,
        pickupTime: validatedData.pickupTime,
        returnDate,
        notes: validatedData.notes,
      },
      include: {
        equipment: true,
        user: { select: { name: true, email: true } },
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
