import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        equipment: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Non-admins can only view their own reservations
    if (session.user.role !== 'ADMIN' && reservation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(reservation)
  } catch (error) {
    console.error('Error fetching reservation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action } = body

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { equipment: true },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Non-admins can only modify their own reservations
    if (session.user.role !== 'ADMIN' && reservation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (action === 'cancel') {
      if (reservation.status !== 'PENDING') {
        return NextResponse.json({ error: 'Can only cancel pending reservations' }, { status: 400 })
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      return NextResponse.json(updated)
    }

    if (action === 'pickup') {
      if (reservation.status !== 'PENDING') {
        return NextResponse.json({ error: 'Can only pickup pending reservations' }, { status: 400 })
      }

      if (reservation.equipment.status !== 'AVAILABLE') {
        return NextResponse.json({ error: 'Equipment is not available' }, { status: 400 })
      }

      // Convert reservation to checkout
      const result = await prisma.$transaction(async (tx) => {
        // Update reservation status
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: 'CONVERTED' },
        })

        // Create checkout
        const checkout = await tx.checkout.create({
          data: {
            equipmentId: reservation.equipmentId,
            userId: reservation.userId,
            dueDate: reservation.returnDate,
            notes: reservation.notes,
          },
        })

        // Update equipment status
        await tx.equipment.update({
          where: { id: reservation.equipmentId },
          data: { status: 'CHECKED_OUT' },
        })

        return { reservation: updatedReservation, checkout }
      })

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating reservation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Non-admins can only delete their own reservations
    if (session.user.role !== 'ADMIN' && reservation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.reservation.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reservation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
