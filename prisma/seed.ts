import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sampleEquipment = [
  {
    equipmentId: 'CAM-001',
    name: 'Canon EOS R5',
    category: 'Camera',
    description: 'Professional mirrorless camera with 45MP sensor and 8K video',
    photoUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400',
    dailyLateFee: 10.0,
    maxCheckoutDays: 3,
  },
  {
    equipmentId: 'CAM-002',
    name: 'Sony A7 IV',
    category: 'Camera',
    description: '33MP full-frame mirrorless camera with advanced autofocus',
    photoUrl: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400',
    dailyLateFee: 10.0,
    maxCheckoutDays: 3,
  },
  {
    equipmentId: 'CAM-003',
    name: 'Blackmagic Pocket 6K',
    category: 'Camera',
    description: 'Cinema camera with Super 35 sensor and ProRes recording',
    photoUrl: 'https://images.unsplash.com/photo-1585171953545-1da7efe88e5d?w=400',
    dailyLateFee: 15.0,
    maxCheckoutDays: 2,
  },
  {
    equipmentId: 'LENS-001',
    name: 'Canon RF 24-70mm f/2.8',
    category: 'Lens',
    description: 'Professional standard zoom lens for RF mount',
    photoUrl: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=400',
    dailyLateFee: 5.0,
    maxCheckoutDays: 7,
  },
  {
    equipmentId: 'LENS-002',
    name: 'Sony 70-200mm f/2.8 GM',
    category: 'Lens',
    description: 'G Master telephoto zoom lens',
    photoUrl: 'https://images.unsplash.com/photo-1606986628253-e06a6e30e7f0?w=400',
    dailyLateFee: 5.0,
    maxCheckoutDays: 7,
  },
  {
    equipmentId: 'AUD-001',
    name: 'Rode NTG5',
    category: 'Audio',
    description: 'Professional shotgun microphone for film production',
    photoUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400',
    dailyLateFee: 3.0,
    maxCheckoutDays: 7,
  },
  {
    equipmentId: 'AUD-002',
    name: 'Zoom H6 Recorder',
    category: 'Audio',
    description: '6-track portable recorder with interchangeable capsules',
    photoUrl: 'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=400',
    dailyLateFee: 3.0,
    maxCheckoutDays: 7,
  },
  {
    equipmentId: 'AUD-003',
    name: 'Sennheiser Wireless Lav Kit',
    category: 'Audio',
    description: 'Professional wireless lavalier microphone system',
    photoUrl: 'https://images.unsplash.com/photo-1558470598-a5dda9640f68?w=400',
    dailyLateFee: 5.0,
    maxCheckoutDays: 5,
  },
  {
    equipmentId: 'LIGHT-001',
    name: 'Aputure 600d Pro',
    category: 'Lighting',
    description: 'Professional LED light with 600W output',
    photoUrl: 'https://images.unsplash.com/photo-1493863641943-9b68992a8d07?w=400',
    dailyLateFee: 8.0,
    maxCheckoutDays: 3,
  },
  {
    equipmentId: 'LIGHT-002',
    name: 'Aputure MC 4-Light Kit',
    category: 'Lighting',
    description: 'Portable RGBWW LED light kit with charging case',
    photoUrl: 'https://images.unsplash.com/photo-1565784299436-39fe6c718873?w=400',
    dailyLateFee: 5.0,
    maxCheckoutDays: 5,
  },
  {
    equipmentId: 'GRIP-001',
    name: 'DJI RS 3 Pro',
    category: 'Grip',
    description: '3-axis gimbal stabilizer for cinema cameras',
    photoUrl: 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=400',
    dailyLateFee: 8.0,
    maxCheckoutDays: 3,
  },
  {
    equipmentId: 'GRIP-002',
    name: 'Manfrotto 504X Tripod',
    category: 'Grip',
    description: 'Professional video tripod with fluid head',
    photoUrl: 'https://images.unsplash.com/photo-1617727553252-65863c156eb0?w=400',
    dailyLateFee: 3.0,
    maxCheckoutDays: 7,
  },
]

async function main() {
  console.log('Seeding database...')

  // Clear existing equipment
  await prisma.equipment.deleteMany()

  // Create sample equipment
  for (const equipment of sampleEquipment) {
    await prisma.equipment.create({
      data: equipment,
    })
    console.log(`Created: ${equipment.name}`)
  }

  // Create default settings
  await prisma.settings.upsert({
    where: { key: 'defaultCheckoutDays' },
    update: { value: '7' },
    create: { key: 'defaultCheckoutDays', value: '7' },
  })

  await prisma.settings.upsert({
    where: { key: 'defaultLateFee' },
    update: { value: '5.00' },
    create: { key: 'defaultLateFee', value: '5.00' },
  })

  await prisma.settings.upsert({
    where: { key: 'reminderDaysBefore' },
    update: { value: '1' },
    create: { key: 'reminderDaysBefore', value: '1' },
  })

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
