'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, School, Users, Package, Settings, Copy, Check } from 'lucide-react'

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
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    fetchClassrooms()
  }, [])

  const fetchClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms')
      if (res.ok) {
        const data = await res.json()
        setClassrooms(data)
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

  const canCreateClassroom =
    session?.user.role === 'SUPER_ADMIN' ||
    session?.user.role === 'TEACHER_ADMIN' ||
    session?.user.role === 'TEACHER'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading classrooms...</div>
      </div>
    )
  }

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

      {classrooms.length === 0 ? (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((classroom) => (
            <div
              key={classroom.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <School className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{classroom.name}</h3>
                    <p className="text-sm text-gray-500">
                      {classroom.isOwner ? 'Owner' : classroom.memberRole}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/admin/classrooms/${classroom.id}`}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Settings className="h-4 w-4" />
                </Link>
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

              {(classroom.isOwner || classroom.memberRole === 'ADMIN') && classroom.joinCode && (
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
          ))}
        </div>
      )}
    </div>
  )
}
