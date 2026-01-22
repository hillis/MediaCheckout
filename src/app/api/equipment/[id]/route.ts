import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateEquipmentSchema = z.object({
  equipmentId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'CHECKED_OUT', 'RESERVED', 'MAINTENANCE']).optional(),
  dailyLateFee: z.number().min(0).optional(),
  maxCheckoutDays: z.number().min(1).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        checkouts: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { name: true, email: true } } },
        },
        reservations: {
          where: { status: 'PENDING' },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { pickupDate: 'asc' },
        },
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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

    await prisma.equipment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
