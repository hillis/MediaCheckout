'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { School, Users, Package, ArrowRight, Check } from 'lucide-react'

type ClassroomPreview = {
  id: string
  name: string
  description: string | null
  owner: {
    name: string | null
    email: string | null
  }
  _count: {
    members: number
    equipment: number
  }
}

export default function JoinClassroomPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ClassroomPreview | null>(null)
  const [success, setSuccess] = useState(false)

  const handleCodeChange = (value: string) => {
    // Auto-uppercase and remove invalid characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setCode(cleaned)
    setError('')
    setPreview(null)
  }

  const handlePreview = async () => {
    if (code.length !== 6) {
      setError('Join code must be 6 characters')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/classrooms/join?code=${code}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid join code')
        return
      }

      setPreview(data)
    } catch (err) {
      setError('Failed to verify code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoin = async () => {
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/classrooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to join classroom')
        return
      }

      setSuccess(true)

      // Redirect after a short delay
      setTimeout(() => {
        router.push('/browse')
        router.refresh()
      }, 2000)
    } catch (err) {
      setError('Failed to join classroom')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="bg-green-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h1>
        <p className="text-gray-600 mb-4">
          You&apos;ve successfully joined <strong>{preview?.name}</strong>
        </p>
        <p className="text-sm text-gray-500">Redirecting you to browse equipment...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="text-center mb-8">
        <div className="bg-blue-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <School className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Join a Classroom</h1>
        <p className="text-gray-600">
          Enter the 6-character join code provided by your teacher
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
            Join Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="ABC123"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
            maxLength={6}
            disabled={isLoading || !!preview}
          />
          <p className="mt-2 text-sm text-gray-500 text-center">
            {code.length}/6 characters
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {!preview ? (
          <button
            onClick={handlePreview}
            disabled={code.length !== 6 || isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                Verifying...
              </>
            ) : (
              <>
                Verify Code
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">{preview.name}</h3>
              {preview.description && (
                <p className="text-sm text-gray-600 mb-3">{preview.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {preview._count.members} members
                </div>
                <div className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {preview._count.equipment} items
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Teacher: {preview.owner.name || preview.owner.email}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPreview(null)
                  setCode('')
                }}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={isLoading}
                className="flex-1 py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Joining...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Join Classroom
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
