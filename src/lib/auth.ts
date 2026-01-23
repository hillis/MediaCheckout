import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { Adapter } from 'next-auth/adapters'
import bcrypt from 'bcryptjs'
import { assignUserToDefaultClassroom } from './default-classroom'
import { Role } from '@prisma/client'

// Token refresh interval in seconds (5 minutes)
const TOKEN_REFRESH_INTERVAL = 5 * 60

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
    async session({ session, token }) {
      if (session.user && token) {
        // Use cached data from JWT token instead of hitting database
        session.user.id = token.sub as string
        session.user.role = (token.role as Role) || 'STUDENT'
        session.user.totalLateFees = (token.totalLateFees as number) || 0
      }
      return session
    },
    async jwt({ token, user, trigger }) {
      // On initial sign in, fetch and cache user data in token
      if (user) {
        token.sub = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, totalLateFees: true },
        })
        token.role = dbUser?.role || 'STUDENT'
        token.totalLateFees = dbUser?.totalLateFees || 0
        token.lastRefresh = Date.now()
      }

      // Refresh token data periodically (every 5 minutes) or on update trigger
      const lastRefresh = (token.lastRefresh as number) || 0
      const shouldRefresh = trigger === 'update' || (Date.now() - lastRefresh > TOKEN_REFRESH_INTERVAL * 1000)

      if (shouldRefresh && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, totalLateFees: true },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.totalLateFees = dbUser.totalLateFees
          token.lastRefresh = Date.now()
        }
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
