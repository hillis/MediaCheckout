import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canCreateClassroom } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !canCreateClassroom(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [
      totalEquipment,
      availableEquipment,
      activeCheckouts,
      overdueCheckouts,
      pendingReservations,
      usersWithFees,
    ] = await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
      prisma.checkout.count({ where: { status: 'ACTIVE' } }),
      prisma.checkout.count({
        where: {
          status: 'ACTIVE',
          dueDate: { lt: new Date() },
        },
      }),
      prisma.reservation.count({ where: { status: 'PENDING' } }),
      prisma.user.aggregate({
        _sum: { totalLateFees: true },
      }),
    ])

    // Get recent activity
    const recentCheckouts = await prisma.checkout.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        equipment: { select: { name: true, equipmentId: true } },
        user: { select: { name: true, email: true } },
      },
    })

    const overdueItems = await prisma.checkout.findMany({
      where: {
        status: 'ACTIVE',
        dueDate: { lt: new Date() },
      },
      include: {
        equipment: { select: { name: true, equipmentId: true, dailyLateFee: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json({
      stats: {
        totalEquipment,
        availableEquipment,
        activeCheckouts,
        overdueCheckouts,
        pendingReservations,
        totalLateFees: usersWithFees._sum.totalLateFees || 0,
      },
      recentCheckouts,
      overdueItems,
    })
  } catch (error) {
    console.error('Error fetching dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
