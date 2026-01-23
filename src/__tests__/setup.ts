/**
 * Jest setup file for test configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_SECRET = 'test-secret-for-jest'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    classroom: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    classroomMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    equipment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    classroomEquipment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    checkout: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({
      equipment: { create: jest.fn(), delete: jest.fn() },
      classroomEquipment: { create: jest.fn(), deleteMany: jest.fn() },
    })),
  },
}))

// Silence console.error in tests unless debugging
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Only show errors containing specific keywords during tests
    if (
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          (arg.includes('FAIL') || arg.includes('Error:'))
      )
    ) {
      originalError.apply(console, args)
    }
  }
})

afterAll(() => {
  console.error = originalError
})

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})
