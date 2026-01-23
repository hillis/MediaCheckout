import { prisma } from './prisma'

/**
 * Audit logging for sensitive operations.
 *
 * This module provides a simple audit logging system that records
 * important actions like deletions, permission changes, and
 * ownership transfers.
 */

export type AuditAction =
  // Equipment actions
  | 'EQUIPMENT_CREATED'
  | 'EQUIPMENT_UPDATED'
  | 'EQUIPMENT_DELETED'
  | 'EQUIPMENT_SHARED'
  | 'EQUIPMENT_UNSHARED'
  // Classroom actions
  | 'CLASSROOM_CREATED'
  | 'CLASSROOM_UPDATED'
  | 'CLASSROOM_DELETED'
  | 'CLASSROOM_ARCHIVED'
  | 'CLASSROOM_RESTORED'
  | 'CLASSROOM_OWNERSHIP_TRANSFERRED'
  // Member actions
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_ROLE_CHANGED'
  // User actions
  | 'USER_ROLE_CHANGED'
  | 'USER_DELETED'
  // Checkout actions
  | 'CHECKOUT_CREATED'
  | 'CHECKOUT_RETURNED'
  | 'CHECKOUT_OVERDUE_RESOLVED'
  // Settings actions
  | 'SETTINGS_UPDATED'

export interface AuditLogEntry {
  action: AuditAction
  userId: string
  targetType: 'equipment' | 'classroom' | 'user' | 'checkout' | 'member' | 'settings'
  targetId: string
  classroomId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Create an audit log entry.
 * Logs are stored in the database and can be queried later for compliance.
 *
 * @param entry - Audit log entry data
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId,
        targetType: entry.targetType,
        targetId: entry.targetId,
        classroomId: entry.classroomId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
        createdAt: new Date(),
      },
    })
  } catch (error) {
    // Log audit failures but don't throw - audit logging should not break operations
    console.error('Failed to create audit log entry:', error, entry)
  }
}

/**
 * Helper to get IP address from request headers
 *
 * @param headers - Request headers
 * @returns IP address or undefined
 */
export function getIpFromHeaders(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || undefined
}

/**
 * Convenience functions for common audit actions
 */

export const AuditLog = {
  /**
   * Log equipment creation
   */
  async equipmentCreated(
    userId: string,
    equipmentId: string,
    classroomId: string,
    details?: { name: string; category: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'EQUIPMENT_CREATED',
      userId,
      targetType: 'equipment',
      targetId: equipmentId,
      classroomId,
      details,
    })
  },

  /**
   * Log equipment deletion
   */
  async equipmentDeleted(
    userId: string,
    equipmentId: string,
    classroomId: string,
    details?: { name: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'EQUIPMENT_DELETED',
      userId,
      targetType: 'equipment',
      targetId: equipmentId,
      classroomId,
      details,
    })
  },

  /**
   * Log equipment update
   */
  async equipmentUpdated(
    userId: string,
    equipmentId: string,
    classroomId: string,
    details?: { changes: Record<string, { from: unknown; to: unknown }> }
  ): Promise<void> {
    await createAuditLog({
      action: 'EQUIPMENT_UPDATED',
      userId,
      targetType: 'equipment',
      targetId: equipmentId,
      classroomId,
      details,
    })
  },

  /**
   * Log classroom creation
   */
  async classroomCreated(
    userId: string,
    classroomId: string,
    details?: { name: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'CLASSROOM_CREATED',
      userId,
      targetType: 'classroom',
      targetId: classroomId,
      classroomId,
      details,
    })
  },

  /**
   * Log classroom deletion
   */
  async classroomDeleted(
    userId: string,
    classroomId: string,
    details?: { name: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'CLASSROOM_DELETED',
      userId,
      targetType: 'classroom',
      targetId: classroomId,
      classroomId,
      details,
    })
  },

  /**
   * Log classroom archival
   */
  async classroomArchived(
    userId: string,
    classroomId: string,
    details?: { name: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'CLASSROOM_ARCHIVED',
      userId,
      targetType: 'classroom',
      targetId: classroomId,
      classroomId,
      details,
    })
  },

  /**
   * Log member addition
   */
  async memberAdded(
    userId: string,
    memberId: string,
    classroomId: string,
    details?: { email: string; role: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'MEMBER_ADDED',
      userId,
      targetType: 'member',
      targetId: memberId,
      classroomId,
      details,
    })
  },

  /**
   * Log member removal
   */
  async memberRemoved(
    userId: string,
    memberId: string,
    classroomId: string,
    details?: { email: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'MEMBER_REMOVED',
      userId,
      targetType: 'member',
      targetId: memberId,
      classroomId,
      details,
    })
  },

  /**
   * Log member role change
   */
  async memberRoleChanged(
    userId: string,
    memberId: string,
    classroomId: string,
    details?: { fromRole: string; toRole: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'MEMBER_ROLE_CHANGED',
      userId,
      targetType: 'member',
      targetId: memberId,
      classroomId,
      details,
    })
  },

  /**
   * Log user role change (system level)
   */
  async userRoleChanged(
    userId: string,
    targetUserId: string,
    details?: { fromRole: string; toRole: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'USER_ROLE_CHANGED',
      userId,
      targetType: 'user',
      targetId: targetUserId,
      details,
    })
  },

  /**
   * Log checkout creation
   */
  async checkoutCreated(
    userId: string,
    checkoutId: string,
    classroomId: string,
    details?: { equipmentId: string; equipmentName: string }
  ): Promise<void> {
    await createAuditLog({
      action: 'CHECKOUT_CREATED',
      userId,
      targetType: 'checkout',
      targetId: checkoutId,
      classroomId,
      details,
    })
  },

  /**
   * Log checkout return
   */
  async checkoutReturned(
    userId: string,
    checkoutId: string,
    classroomId: string,
    details?: { equipmentId: string; lateFeeAmount?: number }
  ): Promise<void> {
    await createAuditLog({
      action: 'CHECKOUT_RETURNED',
      userId,
      targetType: 'checkout',
      targetId: checkoutId,
      classroomId,
      details,
    })
  },
}
