import { prisma } from './prisma'

const DEFAULT_CLASSROOM_KEY = 'defaultClassroomId'

/**
 * Get the default classroom ID from system settings
 */
export async function getDefaultClassroomId(): Promise<string | null> {
  const setting = await prisma.settings.findUnique({
    where: { key: DEFAULT_CLASSROOM_KEY },
  })
  return setting?.value || null
}

/**
 * Set the default classroom ID in system settings
 */
export async function setDefaultClassroomId(classroomId: string | null): Promise<void> {
  if (classroomId === null) {
    // Remove the setting if null
    await prisma.settings.deleteMany({
      where: { key: DEFAULT_CLASSROOM_KEY },
    })
  } else {
    await prisma.settings.upsert({
      where: { key: DEFAULT_CLASSROOM_KEY },
      update: { value: classroomId },
      create: { key: DEFAULT_CLASSROOM_KEY, value: classroomId },
    })
  }
}

/**
 * Assign a user to the default classroom as a STUDENT
 * Returns true if assignment was made, false if skipped
 */
export async function assignUserToDefaultClassroom(userId: string): Promise<boolean> {
  try {
    // Get the default classroom ID
    const defaultClassroomId = await getDefaultClassroomId()
    if (!defaultClassroomId) {
      // No default configured - silent no-op
      return false
    }

    // Verify classroom exists and is active
    const classroom = await prisma.classroom.findUnique({
      where: { id: defaultClassroomId },
      select: { id: true, isActive: true, ownerId: true },
    })

    if (!classroom || !classroom.isActive) {
      console.log(`Default classroom ${defaultClassroomId} not found or inactive, skipping auto-assignment`)
      return false
    }

    // Skip if user is the classroom owner
    if (classroom.ownerId === userId) {
      return false
    }

    // Check if user is already a member
    const existingMembership = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId: defaultClassroomId,
          userId,
        },
      },
    })

    if (existingMembership) {
      // User already in classroom - skip
      return false
    }

    // Create membership with STUDENT role
    await prisma.classroomMember.create({
      data: {
        classroomId: defaultClassroomId,
        userId,
        role: 'STUDENT',
      },
    })

    console.log(`Auto-assigned user ${userId} to default classroom ${defaultClassroomId}`)
    return true
  } catch (error) {
    console.error('Error assigning user to default classroom:', error)
    return false
  }
}
