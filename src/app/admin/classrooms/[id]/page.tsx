'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  School,
  Users,
  Package,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  UserPlus,
  Crown,
} from 'lucide-react'

type Member = {
  id: string
  userId: string
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
  isOwner?: boolean
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
}

type Classroom = {
  id: string
  name: string
  description: string | null
  joinCode: string
  joinCodeExpiresAt: string | null
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
    checkouts: number
    reservations: number
  }
}

export default function ClassroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<'STUDENT' | 'TEACHER' | 'ADMIN'>('STUDENT')
  const [addMemberError, setAddMemberError] = useState('')

  useEffect(() => {
    fetchClassroom()
    fetchMembers()
  }, [id])

  const fetchClassroom = async () => {
    try {
      const res = await fetch(`/api/classrooms/${id}`)
      if (res.ok) {
        const data = await res.json()
        setClassroom(data)
      }
    } catch (error) {
      console.error('Error fetching classroom:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/classrooms/${id}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const copyJoinCode = async () => {
    if (!classroom?.joinCode) return
    await navigator.clipboard.writeText(classroom.joinCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const regenerateCode = async () => {
    setIsRegenerating(true)
    try {
      const res = await fetch(`/api/classrooms/${id}/join-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        setClassroom((prev) => (prev ? { ...prev, joinCode: data.joinCode } : null))
      }
    } catch (error) {
      console.error('Error regenerating code:', error)
    } finally {
      setIsRegenerating(false)
    }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddMemberError('')

    try {
      const res = await fetch(`/api/classrooms/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole }),
      })
      const data = await res.json()

      if (!res.ok) {
        setAddMemberError(data.error || 'Failed to add member')
        return
      }

      setMembers((prev) => [...prev, data])
      setNewMemberEmail('')
      setShowAddMember(false)
    } catch (error) {
      setAddMemberError('Failed to add member')
    }
  }

  const updateMemberRole = async (userId: string, role: string) => {
    try {
      const res = await fetch(`/api/classrooms/${id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      if (res.ok) {
        const data = await res.json()
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, role: data.role } : m))
        )
      }
    } catch (error) {
      console.error('Error updating member role:', error)
    }
  }

  const removeMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const res = await fetch(`/api/classrooms/${id}/members?userId=${userId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId))
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading classroom...</div>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Classroom not found</p>
        <Link href="/admin/classrooms" className="text-blue-600 hover:underline mt-2 block">
          Back to Classrooms
        </Link>
      </div>
    )
  }

  const canManage = classroom.isOwner || classroom.memberRole === 'ADMIN'

  return (
    <div className="space-y-6">
      <Link
        href="/admin/classrooms"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Classrooms
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <School className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{classroom.name}</h1>
              {classroom.description && (
                <p className="text-gray-600 mt-1">{classroom.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Owner: {classroom.owner.name || classroom.owner.email}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Users className="h-5 w-5 text-gray-400 mx-auto mb-1" />
            <p className="text-2xl font-semibold text-gray-900">{classroom._count.members}</p>
            <p className="text-xs text-gray-500">Members</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Package className="h-5 w-5 text-gray-400 mx-auto mb-1" />
            <p className="text-2xl font-semibold text-gray-900">{classroom._count.equipment}</p>
            <p className="text-xs text-gray-500">Equipment</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-gray-900">{classroom._count.checkouts}</p>
            <p className="text-xs text-gray-500">Active Checkouts</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-gray-900">{classroom._count.reservations}</p>
            <p className="text-xs text-gray-500">Reservations</p>
          </div>
        </div>
      </div>

      {/* Join Code */}
      {canManage && classroom.joinCode && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Join Code</h2>
          <div className="flex items-center gap-4">
            <div className="bg-gray-100 rounded-lg px-6 py-3">
              <p className="text-3xl font-mono font-bold tracking-widest text-gray-900">
                {classroom.joinCode}
              </p>
            </div>
            <button
              onClick={copyJoinCode}
              className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Copy code"
            >
              {copiedCode ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={regenerateCode}
              disabled={isRegenerating}
              className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Generate new code"
            >
              <RefreshCw className={`h-5 w-5 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Share this code with students so they can join your classroom.
          </p>
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Members</h2>
          {canManage && (
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
          )}
        </div>

        {showAddMember && (
          <form onSubmit={addMember} className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex gap-3">
              <input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as typeof newMemberRole)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Add
              </button>
            </div>
            {addMemberError && (
              <p className="text-sm text-red-600 mt-2">{addMemberError}</p>
            )}
          </form>
        )}

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {member.user.image ? (
                  <img
                    src={member.user.image}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium">
                    {member.user.name?.[0] || member.user.email?.[0] || '?'}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    {member.user.name || member.user.email}
                    {member.isOwner && (
                      <span title="Owner">
                        <Crown className="h-4 w-4 text-yellow-500" />
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canManage && !member.isOwner ? (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => updateMemberRole(member.userId, e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="STUDENT">Student</option>
                      <option value="TEACHER">Teacher</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button
                      onClick={() => removeMember(member.userId)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-gray-500 px-2 py-1 bg-gray-200 rounded">
                    {member.isOwner ? 'Owner' : member.role}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
