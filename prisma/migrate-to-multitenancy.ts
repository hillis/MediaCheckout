/**
 * Migration script to convert single-tenant data to multi-tenant structure
 *
 * Run with: npx tsx prisma/migrate-to-multitenancy.ts
 *
 * This script:
 * 1. Promotes the first admin to SUPER_ADMIN
 * 2. Creates a default "Main Equipment Room" classroom
 * 3. Links all existing equipment to the default classroom
 * 4. Adds all users as members of the default classroom
 * 5. Updates existing checkouts/reservations with classroomId
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generateJoinCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function getUniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = await generateJoinCode()
    const existing = await prisma.classroom.findUnique({
      where: { joinCode: code },
    })
    if (!existing) return code
  }
  throw new Error('Could not generate unique join code')
}

async function main() {
  console.log('Starting multi-tenancy migration...\n')

  // Check if migration has already been run
  const existingClassrooms = await prisma.classroom.count()
  if (existingClassrooms > 0) {
    console.log('Migration appears to have already been run (classrooms exist).')
    console.log('If you need to re-run, please delete existing classrooms first.')
    return
  }

  // Step 1: Find and promote first user to SUPER_ADMIN
  // Note: We look for users by email pattern or just take the first user
  console.log('Step 1: Setting up SUPER_ADMIN...')

  // Find the first user (typically the original admin)
  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!firstUser) {
    console.log('  No users found in database. Skipping migration.')
    return
  }

  let superAdminId: string = firstUser.id

  // Check if user is already SUPER_ADMIN
  if (firstUser.role !== 'SUPER_ADMIN') {
    await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: 'SUPER_ADMIN' },
    })
    console.log(`  Promoted ${firstUser.email} to SUPER_ADMIN`)
  } else {
    console.log(`  ${firstUser.email} is already SUPER_ADMIN`)
  }

  // Step 2: Create default classroom
  console.log('\nStep 2: Creating default classroom...')
  const joinCode = await getUniqueJoinCode()

  const defaultClassroom = await prisma.classroom.create({
    data: {
      name: 'Main Equipment Room',
      description: 'Default classroom created during migration from single-tenant system',
      joinCode,
      ownerId: superAdminId,
    },
  })
  console.log(`  Created classroom "${defaultClassroom.name}" with code ${joinCode}`)

  // Step 3: Link all equipment to default classroom
  console.log('\nStep 3: Linking equipment to default classroom...')
  const equipment = await prisma.equipment.findMany({
    select: { id: true },
  })

  if (equipment.length > 0) {
    await prisma.classroomEquipment.createMany({
      data: equipment.map((e) => ({
        classroomId: defaultClassroom.id,
        equipmentId: e.id,
        isPrimary: true,
      })),
    })
    console.log(`  Linked ${equipment.length} equipment items to default classroom`)
  } else {
    console.log('  No equipment found to link')
  }

  // Step 4: Add all users as classroom members
  console.log('\nStep 4: Adding users as classroom members...')
  const users = await prisma.user.findMany({
    where: { id: { not: superAdminId } }, // Owner doesn't need membership
    select: { id: true, role: true },
  })

  if (users.length > 0) {
    await prisma.classroomMember.createMany({
      data: users.map((u) => ({
        classroomId: defaultClassroom.id,
        userId: u.id,
        role: u.role === 'TEACHER' || u.role === 'TEACHER_ADMIN' ? 'TEACHER' : 'STUDENT',
      })),
    })
    console.log(`  Added ${users.length} users as classroom members`)
  } else {
    console.log('  No additional users to add')
  }

  // Step 5: Update checkouts with classroomId
  console.log('\nStep 5: Updating checkouts with classroom context...')
  const checkoutsUpdated = await prisma.checkout.updateMany({
    where: { classroomId: { equals: undefined as any } },
    data: { classroomId: defaultClassroom.id },
  })
  console.log(`  Updated ${checkoutsUpdated.count} checkouts`)

  // Step 6: Update reservations with classroomId
  console.log('\nStep 6: Updating reservations with classroom context...')
  const reservationsUpdated = await prisma.reservation.updateMany({
    where: { classroomId: { equals: undefined as any } },
    data: { classroomId: defaultClassroom.id },
  })
  console.log(`  Updated ${reservationsUpdated.count} reservations`)

  console.log('\n✅ Migration completed successfully!')
  console.log('\nSummary:')
  console.log(`  - Super Admin: ${firstUser?.email || 'first user'}`)
  console.log(`  - Default Classroom: ${defaultClassroom.name}`)
  console.log(`  - Join Code: ${joinCode}`)
  console.log(`  - Equipment linked: ${equipment.length}`)
  console.log(`  - Members added: ${users.length}`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
