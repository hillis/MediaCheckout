'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, School, Plus } from 'lucide-react'
import Link from 'next/link'

type ClassroomOption = {
  id: string
  name: string
  memberRole: string
  isOwner: boolean
}

type ClassroomSelectorProps = {
  currentClassroomId?: string
  onClassroomChange: (classroomId: string) => void
  canCreateClassroom?: boolean
}

export function ClassroomSelector({
  currentClassroomId,
  onClassroomChange,
  canCreateClassroom = false,
}: ClassroomSelectorProps) {
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchClassrooms()
  }, [])

  const fetchClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms/my')
      if (res.ok) {
        const data = await res.json()
        setClassrooms(data)

        // If no current classroom selected, select first one
        if (!currentClassroomId && data.length > 0) {
          onClassroomChange(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentClassroom = classrooms.find((c) => c.id === currentClassroomId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <School className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    )
  }

  if (classrooms.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/join"
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-4 w-4" />
          Join a Classroom
        </Link>
        {canCreateClassroom && (
          <Link
            href="/admin/classrooms/new"
            className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:text-green-700"
          >
            <Plus className="h-4 w-4" />
            Create Classroom
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
      >
        <School className="h-4 w-4" />
        <span className="max-w-[150px] truncate">
          {currentClassroom?.name || 'Select Classroom'}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
            <div className="py-1 max-h-64 overflow-y-auto">
              {classrooms.map((classroom) => (
                <button
                  key={classroom.id}
                  onClick={() => {
                    onClassroomChange(classroom.id)
                    setIsOpen(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    classroom.id === currentClassroomId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="truncate">{classroom.name}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {classroom.isOwner ? 'Owner' : classroom.memberRole.toLowerCase()}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-gray-200 py-1">
              <Link
                href="/join"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Join a Classroom
              </Link>
              {canCreateClassroom && (
                <Link
                  href="/admin/classrooms/new"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  Create Classroom
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
