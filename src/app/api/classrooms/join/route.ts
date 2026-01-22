import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { joinClassroomWithCode, findClassroomByJoinCode, isValidJoinCodeFormat } from '@/lib/join-code'

const joinSchema = z.object({
  code: z.string().min(1),
})

// GET /api/classrooms/join?code=ABC123 - Preview classroom before joining
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    if (!isValidJoinCodeFormat(code)) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
    }

    const classroom = await findClassroomByJoinCode(code)

    if (!classroom) {
      return NextResponse.json({ error: 'Invalid or expired join code' }, { status: 404 })
    }

    // Return limited info for preview
    return NextResponse.json({
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      owner: classroom.owner,
      _count: classroom._count,
    })
  } catch (error) {
    console.error('Error previewing classroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/classrooms/join - Join a classroom with code
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = joinSchema.parse(body)

    if (!isValidJoinCodeFormat(code)) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
    }

    const result = await joinClassroomWithCode(session.user.id, code)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      classroomId: result.classroomId,
      message: 'Successfully joined classroom'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error joining classroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
