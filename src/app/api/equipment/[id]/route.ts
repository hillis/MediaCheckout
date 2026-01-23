import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { userHasEquipmentAccess } from '@/lib/classroom-context'
import {
  handleApiError,
  successResponse,
  NotFoundError,
  BadRequestError,
} from '@/lib/api-response'
import {
  requireAuth,
  requireEquipmentManagement,
} from '@/lib/api-middleware'
import { rateLimit, RateLimitConfigs } from '@/lib/rate-limit'
import { AuditLog } from '@/lib/audit-log'

/**
 * Zod schema for equipment updates
 */
const updateEquipmentSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  category: z.string().min(1, 'Category is required').optional(),
  description: z.string().optional(),
  photoUrl: z.string().url('Invalid photo URL').optional().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'CHECKED_OUT', 'RESERVED', 'MAINTENANCE']).optional(),
  dailyLateFee: z.number().min(0, 'Daily late fee must be positive').optional(),
  maxCheckoutDays: z.number().min(1, 'Max checkout days must be at least 1').optional(),
  isShared: z.boolean().optional(),
})

/**
 * GET /api/equipment/[id]
 *
 * Fetch a single equipment item with active checkouts and reservations.
 *
 * @param params.id - Equipment ID
 * @returns Equipment details with relationships
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    rateLimit(request, RateLimitConfigs.standard, session.user.id)

    const { id } = await params

    // Check if user has access to this equipment
    const access = await userHasEquipmentAccess(session.user.id, id, session.user.role)
    if (!access.hasAccess) {
      throw new NotFoundError('Equipment not found or access denied')
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        checkouts: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { name: true, email: true } },
            classroom: { select: { id: true, name: true } },
          },
        },
        reservations: {
          where: { status: 'PENDING' },
          include: {
            user: { select: { name: true, email: true } },
            classroom: { select: { id: true, name: true } },
          },
          orderBy: { pickupDate: 'asc' },
        },
        classrooms: {
          include: {
            classroom: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!equipment) {
      throw new NotFoundError('Equipment not found')
    }

    // Find the primary (owner) classroom
    const primaryClassroom = equipment.classrooms.find((c) => c.isPrimary)

    return successResponse({
      ...equipment,
      ownerClassroomId: primaryClassroom?.classroomId,
      ownerClassroomName: primaryClassroom?.classroom.name,
    })
  } catch (error) {
    return handleApiError(error, 'fetching equipment')
  }
}

/**
 * PATCH /api/equipment/[id]
 *
 * Update equipment details.
 *
 * @param params.id - Equipment ID
 * @returns Updated equipment object
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Use the new middleware to check permissions
    const { session, equipment: equipmentContext } = await requireEquipmentManagement(id)
    rateLimit(request, RateLimitConfigs.strict, session.user.id)

    const body = await request.json()
    const validatedData = updateEquipmentSchema.parse(body)

    // Get current equipment for audit logging
    const currentEquipment = await prisma.equipment.findUnique({
      where: { id },
      select: { name: true, category: true, status: true },
    })

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        ...validatedData,
        photoUrl: validatedData.photoUrl === '' ? null : validatedData.photoUrl,
      },
    })

    // Audit log with change details
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (validatedData.name && validatedData.name !== currentEquipment?.name) {
      changes.name = { from: currentEquipment?.name, to: validatedData.name }
    }
    if (validatedData.status && validatedData.status !== currentEquipment?.status) {
      changes.status = { from: currentEquipment?.status, to: validatedData.status }
    }

    if (Object.keys(changes).length > 0) {
      await AuditLog.equipmentUpdated(
        session.user.id,
        id,
        equipmentContext.classroomId,
        { changes }
      )
    }

    return successResponse(equipment)
  } catch (error) {
    return handleApiError(error, 'updating equipment')
  }
}

/**
 * DELETE /api/equipment/[id]
 *
 * Delete equipment and all classroom links.
 * Fails if there are active checkouts.
 *
 * @param params.id - Equipment ID
 * @returns Success confirmation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Use the new middleware to check permissions
    const { session, equipment: equipmentContext } = await requireEquipmentManagement(id)
    rateLimit(request, RateLimitConfigs.strict, session.user.id)

    // Get equipment name for audit log before deletion
    const equipmentToDelete = await prisma.equipment.findUnique({
      where: { id },
      select: { name: true },
    })

    // Check for active checkouts
    const activeCheckouts = await prisma.checkout.count({
      where: { equipmentId: id, status: 'ACTIVE' },
    })

    if (activeCheckouts > 0) {
      throw new BadRequestError('Cannot delete equipment with active checkouts')
    }

    // Delete equipment and all classroom links
    await prisma.$transaction([
      prisma.classroomEquipment.deleteMany({ where: { equipmentId: id } }),
      prisma.equipment.delete({ where: { id } }),
    ])

    // Audit log
    await AuditLog.equipmentDeleted(
      session.user.id,
      id,
      equipmentContext.classroomId,
      { name: equipmentToDelete?.name || 'Unknown' }
    )

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'deleting equipment')
  }
}
