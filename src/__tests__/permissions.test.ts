/**
 * Unit tests for permission checking functions
 *
 * Tests cover all permission scenarios for system-level and classroom-level roles.
 */

import {
  isSuperAdmin,
  isTeacherAdmin,
  isTeacher,
  isStudent,
  hasSystemAdminRole,
  canCreateClassroom,
  canManageAllClassrooms,
  isClassroomAdmin,
  isClassroomTeacher,
  isClassroomStudent,
  canManageEquipment,
  canManageCheckouts,
  canManageMembers,
  canDeleteClassroom,
  canChangeClassroomSettings,
  canShareEquipment,
  canCheckoutEquipment,
  canViewClassroom,
  canPermanentlyDeleteClassroom,
  getPermissionLevel,
  PermissionLevel,
} from '@/lib/permissions'

describe('Permission Functions', () => {
  describe('System-level Role Checks', () => {
    describe('isSuperAdmin', () => {
      it('returns true for SUPER_ADMIN', () => {
        expect(isSuperAdmin('SUPER_ADMIN')).toBe(true)
      })

      it('returns false for other roles', () => {
        expect(isSuperAdmin('TEACHER_ADMIN')).toBe(false)
        expect(isSuperAdmin('TEACHER')).toBe(false)
        expect(isSuperAdmin('STUDENT')).toBe(false)
      })
    })

    describe('isTeacherAdmin', () => {
      it('returns true for TEACHER_ADMIN', () => {
        expect(isTeacherAdmin('TEACHER_ADMIN')).toBe(true)
      })

      it('returns false for other roles', () => {
        expect(isTeacherAdmin('SUPER_ADMIN')).toBe(false)
        expect(isTeacherAdmin('TEACHER')).toBe(false)
        expect(isTeacherAdmin('STUDENT')).toBe(false)
      })
    })

    describe('isTeacher', () => {
      it('returns true for TEACHER', () => {
        expect(isTeacher('TEACHER')).toBe(true)
      })

      it('returns false for other roles', () => {
        expect(isTeacher('SUPER_ADMIN')).toBe(false)
        expect(isTeacher('TEACHER_ADMIN')).toBe(false)
        expect(isTeacher('STUDENT')).toBe(false)
      })
    })

    describe('isStudent', () => {
      it('returns true for STUDENT', () => {
        expect(isStudent('STUDENT')).toBe(true)
      })

      it('returns false for other roles', () => {
        expect(isStudent('SUPER_ADMIN')).toBe(false)
        expect(isStudent('TEACHER_ADMIN')).toBe(false)
        expect(isStudent('TEACHER')).toBe(false)
      })
    })

    describe('hasSystemAdminRole', () => {
      it('returns true for SUPER_ADMIN', () => {
        expect(hasSystemAdminRole('SUPER_ADMIN')).toBe(true)
      })

      it('returns true for TEACHER_ADMIN', () => {
        expect(hasSystemAdminRole('TEACHER_ADMIN')).toBe(true)
      })

      it('returns false for TEACHER and STUDENT', () => {
        expect(hasSystemAdminRole('TEACHER')).toBe(false)
        expect(hasSystemAdminRole('STUDENT')).toBe(false)
      })
    })
  })

  describe('Classroom Creation Permissions', () => {
    describe('canCreateClassroom', () => {
      it('allows SUPER_ADMIN to create classrooms', () => {
        expect(canCreateClassroom('SUPER_ADMIN')).toBe(true)
      })

      it('allows TEACHER_ADMIN to create classrooms', () => {
        expect(canCreateClassroom('TEACHER_ADMIN')).toBe(true)
      })

      it('allows TEACHER to create classrooms', () => {
        expect(canCreateClassroom('TEACHER')).toBe(true)
      })

      it('prevents STUDENT from creating classrooms', () => {
        expect(canCreateClassroom('STUDENT')).toBe(false)
      })
    })

    describe('canManageAllClassrooms', () => {
      it('only SUPER_ADMIN can manage all classrooms', () => {
        expect(canManageAllClassrooms('SUPER_ADMIN')).toBe(true)
        expect(canManageAllClassrooms('TEACHER_ADMIN')).toBe(false)
        expect(canManageAllClassrooms('TEACHER')).toBe(false)
        expect(canManageAllClassrooms('STUDENT')).toBe(false)
      })
    })
  })

  describe('Classroom-level Role Checks', () => {
    describe('isClassroomAdmin', () => {
      it('returns true for ADMIN', () => {
        expect(isClassroomAdmin('ADMIN')).toBe(true)
      })

      it('returns false for other roles', () => {
        expect(isClassroomAdmin('TEACHER')).toBe(false)
        expect(isClassroomAdmin('STUDENT')).toBe(false)
      })
    })

    describe('isClassroomTeacher', () => {
      it('returns true for TEACHER', () => {
        expect(isClassroomTeacher('TEACHER')).toBe(true)
      })

      it('returns false for other roles', () => {
        expect(isClassroomTeacher('ADMIN')).toBe(false)
        expect(isClassroomTeacher('STUDENT')).toBe(false)
      })
    })

    describe('isClassroomStudent', () => {
      it('returns true for STUDENT', () => {
        expect(isClassroomStudent('STUDENT')).toBe(true)
      })

      it('returns false for other roles', () => {
        expect(isClassroomStudent('ADMIN')).toBe(false)
        expect(isClassroomStudent('TEACHER')).toBe(false)
      })
    })
  })

  describe('Equipment Management Permissions', () => {
    describe('canManageEquipment', () => {
      it('allows SUPER_ADMIN regardless of classroom role', () => {
        expect(canManageEquipment('STUDENT', 'SUPER_ADMIN')).toBe(true)
        expect(canManageEquipment('ADMIN', 'SUPER_ADMIN')).toBe(true)
      })

      it('allows classroom ADMIN', () => {
        expect(canManageEquipment('ADMIN', 'TEACHER')).toBe(true)
        expect(canManageEquipment('ADMIN', 'STUDENT')).toBe(true)
      })

      it('allows classroom TEACHER', () => {
        expect(canManageEquipment('TEACHER', 'TEACHER')).toBe(true)
        expect(canManageEquipment('TEACHER', 'STUDENT')).toBe(true)
      })

      it('denies classroom STUDENT', () => {
        expect(canManageEquipment('STUDENT', 'TEACHER')).toBe(false)
        expect(canManageEquipment('STUDENT', 'STUDENT')).toBe(false)
      })
    })
  })

  describe('Checkout Management Permissions', () => {
    describe('canManageCheckouts', () => {
      it('allows SUPER_ADMIN regardless of classroom role', () => {
        expect(canManageCheckouts('STUDENT', 'SUPER_ADMIN')).toBe(true)
      })

      it('allows classroom ADMIN and TEACHER', () => {
        expect(canManageCheckouts('ADMIN', 'TEACHER')).toBe(true)
        expect(canManageCheckouts('TEACHER', 'TEACHER')).toBe(true)
      })

      it('denies classroom STUDENT', () => {
        expect(canManageCheckouts('STUDENT', 'STUDENT')).toBe(false)
      })
    })
  })

  describe('Member Management Permissions', () => {
    describe('canManageMembers', () => {
      it('allows SUPER_ADMIN regardless of other factors', () => {
        expect(canManageMembers('STUDENT', 'SUPER_ADMIN', false)).toBe(true)
      })

      it('allows classroom owner', () => {
        expect(canManageMembers('STUDENT', 'STUDENT', true)).toBe(true)
      })

      it('allows classroom ADMIN', () => {
        expect(canManageMembers('ADMIN', 'TEACHER', false)).toBe(true)
      })

      it('denies non-admin, non-owner', () => {
        expect(canManageMembers('TEACHER', 'TEACHER', false)).toBe(false)
        expect(canManageMembers('STUDENT', 'STUDENT', false)).toBe(false)
      })
    })
  })

  describe('Classroom Deletion Permissions', () => {
    describe('canDeleteClassroom', () => {
      it('allows SUPER_ADMIN', () => {
        expect(canDeleteClassroom('SUPER_ADMIN', false)).toBe(true)
      })

      it('allows classroom owner', () => {
        expect(canDeleteClassroom('TEACHER', true)).toBe(true)
        expect(canDeleteClassroom('STUDENT', true)).toBe(true)
      })

      it('denies non-owner non-super-admin', () => {
        expect(canDeleteClassroom('TEACHER_ADMIN', false)).toBe(false)
        expect(canDeleteClassroom('TEACHER', false)).toBe(false)
      })
    })

    describe('canPermanentlyDeleteClassroom', () => {
      it('only allows SUPER_ADMIN', () => {
        expect(canPermanentlyDeleteClassroom('SUPER_ADMIN')).toBe(true)
        expect(canPermanentlyDeleteClassroom('TEACHER_ADMIN')).toBe(false)
        expect(canPermanentlyDeleteClassroom('TEACHER')).toBe(false)
        expect(canPermanentlyDeleteClassroom('STUDENT')).toBe(false)
      })
    })
  })

  describe('Classroom Settings Permissions', () => {
    describe('canChangeClassroomSettings', () => {
      it('allows SUPER_ADMIN', () => {
        expect(canChangeClassroomSettings('STUDENT', 'SUPER_ADMIN', false)).toBe(true)
      })

      it('allows classroom owner', () => {
        expect(canChangeClassroomSettings('STUDENT', 'STUDENT', true)).toBe(true)
      })

      it('allows classroom ADMIN', () => {
        expect(canChangeClassroomSettings('ADMIN', 'TEACHER', false)).toBe(true)
      })

      it('denies others', () => {
        expect(canChangeClassroomSettings('TEACHER', 'TEACHER', false)).toBe(false)
        expect(canChangeClassroomSettings('STUDENT', 'STUDENT', false)).toBe(false)
      })
    })
  })

  describe('Equipment Sharing Permissions', () => {
    describe('canShareEquipment', () => {
      it('allows SUPER_ADMIN', () => {
        expect(canShareEquipment('STUDENT', 'SUPER_ADMIN', false)).toBe(true)
      })

      it('allows classroom owner', () => {
        expect(canShareEquipment('STUDENT', 'STUDENT', true)).toBe(true)
      })

      it('allows classroom ADMIN', () => {
        expect(canShareEquipment('ADMIN', 'TEACHER', false)).toBe(true)
      })

      it('denies others', () => {
        expect(canShareEquipment('TEACHER', 'TEACHER', false)).toBe(false)
        expect(canShareEquipment('STUDENT', 'STUDENT', false)).toBe(false)
      })
    })
  })

  describe('Equipment Checkout Permissions', () => {
    describe('canCheckoutEquipment', () => {
      it('allows SUPER_ADMIN regardless of membership', () => {
        expect(canCheckoutEquipment(null, 'SUPER_ADMIN')).toBe(true)
      })

      it('allows any classroom member', () => {
        expect(canCheckoutEquipment('ADMIN', 'STUDENT')).toBe(true)
        expect(canCheckoutEquipment('TEACHER', 'STUDENT')).toBe(true)
        expect(canCheckoutEquipment('STUDENT', 'STUDENT')).toBe(true)
      })

      it('denies non-members', () => {
        expect(canCheckoutEquipment(null, 'STUDENT')).toBe(false)
        expect(canCheckoutEquipment(null, 'TEACHER')).toBe(false)
      })
    })
  })

  describe('Classroom View Permissions', () => {
    describe('canViewClassroom', () => {
      it('allows SUPER_ADMIN regardless of membership', () => {
        expect(canViewClassroom(null, 'SUPER_ADMIN')).toBe(true)
      })

      it('allows any classroom member', () => {
        expect(canViewClassroom('ADMIN', 'STUDENT')).toBe(true)
        expect(canViewClassroom('TEACHER', 'STUDENT')).toBe(true)
        expect(canViewClassroom('STUDENT', 'STUDENT')).toBe(true)
      })

      it('denies non-members', () => {
        expect(canViewClassroom(null, 'STUDENT')).toBe(false)
        expect(canViewClassroom(null, 'TEACHER')).toBe(false)
      })
    })
  })

  describe('Permission Level Calculation', () => {
    describe('getPermissionLevel', () => {
      it('returns super_admin for SUPER_ADMIN system role', () => {
        expect(getPermissionLevel(null, 'SUPER_ADMIN', false)).toBe('super_admin')
        expect(getPermissionLevel('STUDENT', 'SUPER_ADMIN', false)).toBe('super_admin')
      })

      it('returns none for non-members', () => {
        expect(getPermissionLevel(null, 'STUDENT', false)).toBe('none')
        expect(getPermissionLevel(null, 'TEACHER', false)).toBe('none')
      })

      it('returns admin for classroom owner', () => {
        expect(getPermissionLevel('STUDENT', 'STUDENT', true)).toBe('admin')
        expect(getPermissionLevel(null, 'TEACHER', true)).toBe('admin')
      })

      it('returns admin for classroom ADMIN', () => {
        expect(getPermissionLevel('ADMIN', 'STUDENT', false)).toBe('admin')
      })

      it('returns teacher for classroom TEACHER', () => {
        expect(getPermissionLevel('TEACHER', 'STUDENT', false)).toBe('teacher')
      })

      it('returns student for classroom STUDENT', () => {
        expect(getPermissionLevel('STUDENT', 'STUDENT', false)).toBe('student')
      })
    })
  })
})
