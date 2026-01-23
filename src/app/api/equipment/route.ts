import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getClassroomContext } from '@/lib/classroom-context'
import { canManageEquipment, canManageAllClassrooms } from '@/lib/permissions'
import {
  handleApiError,
  successResponse,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from '@/lib/api-response'
import {
  requireAuth,
  parsePaginationParams,
  paginatedResponse,
} from '@/lib/api-middleware'
import {
  parseEquipmentFilters,
  buildEquipmentWhereClause,
  matchesEquipmentFilters,
} from '@/lib/query-helpers'
import { rateLimit, RateLimitConfigs } from '@/lib/rate-limit'
import { AuditLog } from '@/lib/audit-log'

/**
 * Zod schema for equipment creation
 */
const equipmentSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  photoUrl: z.string().url('Invalid photo URL').optional().or(z.literal('')),
  dailyLateFee: z.number().min(0, 'Daily late fee must be positive').default(5),
  maxCheckoutDays: z.number().min(1, 'Max checkout days must be at least 1').default(7),
  isShared: z.boolean().default(false),
  classroomId: z.string().min(1, 'Classroom ID is required'),
})

/**
 * GET /api/equipment
 *
 * Fetch equipment list with optional filtering and pagination.
 *
 * Query parameters:
 * - classroomId: Required (except for super admins)
 * - category: Filter by category
 * - status: Filter by status
 * - search: Search in name, equipmentId, description
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 *
 * @returns Equipment list with pagination info
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    rateLimit(request, RateLimitConfigs.standard, session.user.id)

    const filters = parseEquipmentFilters(request)
    const pagination = parsePaginationParams(request)

    // Super admins can see all equipment without classroom filter
    if (!filters.classroomId && canManageAllClassrooms(session.user.role)) {
      const whereClause = buildEquipmentWhereClause(filters)

      const [equipment, total] = await Promise.all([
        prisma.equipment.findMany({
          where: whereClause,
          include: {
            classrooms: {
              where: { isPrimary: true },
              include: { classroom: { select: { id: true, name: true } } },
            },
          },
          orderBy: { name: 'asc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.equipment.count({ where: whereClause }),
      ])

      const formattedEquipment = equipment.map((e) => ({
        ...e,
        ownerClassroom: e.classrooms[0]?.classroom || null,
        classrooms: undefined,
      }))

      return successResponse(paginatedResponse(formattedEquipment, total, pagination))
    }

    // Classroom-scoped query
    if (!filters.classroomId) {
      throw new BadRequestError('classroomId is required')
    }

    const context = await getClassroomContext(
      session.user.id,
      session.user.role,
      filters.classroomId
    )

    if (!context) {
      throw new ForbiddenError('Classroom not found or access denied')
    }

    // Optimized query: Get equipment linked to this classroom with filters pushed to database
    const whereClause = buildEquipmentWhereClause(filters)

    // Get owned and borrowed equipment in a single optimized query
    const classroomEquipment = await prisma.classroomEquipment.findMany({
      where: {
        classroomId: filters.classroomId,
        equipment: whereClause,
      },
      include: {
        equipment: true,
      },
      orderBy: {
        equipment: { name: 'asc' },
      },
    })

    // Get shared equipment from other classrooms (available to add)
    const classroomEquipmentIds = classroomEquipment.map((ce) => ce.equipmentId)

    const sharedEquipment = await prisma.equipment.findMany({
      where: {
        isShared: true,
        id: { notIn: classroomEquipmentIds },
        classrooms: {
          some: { isPrimary: true },
        },
        ...whereClause,
      },
      include: {
        classrooms: {
          where: { isPrimary: true },
          include: { classroom: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Format results - filtering is now done in the query
    const ownedEquipment = classroomEquipment
      .filter((ce) => ce.isPrimary)
      .map((ce) => ({
        ...ce.equipment,
        isPrimary: true,
        ownerClassroomId: filters.classroomId,
      }))

    const borrowedEquipment = classroomEquipment
      .filter((ce) => !ce.isPrimary)
      .map((ce) => ({
        ...ce.equipment,
        isPrimary: false,
        ownerClassroomId: null,
      }))

    const availableShared = sharedEquipment.map((e) => ({
      ...e,
      isPrimary: false,
      isAvailableToAdd: true,
      ownerClassroomId: e.classrooms[0]?.classroomId,
      ownerClassroomName: e.classrooms[0]?.classroom.name,
      classrooms: undefined,
    }))

    return successResponse({
      owned: ownedEquipment,
      borrowed: borrowedEquipment,
      availableShared,
    })
  } catch (error) {
    return handleApiError(error, 'fetching equipment')
  }
}

/**
 * POST /api/equipment
 *
 * Create new equipment in a classroom.
 *
 * Request body:
 * - equipmentId: Unique barcode/QR code value
 * - name: Equipment name
 * - category: Equipment category
 * - description: Optional description
 * - photoUrl: Optional photo URL
 * - dailyLateFee: Late fee per day (default: 5)
 * - maxCheckoutDays: Maximum checkout duration (default: 7)
 * - isShared: Whether other classrooms can see this equipment
 * - classroomId: Target classroom ID
 *
 * @returns Created equipment object
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    rateLimit(request, RateLimitConfigs.strict, session.user.id)

    const body = await request.json()
    const validatedData = equipmentSchema.parse(body)

    // Check classroom access and permission
    const context = await getClassroomContext(
      session.user.id,
      session.user.role,
      validatedData.classroomId
    )

    if (!context) {
      throw new ForbiddenError('Classroom not found or access denied')
    }

    if (!canManageEquipment(context.userRole, session.user.role)) {
      throw new ForbiddenError('Permission denied to create equipment')
    }

    // Check for duplicate equipment ID
    const existing = await prisma.equipment.findUnique({
      where: { equipmentId: validatedData.equipmentId },
    })

    if (existing) {
      throw new ConflictError('Equipment ID already exists')
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

    // Audit log
    await AuditLog.equipmentCreated(
      session.user.id,
      equipment.id,
      validatedData.classroomId,
      { name: equipment.name, category: equipment.category }
    )

    return successResponse(equipment, 201)
  } catch (error) {
    return handleApiError(error, 'creating equipment')
  }
}
