import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

/**
 * Equipment filter parameters extracted from request
 */
export interface EquipmentFilterParams {
  category?: string
  status?: string
  search?: string
  classroomId?: string
}

/**
 * Parse equipment filter parameters from request URL
 *
 * @param request - NextRequest object
 * @returns Parsed filter parameters
 */
export function parseEquipmentFilters(request: NextRequest): EquipmentFilterParams {
  const { searchParams } = new URL(request.url)

  return {
    category: searchParams.get('category') || undefined,
    status: searchParams.get('status') || undefined,
    search: searchParams.get('search') || undefined,
    classroomId: searchParams.get('classroomId') || undefined,
  }
}

/**
 * Build Prisma where clause for equipment filtering.
 * This extracts the duplicated filter logic from the equipment route.
 *
 * @param filters - Filter parameters
 * @returns Prisma where clause object
 */
export function buildEquipmentWhereClause(
  filters: EquipmentFilterParams
): Prisma.EquipmentWhereInput {
  const where: Prisma.EquipmentWhereInput = {}
  const conditions: Prisma.EquipmentWhereInput[] = []

  // Category filter
  if (filters.category && filters.category !== 'all') {
    conditions.push({ category: filters.category })
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    conditions.push({ status: filters.status as Prisma.EnumEquipmentStatusFilter })
  }

  // Search filter (name, equipmentId, description)
  if (filters.search) {
    conditions.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { equipmentId: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    })
  }

  if (conditions.length > 0) {
    where.AND = conditions
  }

  return where
}

/**
 * Build filter conditions array for in-memory filtering.
 * Used when we need to filter equipment that's already been fetched.
 *
 * @param filters - Filter parameters
 * @returns Array of filter conditions
 */
export function buildEquipmentFilterConditions(
  filters: EquipmentFilterParams
): Prisma.EquipmentWhereInput[] {
  const conditions: Prisma.EquipmentWhereInput[] = []

  if (filters.category && filters.category !== 'all') {
    conditions.push({ category: filters.category })
  }

  if (filters.status && filters.status !== 'all') {
    conditions.push({ status: filters.status as Prisma.EnumEquipmentStatusFilter })
  }

  if (filters.search) {
    conditions.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { equipmentId: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    })
  }

  return conditions
}

/**
 * In-memory equipment filter function.
 * Filters equipment array based on search parameters.
 *
 * @param equipment - Equipment item to filter
 * @param filters - Filter parameters
 * @returns true if equipment matches filters
 */
export function matchesEquipmentFilters(
  equipment: {
    name: string
    equipmentId: string
    description: string | null
    category: string
    status: string
  },
  filters: EquipmentFilterParams
): boolean {
  // Category filter
  if (filters.category && filters.category !== 'all' && equipment.category !== filters.category) {
    return false
  }

  // Status filter
  if (filters.status && filters.status !== 'all' && equipment.status !== filters.status) {
    return false
  }

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    const matchesName = equipment.name.toLowerCase().includes(searchLower)
    const matchesId = equipment.equipmentId.toLowerCase().includes(searchLower)
    const matchesDescription = equipment.description?.toLowerCase().includes(searchLower) || false

    if (!matchesName && !matchesId && !matchesDescription) {
      return false
    }
  }

  return true
}

/**
 * User filter parameters
 */
export interface UserFilterParams {
  role?: string
  search?: string
}

/**
 * Parse user filter parameters from request URL
 *
 * @param request - NextRequest object
 * @returns Parsed filter parameters
 */
export function parseUserFilters(request: NextRequest): UserFilterParams {
  const { searchParams } = new URL(request.url)

  return {
    role: searchParams.get('role') || undefined,
    search: searchParams.get('search') || undefined,
  }
}

/**
 * Build Prisma where clause for user filtering
 *
 * @param filters - Filter parameters
 * @returns Prisma where clause object
 */
export function buildUserWhereClause(filters: UserFilterParams): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {}
  const conditions: Prisma.UserWhereInput[] = []

  // Role filter
  if (filters.role && filters.role !== 'all') {
    conditions.push({ role: filters.role as Prisma.EnumRoleFilter })
  }

  // Search filter (name, email)
  if (filters.search) {
    conditions.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    })
  }

  if (conditions.length > 0) {
    where.AND = conditions
  }

  return where
}

/**
 * Checkout filter parameters
 */
export interface CheckoutFilterParams {
  status?: string
  userId?: string
  equipmentId?: string
  classroomId?: string
}

/**
 * Parse checkout filter parameters from request URL
 *
 * @param request - NextRequest object
 * @returns Parsed filter parameters
 */
export function parseCheckoutFilters(request: NextRequest): CheckoutFilterParams {
  const { searchParams } = new URL(request.url)

  return {
    status: searchParams.get('status') || undefined,
    userId: searchParams.get('userId') || undefined,
    equipmentId: searchParams.get('equipmentId') || undefined,
    classroomId: searchParams.get('classroomId') || undefined,
  }
}

/**
 * Build Prisma where clause for checkout filtering
 *
 * @param filters - Filter parameters
 * @returns Prisma where clause object
 */
export function buildCheckoutWhereClause(
  filters: CheckoutFilterParams
): Prisma.CheckoutWhereInput {
  const where: Prisma.CheckoutWhereInput = {}

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status as Prisma.EnumCheckoutStatusFilter
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.equipmentId) {
    where.equipmentId = filters.equipmentId
  }

  if (filters.classroomId) {
    where.classroomId = filters.classroomId
  }

  return where
}

/**
 * Classroom filter parameters
 */
export interface ClassroomFilterParams {
  search?: string
  isActive?: boolean
}

/**
 * Parse classroom filter parameters from request URL
 *
 * @param request - NextRequest object
 * @returns Parsed filter parameters
 */
export function parseClassroomFilters(request: NextRequest): ClassroomFilterParams {
  const { searchParams } = new URL(request.url)
  const isActiveParam = searchParams.get('isActive')

  return {
    search: searchParams.get('search') || undefined,
    isActive: isActiveParam !== null ? isActiveParam === 'true' : undefined,
  }
}

/**
 * Build Prisma where clause for classroom filtering
 *
 * @param filters - Filter parameters
 * @returns Prisma where clause object
 */
export function buildClassroomWhereClause(
  filters: ClassroomFilterParams
): Prisma.ClassroomWhereInput {
  const where: Prisma.ClassroomWhereInput = {}

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  return where
}
