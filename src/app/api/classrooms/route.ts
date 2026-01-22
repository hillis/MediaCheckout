import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { generateUniqueJoinCode } from '@/lib/join-code'
import { canCreateClassroom, canManageAllClassrooms } from '@/lib/permissions'

const createClassroomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

// GET /api/classrooms - List classrooms (super admin sees all, others see their own)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Super admins can see all classrooms
    if (canManageAllClassrooms(session.user.role)) {
      const classrooms = await prisma.classroom.findMany({
        where: { isActive: true },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              members: true,
              equipment: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json(classrooms)
    }

    // For non-super admins, return their classrooms (owned + member)
    const userId = session.user.id

    // Get owned classrooms
    const ownedClassrooms = await prisma.classroom.findMany({
      where: {
        ownerId: userId,
        isActive: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            equipment: true,
          },
        },
      },
    })

    // Get member classrooms
    const memberships = await prisma.classroomMember.findMany({
      where: {
        userId,
        classroom: {
          isActive: true,
          ownerId: { not: userId },
        },
      },
      include: {
        classroom: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                members: true,
                equipment: true,
              },
            },
          },
        },
      },
    })

    const classrooms = [
      ...ownedClassrooms.map((c) => ({ ...c, memberRole: 'ADMIN', isOwner: true })),
      ...memberships.map((m) => ({ ...m.classroom, memberRole: m.role, isOwner: false })),
    ].sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(classrooms)
  } catch (error) {
    console.error('Error fetching classrooms:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/classrooms - Create a new classroom
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only teachers and above can create classrooms
    if (!canCreateClassroom(session.user.role)) {
      return NextResponse.json({ error: 'Only teachers can create classrooms' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createClassroomSchema.parse(body)

    // Generate unique join code
    const joinCode = await generateUniqueJoinCode()

    // Create the classroom
    const classroom = await prisma.classroom.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        joinCode,
        ownerId: session.user.id,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            equipment: true,
          },
        },
      },
    })

    return NextResponse.json(classroom, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating classroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
