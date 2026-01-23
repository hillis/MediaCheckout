import { Role, ClassroomRole } from '@/types'

// System-level role checks
export function isSuperAdmin(role: Role): boolean {
  return role === 'SUPER_ADMIN'
}

export function isTeacherAdmin(role: Role): boolean {
  return role === 'TEACHER_ADMIN'
}

export function isTeacher(role: Role): boolean {
  return role === 'TEACHER'
}

export function isStudent(role: Role): boolean {
  return role === 'STUDENT'
}

// Check if user has any admin-level system role
export function hasSystemAdminRole(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'TEACHER_ADMIN'
}

// Check if user can create classrooms (teachers and above)
export function canCreateClassroom(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'TEACHER_ADMIN' || role === 'TEACHER'
}

// Check if user can manage all classrooms (super admin only)
export function canManageAllClassrooms(role: Role): boolean {
  return role === 'SUPER_ADMIN'
}

// Classroom-level role checks
export function isClassroomAdmin(classroomRole: ClassroomRole): boolean {
  return classroomRole === 'ADMIN'
}

export function isClassroomTeacher(classroomRole: ClassroomRole): boolean {
  return classroomRole === 'TEACHER'
}

export function isClassroomStudent(classroomRole: ClassroomRole): boolean {
  return classroomRole === 'STUDENT'
}

// Check if user can manage equipment in a classroom
export function canManageEquipment(
  classroomRole: ClassroomRole,
  systemRole: Role
): boolean {
  // Super admin can always manage
  if (systemRole === 'SUPER_ADMIN') return true
  // Classroom admins and teachers can manage
  return classroomRole === 'ADMIN' || classroomRole === 'TEACHER'
}

// Check if user can manage checkouts in a classroom
export function canManageCheckouts(
  classroomRole: ClassroomRole,
  systemRole: Role
): boolean {
  if (systemRole === 'SUPER_ADMIN') return true
  return classroomRole === 'ADMIN' || classroomRole === 'TEACHER'
}

// Check if user can manage members in a classroom
export function canManageMembers(
  classroomRole: ClassroomRole,
  systemRole: Role,
  isOwner: boolean
): boolean {
  if (systemRole === 'SUPER_ADMIN') return true
  if (isOwner) return true
  return classroomRole === 'ADMIN'
}

// Check if user can delete a classroom
export function canDeleteClassroom(
  systemRole: Role,
  isOwner: boolean
): boolean {
  if (systemRole === 'SUPER_ADMIN') return true
  return isOwner
}

// Check if user can change classroom settings
export function canChangeClassroomSettings(
  classroomRole: ClassroomRole,
  systemRole: Role,
  isOwner: boolean
): boolean {
  if (systemRole === 'SUPER_ADMIN') return true
  if (isOwner) return true
  return classroomRole === 'ADMIN'
}

// Check if user can share equipment with other classrooms
export function canShareEquipment(
  classroomRole: ClassroomRole,
  systemRole: Role,
  isOwner: boolean
): boolean {
  if (systemRole === 'SUPER_ADMIN') return true
  if (isOwner) return true
  return classroomRole === 'ADMIN'
}

// Check if user can checkout equipment
export function canCheckoutEquipment(
  classroomRole: ClassroomRole | null,
  systemRole: Role
): boolean {
  // Super admins can always checkout
  if (systemRole === 'SUPER_ADMIN') return true
  // Must be a member of the classroom
  if (!classroomRole) return false
  // All classroom members can checkout
  return true
}

// Check if user can view a classroom
export function canViewClassroom(
  classroomRole: ClassroomRole | null,
  systemRole: Role
): boolean {
  if (systemRole === 'SUPER_ADMIN') return true
  return classroomRole !== null
}

// Check if user can permanently delete a classroom (SUPER_ADMIN only)
export function canPermanentlyDeleteClassroom(systemRole: Role): boolean {
  return systemRole === 'SUPER_ADMIN'
}

// Get effective permission level for a user in a classroom
export type PermissionLevel = 'none' | 'student' | 'teacher' | 'admin' | 'super_admin'

export function getPermissionLevel(
  classroomRole: ClassroomRole | null,
  systemRole: Role,
  isOwner: boolean
): PermissionLevel {
  if (systemRole === 'SUPER_ADMIN') return 'super_admin'
  if (!classroomRole) return 'none'
  if (isOwner || classroomRole === 'ADMIN') return 'admin'
  if (classroomRole === 'TEACHER') return 'teacher'
  return 'student'
}
