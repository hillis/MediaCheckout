import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getClassroomContext } from '@/lib/classroom-context'
import { canManageEquipment, canManageAllClassrooms } from '@/lib/permissions'

const equipmentSchema = z.object({
  equipmentId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  dailyLateFee: z.number().min(0).default(5),
  maxCheckoutDays: z.number().min(1).default(7),
  isShared: z.boolean().default(false),
  classroomId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const classroomId = searchParams.get('classroomId')

    // Super admins can see all equipment without classroom filter
    if (!classroomId && canManageAllClassrooms(session.user.role)) {
      const where: Record<string, unknown> = {}
      if (category && category !== 'all') where.category = category
      if (status && status !== 'all') where.status = status
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { equipmentId: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }

      const equipment = await prisma.equipment.findMany({
        where,
        include: {
          classrooms: {
            where: { isPrimary: true },
            include: { classroom: { select: { id: true, name: true } } },
          },
        },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json(
        equipment.map((e) => ({
          ...e,
          ownerClassroom: e.classrooms[0]?.classroom || null,
        }))
      )
    }

    // Classroom-scoped query
    if (!classroomId) {
      return NextResponse.json({ error: 'classroomId is required' }, { status: 400 })
    }

    const context = await getClassroomContext(session.user.id, session.user.role, classroomId)
    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 403 })
    }

    // Build search conditions
    const searchConditions: Record<string, unknown>[] = []
    if (category && category !== 'all') searchConditions.push({ category })
    if (status && status !== 'all') searchConditions.push({ status })
    if (search) {
      searchConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { equipmentId: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    // Get equipment linked to this classroom (owned or borrowed)
    const classroomEquipment = await prisma.classroomEquipment.findMany({
      where: { classroomId },
      include: {
        equipment: true,
      },
    })

    const classroomEquipmentIds = classroomEquipment.map((ce) => ce.equipmentId)

    // Get shared equipment from other classrooms
    const sharedEquipment = await prisma.equipment.findMany({
      where: {
        isShared: true,
        id: { notIn: classroomEquipmentIds },
        classrooms: {
          some: { isPrimary: true },
        },
        ...(searchConditions.length > 0 ? { AND: searchConditions } : {}),
      },
      include: {
        classrooms: {
          where: { isPrimary: true },
          include: { classroom: { select: { id: true, name: true } } },
        },
      },
    })

    // Combine and format results
    const ownedEquipment = classroomEquipment
      .filter((ce) => ce.isPrimary)
      .map((ce) => ({
        ...ce.equipment,
        isPrimary: true,
        ownerClassroomId: classroomId,
      }))
      .filter((e) => {
        if (category && category !== 'all' && e.category !== category) return false
        if (status && status !== 'all' && e.status !== status) return false
        if (search) {
          const s = search.toLowerCase()
          if (
            !e.name.toLowerCase().includes(s) &&
            !e.equipmentId.toLowerCase().includes(s) &&
            !(e.description?.toLowerCase().includes(s))
          )
            return false
        }
        return true
      })

    const borrowedEquipment = classroomEquipment
      .filter((ce) => !ce.isPrimary)
      .map((ce) => ({
        ...ce.equipment,
        isPrimary: false,
        ownerClassroomId: null, // Could fetch if needed
      }))
      .filter((e) => {
        if (category && category !== 'all' && e.category !== category) return false
        if (status && status !== 'all' && e.status !== status) return false
        if (search) {
          const s = search.toLowerCase()
          if (
            !e.name.toLowerCase().includes(s) &&
            !e.equipmentId.toLowerCase().includes(s) &&
            !(e.description?.toLowerCase().includes(s))
          )
            return false
        }
        return true
      })

    const availableShared = sharedEquipment.map((e) => ({
      ...e,
      isPrimary: false,
      isAvailableToAdd: true,
      ownerClassroomId: e.classrooms[0]?.classroomId,
      ownerClassroomName: e.classrooms[0]?.classroom.name,
    }))

    return NextResponse.json({
      owned: ownedEquipment,
      borrowed: borrowedEquipment,
      availableShared,
    })
  } catch (error) {
    console.error('Error fetching equipment:', error)
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
    const validatedData = equipmentSchema.parse(body)

    // Check classroom access and permission
    const context = await getClassroomContext(
      session.user.id,
      session.user.role,
      validatedData.classroomId
    )

    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 403 })
    }

    if (!canManageEquipment(context.userRole, session.user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const existing = await prisma.equipment.findUnique({
      where: { equipmentId: validatedData.equipmentId },
    })

    if (existing) {
      return NextResponse.json({ error: 'Equipment ID already exists' }, { status: 400 })
    }

    // Create equipment and link to classroom in transaction
    const equipment = await prisma.$transaction(async (tx) => {
      const newEquipment = await tx.equipment.create({
        data: {
          equipmentId: validatedData.equipmentId,
          name: validatedData.name,
          category: validatedData.category,
          description: validatedData.description || null,
          photoUrl: validatedData.photoUrl || null,
          dailyLateFee: validatedData.dailyLateFee,
          maxCheckoutDays: validatedData.maxCheckoutDays,
          isShared: validatedData.isShared,
        },
      })

      // Link equipment to classroom as primary owner
      await tx.classroomEquipment.create({
        data: {
          classroomId: validatedData.classroomId,
          equipmentId: newEquipment.id,
          isPrimary: true,
        },
      })

      return newEquipment
    })

    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating equipment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
