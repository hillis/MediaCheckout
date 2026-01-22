import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserClassrooms, getAllClassrooms } from '@/lib/classroom-context'
import { canManageAllClassrooms } from '@/lib/permissions'

// GET /api/classrooms/my - Get current user's classrooms
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Super admins see all classrooms
    if (canManageAllClassrooms(session.user.role)) {
      const classrooms = await getAllClassrooms()
      return NextResponse.json(classrooms)
    }

    const classrooms = await getUserClassrooms(session.user.id)
    return NextResponse.json(classrooms)
  } catch (error) {
    console.error('Error fetching user classrooms:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
