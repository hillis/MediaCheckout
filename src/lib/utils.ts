import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM d, yyyy')
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM d, yyyy h:mm a')
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function isOverdue(dueDate: Date | string): boolean {
  const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  return isPast(d)
}

export function calculateLateFee(dueDate: Date, dailyRate: number): number {
  const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  if (!isPast(d)) return 0
  const daysLate = differenceInDays(new Date(), d)
  return Math.max(0, daysLate * dailyRate)
}

export function getDaysUntilDue(dueDate: Date | string): number {
  const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  return differenceInDays(d, new Date())
}

export const STATUS_COLORS = {
  AVAILABLE: 'bg-green-100 text-green-800',
  CHECKED_OUT: 'bg-blue-100 text-blue-800',
  RESERVED: 'bg-yellow-100 text-yellow-800',
  MAINTENANCE: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  RETURNED: 'bg-gray-100 text-gray-800',
  OVERDUE: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONVERTED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  EXPIRED: 'bg-red-100 text-red-800',
} as const

export const CATEGORY_ICONS = {
  Camera: '📷',
  Lens: '🔭',
  Audio: '🎤',
  Lighting: '💡',
  Grip: '🎥',
  Other: '📦',
} as const

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || CATEGORY_ICONS.Other
}
