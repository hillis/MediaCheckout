import { prisma } from './prisma'

// Characters to use for join codes (excluding confusing ones like 0/O, 1/I/l)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

// Generate a random join code
export function generateJoinCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARS.length)
    code += CODE_CHARS[randomIndex]
  }
  return code
}

// Generate a unique join code (checks database for conflicts)
export async function generateUniqueJoinCode(): Promise<string> {
  const maxAttempts = 10

  for (let i = 0; i < maxAttempts; i++) {
    const code = generateJoinCode()

    // Check if code already exists
    const existing = await prisma.classroom.findUnique({
      where: { joinCode: code },
      select: { id: true },
    })

    if (!existing) {
      return code
    }
  }

  // If we couldn't generate a unique code after max attempts, throw error
  throw new Error('Failed to generate unique join code')
}

// Normalize a join code (uppercase, remove spaces/dashes)
export function normalizeJoinCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '')
}

// Validate join code format
export function isValidJoinCodeFormat(code: string): boolean {
  const normalized = normalizeJoinCode(code)
  if (normalized.length !== CODE_LENGTH) {
    return false
  }
  // Check that all characters are valid
  for (const char of normalized) {
    if (!CODE_CHARS.includes(char)) {
      return false
    }
  }
  return true
}

// Find classroom by join code
export async function findClassroomByJoinCode(code: string) {
  const normalized = normalizeJoinCode(code)

  const classroom = await prisma.classroom.findUnique({
    where: { joinCode: normalized },
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

  if (!classroom) {
    return null
  }

  // Check if classroom is active
  if (!classroom.isActive) {
    return null
  }

  // Check if join code has expired
  if (classroom.joinCodeExpiresAt && classroom.joinCodeExpiresAt < new Date()) {
    return null
  }

  return classroom
}

// Join a classroom using a code
export async function joinClassroomWithCode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string; classroomId?: string }> {
  const classroom = await findClassroomByJoinCode(code)

  if (!classroom) {
    return { success: false, error: 'Invalid or expired join code' }
  }

  // Check if user is already a member
  const existingMembership = await prisma.classroomMember.findUnique({
    where: {
      classroomId_userId: {
        classroomId: classroom.id,
        userId,
      },
    },
  })

  if (existingMembership) {
    return { success: false, error: 'You are already a member of this classroom' }
  }

  // Check if user is the owner (they don't need to join)
  if (classroom.ownerId === userId) {
    return { success: false, error: 'You are the owner of this classroom' }
  }

  // Create membership
  await prisma.classroomMember.create({
    data: {
      classroomId: classroom.id,
      userId,
      role: 'STUDENT', // Default role when joining via code
    },
  })

  return { success: true, classroomId: classroom.id }
}

// Regenerate join code for a classroom
export async function regenerateJoinCode(
  classroomId: string,
  expiresAt?: Date
): Promise<string> {
  const newCode = await generateUniqueJoinCode()

  await prisma.classroom.update({
    where: { id: classroomId },
    data: {
      joinCode: newCode,
      joinCodeExpiresAt: expiresAt || null,
    },
  })

  return newCode
}
