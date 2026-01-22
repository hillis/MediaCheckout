import { Role } from '@prisma/client'
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
  createdAt: Date
  updatedAt: Date
}

export type CheckoutWithDetails = {
  id: string
  equipmentId: string
  userId: string
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
}

export type ReservationWithDetails = {
  id: string
  equipmentId: string
  userId: string
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
