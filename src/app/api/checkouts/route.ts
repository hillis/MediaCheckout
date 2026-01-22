import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { addDays } from 'date-fns'
import { getClassroomContext, userHasEquipmentAccess } from '@/lib/classroom-context'
import { canManageCheckouts, canManageAllClassrooms, canCheckoutEquipment } from '@/lib/permissions'

const checkoutSchema = z.object({
  equipmentId: z.string(),
  classroomId: z.string(),
  dueDate: z.string().optional(),
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
    const classroomId = searchParams.get('classroomId')

    // Super admins can see all checkouts without classroom filter
    if (!classroomId && canManageAllClassrooms(session.user.role)) {
      const where: Record<string, unknown> = {}
      if (status && status !== 'all') where.status = status
      if (userId) where.userId = userId

      const checkouts = await prisma.checkout.findMany({
        where,
        include: {
          equipment: {
            select: {
              id: true,
              equipmentId: true,
              name: true,
              category: true,
              photoUrl: true,
              dailyLateFee: true,
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
        orderBy: { checkoutDate: 'desc' },
      })

      return NextResponse.json(checkouts)
    }

    // Classroom-scoped query
    if (!classroomId) {
      // Return user's checkouts across all their classrooms
      const where: Record<string, unknown> = { userId: session.user.id }
      if (status && status !== 'all') where.status = status

      const checkouts = await prisma.checkout.findMany({
        where,
        include: {
          equipment: {
            select: {
              id: true,
              equipmentId: true,
              name: true,
              category: true,
              photoUrl: true,
              dailyLateFee: true,
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
        orderBy: { checkoutDate: 'desc' },
      })

      return NextResponse.json(checkouts)
    }

    const context = await getClassroomContext(session.user.id, session.user.role, classroomId)
    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 403 })
    }

    const where: Record<string, unknown> = { classroomId }

    // Non-managers can only see their own checkouts
    if (!canManageCheckouts(context.userRole, session.user.role)) {
      where.userId = session.user.id
    } else if (userId) {
      where.userId = userId
    }

    if (status && status !== 'all') {
      where.status = status
    }

    const checkouts = await prisma.checkout.findMany({
      where,
      include: {
        equipment: {
          select: {
            id: true,
            equipmentId: true,
            name: true,
            category: true,
            photoUrl: true,
            dailyLateFee: true,
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
      orderBy: { checkoutDate: 'desc' },
    })

    return NextResponse.json(checkouts)
  } catch (error) {
    console.error('Error fetching checkouts:', error)
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
    const validatedData = checkoutSchema.parse(body)

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

    // Find equipment by either internal ID or equipment ID code
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

    if (equipment.status !== 'AVAILABLE') {
      return NextResponse.json({ error: 'Equipment is not available for checkout' }, { status: 400 })
    }

    const dueDate = validatedData.dueDate
      ? new Date(validatedData.dueDate)
      : addDays(new Date(), equipment.maxCheckoutDays)

    // Create checkout and update equipment status in transaction
    const checkout = await prisma.$transaction(async (tx) => {
      const newCheckout = await tx.checkout.create({
        data: {
          equipmentId: equipment.id,
          userId: session.user.id,
          classroomId: validatedData.classroomId,
          dueDate,
          notes: validatedData.notes,
        },
        include: {
          equipment: true,
          user: { select: { name: true, email: true } },
          classroom: { select: { id: true, name: true } },
        },
      })

      await tx.equipment.update({
        where: { id: equipment.id },
        data: { status: 'CHECKED_OUT' },
      })

      return newCheckout
    })

    return NextResponse.json(checkout, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating checkout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
