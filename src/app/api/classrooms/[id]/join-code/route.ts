import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { getClassroomContext } from '@/lib/classroom-context'
import { canChangeClassroomSettings } from '@/lib/permissions'
import { regenerateJoinCode } from '@/lib/join-code'

const regenerateSchema = z.object({
  expiresAt: z.string().datetime().optional(),
})

// POST /api/classrooms/[id]/join-code - Regenerate join code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const context = await getClassroomContext(session.user.id, session.user.role, id)

    if (!context) {
      return NextResponse.json({ error: 'Classroom not found or access denied' }, { status: 404 })
    }

    if (!canChangeClassroomSettings(context.userRole, session.user.role, context.isOwner)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { expiresAt } = regenerateSchema.parse(body)

    const newCode = await regenerateJoinCode(
      id,
      expiresAt ? new Date(expiresAt) : undefined
    )

    return NextResponse.json({
      joinCode: newCode,
      expiresAt: expiresAt || null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error regenerating join code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
