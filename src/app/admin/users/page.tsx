'use client'

import { useState, useEffect } from 'react'
import { Search, Users, Shield, DollarSign, School, Plus, X, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatCurrency } from '@/lib/utils'

type ClassroomMembership = {
  id: string
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
  classroom: {
    id: string
    name: string
    isActive: boolean
  }
}

type OwnedClassroom = {
  id: string
  name: string
  isActive: boolean
}

type UserWithStats = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  totalLateFees: number
  createdAt: string
  _count: {
    checkouts: number
    reservations: number
  }
  classroomMembers: ClassroomMembership[]
  ownedClassrooms: OwnedClassroom[]
}

type Classroom = {
  id: string
  name: string
  isActive: boolean
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [role, setRole] = useState<string>('')
  const [lateFees, setLateFees] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [addClassroomId, setAddClassroomId] = useState<string>('')
  const [addClassroomRole, setAddClassroomRole] = useState<string>('STUDENT')
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
    fetchClassrooms()
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchClassrooms() {
    try {
      const res = await fetch('/api/classrooms?status=active')
      if (res.ok) {
        setClassrooms(await res.json())
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error)
    }
  }

  function openEditDialog(user: UserWithStats) {
    setSelectedUser(user)
    setRole(user.role)
    setLateFees(user.totalLateFees.toString())
    setAddClassroomId('')
    setAddClassroomRole('STUDENT')
    setDialogOpen(true)
  }

  async function handleUpdate() {
    if (!selectedUser) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          totalLateFees: parseFloat(lateFees) || 0,
        }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'User updated',
          variant: 'success',
        })
        setDialogOpen(false)
        fetchUsers()
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to update user',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function addToClassroom() {
    if (!selectedUser || !addClassroomId) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/classrooms/${addClassroomId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedUser.email,
          role: addClassroomRole,
        }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'User added to classroom',
          variant: 'success',
        })
        // Refresh user data
        const userRes = await fetch('/api/users')
        if (userRes.ok) {
          const allUsers = await userRes.json()
          const updatedUser = allUsers.find((u: UserWithStats) => u.id === selectedUser.id)
          if (updatedUser) {
            setSelectedUser(updatedUser)
            setUsers(allUsers)
          }
        }
        setAddClassroomId('')
        setAddClassroomRole('STUDENT')
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to add user to classroom',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add user to classroom',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function removeFromClassroom(classroomId: string) {
    if (!selectedUser) return

    if (!confirm('Remove user from this classroom?')) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/members?userId=${selectedUser.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'User removed from classroom',
          variant: 'success',
        })
        // Refresh user data
        const userRes = await fetch('/api/users')
        if (userRes.ok) {
          const allUsers = await userRes.json()
          const updatedUser = allUsers.find((u: UserWithStats) => u.id === selectedUser.id)
          if (updatedUser) {
            setSelectedUser(updatedUser)
            setUsers(allUsers)
          }
        }
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to remove user from classroom',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove user from classroom',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function updateClassroomRole(classroomId: string, newRole: string) {
    if (!selectedUser) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: newRole,
        }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Role updated',
          variant: 'success',
        })
        // Refresh user data
        const userRes = await fetch('/api/users')
        if (userRes.ok) {
          const allUsers = await userRes.json()
          const updatedUser = allUsers.find((u: UserWithStats) => u.id === selectedUser.id)
          if (updatedUser) {
            setSelectedUser(updatedUser)
            setUsers(allUsers)
          }
        }
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to update role',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Get classrooms user is not already in (and not owner of)
  const availableClassrooms = classrooms.filter((c) => {
    if (!selectedUser) return true
    const isMember = selectedUser.classroomMembers.some((m) => m.classroom.id === c.id)
    const isOwner = selectedUser.ownedClassrooms.some((o) => o.id === c.id)
    return !isMember && !isOwner
  })

  // Combine owned and member classrooms for display
  const userClassrooms = selectedUser
    ? [
        ...selectedUser.ownedClassrooms.map((c) => ({
          classroomId: c.id,
          classroomName: c.name,
          isActive: c.isActive,
          role: 'OWNER' as const,
          isOwner: true,
        })),
        ...selectedUser.classroomMembers.map((m) => ({
          classroomId: m.classroom.id,
          classroomName: m.classroom.name,
          isActive: m.classroom.isActive,
          role: m.role,
          isOwner: false,
        })),
      ]
    : []

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase())
  )

  const getClassroomCount = (user: UserWithStats) => {
    return user.ownedClassrooms.length + user.classroomMembers.length
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">View and manage user accounts</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">No users found</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.image || ''} />
                    <AvatarFallback>
                      {user.name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.name || 'Unknown'}</h3>
                      {user.role === 'SUPER_ADMIN' && (
                        <Badge className="bg-purple-100 text-purple-800">
                          <Shield className="mr-1 h-3 w-3" />
                          Super Admin
                        </Badge>
                      )}
                      {user.role === 'TEACHER_ADMIN' && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Shield className="mr-1 h-3 w-3" />
                          Teacher Admin
                        </Badge>
                      )}
                      {user.role === 'TEACHER' && (
                        <Badge className="bg-green-100 text-green-800">Teacher</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>{user._count.checkouts} checkouts</span>
                      <span>{user._count.reservations} reservations</span>
                      <span className="flex items-center gap-1">
                        <School className="h-3 w-3" />
                        {getClassroomCount(user)} classrooms
                      </span>
                      <span>Joined {formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {user.totalLateFees > 0 && (
                      <Badge variant="destructive" className="mb-2">
                        <DollarSign className="mr-1 h-3 w-3" />
                        {formatCurrency(user.totalLateFees)} fees
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user role, fees, and classroom memberships</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedUser?.image || ''} />
                <AvatarFallback>
                  {selectedUser?.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedUser?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>

            {/* System Role */}
            <div className="space-y-2">
              <Label htmlFor="role">System Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="TEACHER">Teacher</SelectItem>
                  <SelectItem value="TEACHER_ADMIN">Teacher Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Late Fees */}
            <div className="space-y-2">
              <Label htmlFor="lateFees">Outstanding Late Fees ($)</Label>
              <Input
                id="lateFees"
                type="number"
                min="0"
                step="0.01"
                value={lateFees}
                onChange={(e) => setLateFees(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Set to 0 to clear outstanding fees</p>
            </div>

            {/* Classroom Memberships */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <School className="h-4 w-4" />
                Classroom Memberships
              </Label>

              {/* Current Memberships */}
              {userClassrooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not a member of any classrooms</p>
              ) : (
                <div className="space-y-2">
                  {userClassrooms.map((membership) => (
                    <div
                      key={membership.classroomId}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{membership.classroomName}</span>
                        {!membership.isActive && (
                          <Badge variant="outline" className="text-xs">
                            Archived
                          </Badge>
                        )}
                        {membership.isOwner && (
                          <span title="Owner">
                            <Crown className="h-3 w-3 text-yellow-500" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {membership.isOwner ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Owner</Badge>
                        ) : (
                          <>
                            <Select
                              value={membership.role}
                              onValueChange={(value) =>
                                updateClassroomRole(membership.classroomId, value)
                              }
                              disabled={submitting}
                            >
                              <SelectTrigger className="h-8 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="STUDENT">Student</SelectItem>
                                <SelectItem value="TEACHER">Teacher</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => removeFromClassroom(membership.classroomId)}
                              disabled={submitting}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Classroom */}
              {availableClassrooms.length > 0 && (
                <div className="flex items-end gap-2 pt-2 border-t">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Add to classroom</Label>
                    <Select value={addClassroomId} onValueChange={setAddClassroomId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select classroom..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClassrooms.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <Select value={addClassroomRole} onValueChange={setAddClassroomRole}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STUDENT">Student</SelectItem>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={addToClassroom}
                    disabled={!addClassroomId || submitting}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
