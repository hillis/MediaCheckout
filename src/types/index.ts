import { Role, ClassroomRole, Classroom, ClassroomMember } from '@prisma/client'
import 'next-auth'

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
  status: 'AVAILABLE' | 'CHECKED_OUT' | 'RESERVED' | 'MAINTENANCE'
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
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE'
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
  status: 'PENDING' | 'CONVERTED' | 'CANCELLED' | 'EXPIRED'
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
