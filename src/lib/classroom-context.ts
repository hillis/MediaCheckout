import { prisma } from './prisma'
import { Role, ClassroomRole } from '@prisma/client'
import { ClassroomContext, ClassroomWithRole } from '@/types'
import { isSuperAdmin } from './permissions'

// Get the user's role in a specific classroom
export async function getUserClassroomRole(
  userId: string,
  classroomId: string
): Promise<{ role: ClassroomRole | null; isOwner: boolean }> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { ownerId: true },
  })

  if (!classroom) {
    return { role: null, isOwner: false }
  }

  const isOwner = classroom.ownerId === userId

  const membership = await prisma.classroomMember.findUnique({
    where: {
      classroomId_userId: {
        classroomId,
        userId,
      },
    },
    select: { role: true },
  })

  return {
    role: membership?.role || null,
    isOwner,
  }
}

// Get full classroom context for API operations
export async function getClassroomContext(
  userId: string,
  userSystemRole: Role,
  classroomId: string
): Promise<ClassroomContext | null> {
  // Super admins have access to all classrooms
  if (isSuperAdmin(userSystemRole)) {
    return {
      classroomId,
      userId,
      userRole: 'ADMIN', // Treat super admins as classroom admins
      isOwner: false,
      isSuperAdmin: true,
    }
  }

  const { role, isOwner } = await getUserClassroomRole(userId, classroomId)

  // User is not a member of this classroom
  if (!role && !isOwner) {
    return null
  }

  return {
    classroomId,
    userId,
    userRole: role || 'ADMIN', // Owners without explicit membership are admins
    isOwner,
    isSuperAdmin: false,
  }
}

// Get all classrooms a user is a member of
export async function getUserClassrooms(userId: string): Promise<ClassroomWithRole[]> {
  // Get classrooms where user is the owner
  const ownedClassrooms = await prisma.classroom.findMany({
    where: {
      ownerId: userId,
      isActive: true,
    },
    include: {
      _count: {
        select: {
          members: true,
          equipment: true,
        },
      },
    },
  })

  // Get classrooms where user is a member (but not owner)
  const memberships = await prisma.classroomMember.findMany({
    where: {
      userId,
      classroom: {
        isActive: true,
        ownerId: { not: userId }, // Exclude owned classrooms
      },
    },
    include: {
      classroom: {
        include: {
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

  // Combine and format results
  const classrooms: ClassroomWithRole[] = [
    ...ownedClassrooms.map((c) => ({
      ...c,
      memberRole: 'ADMIN' as ClassroomRole,
      isOwner: true,
    })),
    ...memberships.map((m) => ({
      ...m.classroom,
      memberRole: m.role,
      isOwner: false,
    })),
  ]

  // Sort by name
  return classrooms.sort((a, b) => a.name.localeCompare(b.name))
}

// Get all classrooms (for super admin)
export async function getAllClassrooms(): Promise<ClassroomWithRole[]> {
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

  return classrooms.map((c) => ({
    ...c,
    memberRole: 'ADMIN' as ClassroomRole,
    isOwner: false, // Super admin is not technically the owner
  }))
}

// Get equipment visible to a classroom (owned + shared)
export async function getClassroomEquipment(classroomId: string) {
  // Get equipment directly linked to this classroom
  const classroomEquipment = await prisma.classroomEquipment.findMany({
    where: { classroomId },
    include: {
      equipment: true,
    },
  })

  // Get shared equipment from other classrooms
  const sharedEquipment = await prisma.equipment.findMany({
    where: {
      isShared: true,
      classrooms: {
        some: {
          isPrimary: true,
          classroomId: { not: classroomId },
        },
      },
    },
    include: {
      classrooms: {
        where: { isPrimary: true },
        select: { classroomId: true },
      },
    },
  })

  return {
    owned: classroomEquipment.filter((ce) => ce.isPrimary).map((ce) => ce.equipment),
    borrowed: classroomEquipment.filter((ce) => !ce.isPrimary).map((ce) => ce.equipment),
    availableToShare: sharedEquipment.map((e) => ({
      ...e,
      ownerClassroomId: e.classrooms[0]?.classroomId,
    })),
  }
}

// Check if user has access to a specific piece of equipment through any classroom
export async function userHasEquipmentAccess(
  userId: string,
  equipmentId: string,
  userSystemRole: Role
): Promise<{ hasAccess: boolean; classroomId: string | null }> {
  // Super admins have access to all equipment
  if (isSuperAdmin(userSystemRole)) {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        classrooms: {
          where: { isPrimary: true },
          select: { classroomId: true },
        },
      },
    })
    return {
      hasAccess: !!equipment,
      classroomId: equipment?.classrooms[0]?.classroomId || null,
    }
  }

  // Get user's classrooms
  const userClassroomIds = await prisma.classroomMember
    .findMany({
      where: { userId },
      select: { classroomId: true },
    })
    .then((members) => members.map((m) => m.classroomId))

  // Add owned classrooms
  const ownedClassroomIds = await prisma.classroom
    .findMany({
      where: { ownerId: userId },
      select: { id: true },
    })
    .then((classrooms) => classrooms.map((c) => c.id))

  const allUserClassroomIds = Array.from(new Set([...userClassroomIds, ...ownedClassroomIds]))

  // Check if equipment is in any of user's classrooms
  const equipmentAccess = await prisma.classroomEquipment.findFirst({
    where: {
      equipmentId,
      classroomId: { in: allUserClassroomIds },
    },
    select: { classroomId: true },
  })

  if (equipmentAccess) {
    return { hasAccess: true, classroomId: equipmentAccess.classroomId }
  }

  // Check if equipment is shared and user has any classroom
  const sharedEquipment = await prisma.equipment.findUnique({
    where: {
      id: equipmentId,
      isShared: true,
    },
    include: {
      classrooms: {
        where: { isPrimary: true },
        select: { classroomId: true },
      },
    },
  })

  if (sharedEquipment && allUserClassroomIds.length > 0) {
    return {
      hasAccess: true,
      classroomId: allUserClassroomIds[0], // Use first classroom for context
    }
  }

  return { hasAccess: false, classroomId: null }
}
