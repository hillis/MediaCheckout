import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]
  const name = process.argv[4] || 'Admin'

  if (!email || !password) {
    console.log('Usage: npx tsx prisma/create-admin.ts <email> <password> [name]')
    console.log('Example: npx tsx prisma/create-admin.ts admin@school.edu mypassword123 "John Admin"')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long')
    process.exit(1)
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        name,
      },
      create: {
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        name,
      },
    })

    console.log(`Admin user created/updated successfully!`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Name: ${user.name}`)
    console.log(`  Role: ${user.role}`)
    console.log('')
    console.log('You can now sign in using the "Admin Login" tab on the sign-in page.')
  } catch (error) {
    console.error('Error creating admin user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
