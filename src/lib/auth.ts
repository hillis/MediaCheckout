import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { Adapter } from 'next-auth/adapters'
import bcrypt from 'bcryptjs'
import { assignUserToDefaultClassroom } from './default-classroom'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Admin Login',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error('No user found with this email')
        }

        if (!user.password) {
          throw new Error('This account does not have password login enabled')
        }

        // Allow password login for super admins and teacher admins
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'TEACHER_ADMIN') {
          throw new Error('Only admin accounts can use password login')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error('Invalid password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For credentials login, always allow (already validated in authorize)
      if (account?.provider === 'credentials') {
        return true
      }

      // For Google login, restrict to allowed email domains
      const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS
      if (allowedDomains && user.email) {
        const domains = allowedDomains.split(',').map(d => d.trim().toLowerCase())
        const userDomain = user.email.split('@')[1]?.toLowerCase()
        return domains.includes(userDomain)
      }
      return true
    },
    async session({ session, token, user }) {
      if (session.user) {
        // For JWT strategy (credentials), use token.sub
        // For database strategy (Google), use user.id
        const userId = token?.sub || user?.id

        if (userId) {
          session.user.id = userId
          // Fetch user role from database
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, totalLateFees: true },
          })
          session.user.role = dbUser?.role || 'STUDENT'
          session.user.totalLateFees = dbUser?.totalLateFees || 0
        }
      }
      return session
    },
    async jwt({ token, user }) {
      // Persist user id to the token on initial sign in
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
  events: {
    async createUser({ user }) {
      // Auto-assign new users to default classroom
      if (user.id) {
        await assignUserToDefaultClassroom(user.id)
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    // Use JWT for credentials provider, database for OAuth
    strategy: 'jwt',
  },
}
