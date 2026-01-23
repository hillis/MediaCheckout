'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Plus,
  School,
  Users,
  Package,
  Copy,
  Check,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Trash2,
  Settings,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

type Classroom = {
  id: string
  name: string
  description: string | null
  joinCode: string
  isActive: boolean
  isOwner: boolean
  memberRole: string
  owner: {
    id: string
    name: string | null
    email: string | null
  }
  _count: {
    members: number
    equipment: number
  }
}

export default function ClassroomsPage() {
  const { data: session } = useSession()
  const [activeClassrooms, setActiveClassrooms] = useState<Classroom[]>([])
  const [archivedClassrooms, setArchivedClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; classroom: Classroom | null }>({
    open: false,
    classroom: null,
  })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; classroom: Classroom | null }>({
    open: false,
    classroom: null,
  })
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchClassrooms()
  }, [])

  const fetchClassrooms = async () => {
    setIsLoading(true)
    try {
      const [activeRes, archivedRes] = await Promise.all([
        fetch('/api/classrooms?status=active'),
        fetch('/api/classrooms?status=archived'),
      ])

      if (activeRes.ok) {
        const data = await activeRes.json()
        setActiveClassrooms(data)
      }
      if (archivedRes.ok) {
        const data = await archivedRes.json()
        setArchivedClassrooms(data)
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyJoinCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleArchive = async (classroom: Classroom) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/classrooms/${classroom.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActiveClassrooms((prev) => prev.filter((c) => c.id !== classroom.id))
        setArchivedClassrooms((prev) => [...prev, { ...classroom, isActive: false }])
        setArchiveDialog({ open: false, classroom: null })
      }
    } catch (error) {
      console.error('Error archiving classroom:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestore = async (classroom: Classroom) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/classrooms/${classroom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      if (res.ok) {
        setArchivedClassrooms((prev) => prev.filter((c) => c.id !== classroom.id))
        setActiveClassrooms((prev) =>
          [...prev, { ...classroom, isActive: true }].sort((a, b) => a.name.localeCompare(b.name))
        )
      }
    } catch (error) {
      console.error('Error restoring classroom:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePermanentDelete = async (classroom: Classroom) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/classrooms/${classroom.id}?permanent=true`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setArchivedClassrooms((prev) => prev.filter((c) => c.id !== classroom.id))
        setDeleteDialog({ open: false, classroom: null })
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete classroom')
      }
    } catch (error) {
      console.error('Error deleting classroom:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const canCreateClassroom =
    session?.user.role === 'SUPER_ADMIN' ||
    session?.user.role === 'TEACHER_ADMIN' ||
    session?.user.role === 'TEACHER'

  const isSuperAdmin = session?.user.role === 'SUPER_ADMIN'

  const canArchiveClassroom = (classroom: Classroom) => {
    return classroom.isOwner || isSuperAdmin
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading classrooms...</div>
      </div>
    )
  }

  const renderClassroomCard = (classroom: Classroom, isArchived: boolean) => (
    <div
      key={classroom.id}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow ${
        isArchived ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${isArchived ? 'bg-gray-100' : 'bg-blue-50'}`}>
            <School className={`h-5 w-5 ${isArchived ? 'text-gray-500' : 'text-blue-600'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/classrooms/${classroom.id}`}
                className="font-semibold text-gray-900 hover:text-blue-600 hover:underline"
              >
                {classroom.name}
              </Link>
              {isArchived && (
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded">
                  Archived
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {classroom.isOwner ? 'Owner' : classroom.memberRole}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/classrooms/${classroom.id}`} className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            {canArchiveClassroom(classroom) && (
              <>
                <DropdownMenuSeparator />
                {isArchived ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleRestore(classroom)}
                      className="flex items-center gap-2"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                      Restore
                    </DropdownMenuItem>
                    {isSuperAdmin && (
                      <DropdownMenuItem
                        onClick={() => setDeleteDialog({ open: true, classroom })}
                        className="flex items-center gap-2 text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Permanently
                      </DropdownMenuItem>
                    )}
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={() => setArchiveDialog({ open: true, classroom })}
                    className="flex items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {classroom.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{classroom.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          {classroom._count.members} members
        </div>
        <div className="flex items-center gap-1">
          <Package className="h-4 w-4" />
          {classroom._count.equipment} items
        </div>
      </div>

      {!isArchived &&
        (classroom.isOwner || classroom.memberRole === 'ADMIN') &&
        classroom.joinCode && (
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">Join Code</p>
              <p className="font-mono font-semibold text-gray-900">{classroom.joinCode}</p>
            </div>
            <button
              onClick={() => copyJoinCode(classroom.joinCode)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              title="Copy join code"
            >
              {copiedCode === classroom.joinCode ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
    </div>
  )

  const hasClassrooms = activeClassrooms.length > 0 || archivedClassrooms.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classrooms</h1>
          <p className="text-gray-600 mt-1">Manage your classrooms and equipment inventory</p>
        </div>
        {canCreateClassroom && (
          <Link
            href="/admin/classrooms/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Classroom
          </Link>
        )}
      </div>

      {!hasClassrooms ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No classrooms yet</h3>
          <p className="text-gray-500 mb-6">
            {canCreateClassroom
              ? 'Create your first classroom to start managing equipment.'
              : 'You have not joined any classrooms yet.'}
          </p>
          {canCreateClassroom ? (
            <Link
              href="/admin/classrooms/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Classroom
            </Link>
          ) : (
            <Link
              href="/join"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Join a Classroom
            </Link>
          )}
        </div>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Classrooms ({activeClassrooms.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedClassrooms.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeClassrooms.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active classrooms</h3>
                <p className="text-gray-500 mb-6">
                  {archivedClassrooms.length > 0
                    ? 'All your classrooms are archived. Restore one or create a new classroom.'
                    : 'Create your first classroom to start managing equipment.'}
                </p>
                {canCreateClassroom && (
                  <Link
                    href="/admin/classrooms/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create Classroom
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeClassrooms.map((classroom) => renderClassroomCard(classroom, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archived">
            {archivedClassrooms.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No archived classrooms</h3>
                <p className="text-gray-500">
                  Archived classrooms will appear here. Students cannot join archived classrooms.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedClassrooms.map((classroom) => renderClassroomCard(classroom, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={archiveDialog.open}
        onOpenChange={(open) => !open && setArchiveDialog({ open: false, classroom: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Classroom</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &quot;{archiveDialog.classroom?.name}&quot;? Students
              will no longer be able to join this classroom.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setArchiveDialog({ open: false, classroom: null })}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => archiveDialog.classroom && handleArchive(archiveDialog.classroom)}
              disabled={isProcessing}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {isProcessing ? 'Archiving...' : 'Archive'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, classroom: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Classroom</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                Are you sure you want to permanently delete &quot;{deleteDialog.classroom?.name}
                &quot;? This action cannot be undone.
              </p>
              <p className="font-medium text-red-600">The following will be removed:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                <li>{deleteDialog.classroom?._count.members || 0} member connections</li>
                <li>{deleteDialog.classroom?._count.equipment || 0} equipment links</li>
                <li>All classroom settings</li>
                <li>Pending reservations will be cancelled</li>
              </ul>
              <p className="text-sm text-gray-500">
                Note: Equipment items will not be deleted, only unlinked from this classroom.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteDialog({ open: false, classroom: null })}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteDialog.classroom && handlePermanentDelete(deleteDialog.classroom)}
              disabled={isProcessing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isProcessing ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
