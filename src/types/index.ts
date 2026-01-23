import 'next-auth'

/**
 * System-level roles (matches Prisma enum)
 */
export type Role = 'SUPER_ADMIN' | 'TEACHER_ADMIN' | 'TEACHER' | 'STUDENT'

/**
 * Classroom-level roles (matches Prisma enum)
 */
export type ClassroomRole = 'ADMIN' | 'TEACHER' | 'STUDENT'

/**
 * Equipment status (matches Prisma enum)
 */
export type EquipmentStatus = 'AVAILABLE' | 'CHECKED_OUT' | 'RESERVED' | 'MAINTENANCE'

/**
 * Checkout status (matches Prisma enum)
 */
export type CheckoutStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE'

/**
 * Reservation status (matches Prisma enum)
 */
export type ReservationStatus = 'PENDING' | 'CONVERTED' | 'CANCELLED' | 'EXPIRED'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
      totalLateFees: number
    }
  }
}

/**
 * Base classroom type
 */
export type Classroom = {
  id: string
  name: string
  description: string | null
  joinCode: string
  joinCodeExpiresAt: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  ownerId: string
}

/**
 * Base classroom member type
 */
export type ClassroomMember = {
  id: string
  classroomId: string
  userId: string
  role: ClassroomRole
  joinedAt: Date
}

// Classroom with the user's role in that classroom
export type ClassroomWithRole = Classroom & {
  memberRole: ClassroomRole
  isOwner: boolean
  _count?: {
    members: number
    equipment: number
  }
}

// Classroom member with user details
export type ClassroomMemberWithUser = ClassroomMember & {
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: Role
  }
}

// For the classroom selector dropdown
export type ClassroomOption = {
  id: string
  name: string
  role: ClassroomRole
  isOwner: boolean
}

// Classroom context for API operations
export type ClassroomContext = {
  classroomId: string
  userId: string
  userRole: ClassroomRole
  isOwner: boolean
  isSuperAdmin: boolean
}

export type EquipmentWithStatus = {
  id: string
  equipmentId: string
  name: string
  category: string
  description: string | null
  photoUrl: string | null
  status: EquipmentStatus
  dailyLateFee: number
  maxCheckoutDays: number
  isShared: boolean
  createdAt: Date
  updatedAt: Date
  // For multi-classroom context
  isPrimary?: boolean // true if this classroom owns the equipment
  ownerClassroomId?: string
}

export type CheckoutWithDetails = {
  id: string
  equipmentId: string
  userId: string
  classroomId: string
  checkoutDate: Date
  dueDate: Date
  returnDate: Date | null
  lateFeeAmount: number
  status: CheckoutStatus
  notes: string | null
  equipment: {
    id: string
    equipmentId: string
    name: string
    category: string
    photoUrl: string | null
    dailyLateFee: number
  }
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  classroom?: {
    id: string
    name: string
  }
}

export type ReservationWithDetails = {
  id: string
  equipmentId: string
  userId: string
  classroomId: string
  pickupDate: Date
  pickupTime: string
  returnDate: Date
  status: ReservationStatus
  notes: string | null
  equipment: {
    id: string
    equipmentId: string
    name: string
    category: string
    photoUrl: string | null
  }
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  classroom?: {
    id: string
    name: string
  }
}

export type DashboardStats = {
  totalEquipment: number
  availableEquipment: number
  activeCheckouts: number
  overdueCheckouts: number
  pendingReservations: number
  totalLateFees: number
}

export type UserWithStats = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: Role
  totalLateFees: number
  createdAt: Date
  _count: {
    checkouts: number
    reservations: number
  }
}
