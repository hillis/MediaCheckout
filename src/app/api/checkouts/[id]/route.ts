import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'
import { hasSystemAdminRole } from '@/lib/permissions'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    const checkout = await prisma.checkout.findUnique({
      where: { id },
      include: {
        equipment: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    if (!checkout) {
      return NextResponse.json({ error: 'Checkout not found' }, { status: 404 })
    }

    // Non-admins can only view their own checkouts
    if (!hasSystemAdminRole(session.user.role) && checkout.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(checkout)
  } catch (error) {
    console.error('Error fetching checkout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Return equipment
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { action } = body

    const checkout = await prisma.checkout.findUnique({
      where: { id },
      include: { equipment: true },
    })

    if (!checkout) {
      return NextResponse.json({ error: 'Checkout not found' }, { status: 404 })
    }

    // Non-admins can only return their own checkouts
    if (!hasSystemAdminRole(session.user.role) && checkout.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (action === 'return') {
      if (checkout.status !== 'ACTIVE' && checkout.status !== 'OVERDUE') {
        return NextResponse.json({ error: 'Checkout is not active' }, { status: 400 })
      }

      const now = new Date()
      let lateFee = 0

      // Calculate late fee if overdue
      if (now > checkout.dueDate) {
        const daysLate = differenceInDays(now, checkout.dueDate)
        lateFee = daysLate * checkout.equipment.dailyLateFee
      }

      // Update checkout and equipment in transaction
      const updatedCheckout = await prisma.$transaction(async (tx) => {
        const updated = await tx.checkout.update({
          where: { id },
          data: {
            returnDate: now,
            status: 'RETURNED',
            lateFeeAmount: lateFee,
          },
          include: { equipment: true },
        })

        await tx.equipment.update({
          where: { id: checkout.equipmentId },
          data: { status: 'AVAILABLE' },
        })

        // Update user's total late fees if applicable
        if (lateFee > 0) {
          await tx.user.update({
            where: { id: checkout.userId },
            data: { totalLateFees: { increment: lateFee } },
          })
        }

        return updated
      })

      return NextResponse.json(updatedCheckout)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating checkout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
