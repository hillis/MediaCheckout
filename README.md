# Media Equipment Checkout System

A self-service equipment checkout system for Media Foundations students, built with Next.js 14 and deployed on Vercel.

## Features

- **Self-service checkout/check-in** via web interface
- **Google authentication** using school Gmail accounts
- **Backup admin login** with local username/password (when Google is unavailable)
- **Equipment browsing** with category filters and search
- **QR/Barcode scanning** for quick returns (manual entry also supported)
- **Future reservations** with date/time scheduling
- **Admin dashboard** for managing equipment, users, and reports
- **Late fee tracking** and management
- **Responsive design** works on phones, tablets, and desktop

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Vercel Postgres with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth + local admin passwords
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A Vercel account
- A Google Cloud project for OAuth

### 1. Clone and Install

```bash
cd MediaCheckout
npm install
```

### 2. Set Up Vercel Postgres

1. Go to your Vercel Dashboard
2. Create a new Postgres database (or use an existing one)
3. Copy the environment variables from the database settings

### 3. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Go to **Credentials** > **Create Credentials** > **OAuth client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (for development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (for production)
7. Copy the Client ID and Client Secret

### 4. Configure Environment Variables

Create a `.env.local` file:

```env
# Database (from Vercel Postgres)
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: Restrict to specific email domain
ALLOWED_EMAIL_DOMAIN="your-school.edu"
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 5. Set Up Database

```bash
# Push schema to database
npm run db:push

# Seed with sample equipment
npm run db:seed
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Deploy on Vercel

1. Import your repository on Vercel
2. Add all environment variables from `.env.local`
3. Update `NEXTAUTH_URL` to your production domain
4. Update Google OAuth redirect URI with production domain
5. Deploy

### 3. Initialize Production Database

After first deployment, run migrations:
```bash
npx prisma db push
npm run db:seed
```

## Usage

### Student Features

- **Browse**: View all available equipment with filters
- **Checkout**: Click to checkout available equipment
- **My Items**: View current checkouts and reservations
- **Reserve**: Book equipment for future dates
- **Return**: Scan or enter ID to return equipment

### Admin Features

- **Dashboard**: Overview of checkouts, overdue items, and stats
- **Equipment**: Add, edit, delete equipment items
- **Users**: Manage user roles and clear late fees
- **Settings**: Configure default checkout periods and fees

### Creating an Admin User with Password Login

For backup access when Google OAuth is unavailable, you can create admin accounts with local password authentication:

```bash
npm run db:create-admin admin@example.com "securepassword123" "Admin Name"
```

This creates an admin user that can sign in via the "Admin Login" tab on the sign-in page.

**Important**: Only ADMIN role users can use password login. Regular students must use Google OAuth.

### Making an Existing User Admin

1. Have the user sign in at least once (via Google)
2. Open Prisma Studio: `npm run db:studio`
3. Find the user in the User table
4. Change their `role` from `STUDENT` to `ADMIN`
5. Optionally, set a password for backup access:
   ```bash
   npm run db:create-admin their-email@school.edu "password" "Their Name"
   ```

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/     # Student pages (protected)
│   │   ├── browse/
│   │   ├── my-items/
│   │   ├── reserve/
│   │   └── return/
│   ├── admin/           # Admin pages (admin only)
│   │   ├── equipment/
│   │   ├── users/
│   │   └── settings/
│   ├── api/             # API routes
│   │   ├── auth/
│   │   ├── equipment/
│   │   ├── checkouts/
│   │   ├── reservations/
│   │   └── ...
│   └── auth/            # Auth pages
├── components/
│   ├── ui/              # Reusable UI components
│   └── layout/          # Layout components
├── lib/                 # Utilities and config
└── types/               # TypeScript types
```

## Customization

### Adding Equipment Categories

Edit the `categories` array in:
- `src/app/(dashboard)/browse/page.tsx`
- `src/app/admin/equipment/page.tsx`
- `src/lib/utils.ts` (for icons)

### Changing the Color Scheme

Edit CSS variables in `src/app/globals.css`

### Adding Email Notifications

Set up a Vercel Cron Job or Edge Function to:
1. Query overdue checkouts
2. Query checkouts due tomorrow
3. Send emails via your preferred service (Resend, SendGrid, etc.)

## License

MIT
