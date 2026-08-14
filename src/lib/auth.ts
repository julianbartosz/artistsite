import { NextAuthOptions } from 'next-auth';
import { getServerSession, type Session } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import { prisma } from '@/lib/db';

const DEFAULT_LOCAL_ADMIN_PASSWORD = 'AdminPass123!';
const DEV_AUTH_SECRET = 'artistsite-local-auth-secret';

function resolvedAuthSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV !== 'production' ? DEV_AUTH_SECRET : undefined);
}

function configuredAdminEmails(): Set<string> {
  const emails = new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  );

  if (process.env.NODE_ENV !== 'production') {
    emails.add('artist@artistsite.com');
  }

  return emails;
}

async function resolvedAdminEmails(): Promise<Set<string>> {
  const emails = configuredAdminEmails();
  const settingEmails = await getConfig('ADMIN_EMAILS');
  (settingEmails || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
    .forEach(email => emails.add(email));
  return emails;
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

export async function isAdminEmailResolved(email?: string | null): Promise<boolean> {
  if (!email) return false;
  return (await resolvedAdminEmails()).has(email.trim().toLowerCase());
}

export async function requireUser(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
  }
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!await isAdminEmailResolved(session.user.email)) {
    throw new ApiError(403, 'Admin access required', 'FORBIDDEN');
  }
  return session;
}

function localAdminBootstrapPassword(): string {
  return (process.env.LOCAL_ADMIN_PASSWORD || DEFAULT_LOCAL_ADMIN_PASSWORD).trim();
}

function isLocalBootstrapAdminEmail(email: string): boolean {
  return process.env.NODE_ENV !== 'production' && configuredAdminEmails().has(email.trim().toLowerCase());
}

async function tryBootstrapLocalAdmin(email: string, password: string) {
  if (process.env.NODE_ENV === 'production') return null;
  if (!isLocalBootstrapAdminEmail(email) && !await isAdminEmailResolved(email)) return null;

  const bootstrapPassword = localAdminBootstrapPassword();
  if (!bootstrapPassword || password !== bootstrapPassword) return null;

  const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      name: 'Admin User',
      emailVerified: new Date(),
    },
    update: {
      password: passwordHash,
      emailVerified: new Date(),
    },
  });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    // Email/Password Authentication
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();

        const bootstrapUser = isLocalBootstrapAdminEmail(normalizedEmail)
          ? await tryBootstrapLocalAdmin(normalizedEmail, credentials.password)
          : null;
        if (bootstrapUser) {
          return {
            id: bootstrapUser.id,
            email: bootstrapUser.email,
            name: bootstrapUser.name || `${bootstrapUser.firstName || ''} ${bootstrapUser.lastName || ''}`.trim(),
            image: bootstrapUser.image,
          };
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail }
        });

        if (user?.password) {
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (isPasswordValid) {
            return {
              id: user.id,
              email: user.email,
              name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              image: user.image,
            };
          }
        }

        // Deterministic local-admin bootstrap keeps development auth reproducible.
        const resolvedBootstrapUser = await tryBootstrapLocalAdmin(normalizedEmail, credentials.password);
        if (!resolvedBootstrapUser) return null;

        return {
          id: resolvedBootstrapUser.id,
          email: resolvedBootstrapUser.email,
          name: resolvedBootstrapUser.name || `${resolvedBootstrapUser.firstName || ''} ${resolvedBootstrapUser.lastName || ''}`.trim(),
          image: resolvedBootstrapUser.image,
        };
      }
    }),
    
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  session: {
    strategy: 'jwt',
  },
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      token.isAdmin = await isAdminEmailResolved((user?.email || token.email) as string | undefined);
      return token;
    },
    
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      session.user.isAdmin = Boolean(token.isAdmin);
      return session;
    },
    
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          });

          if (!existingUser) {
            // Create new user for Google sign-in
            await prisma.user.create({
              data: {
                email: user.email as string,
                name: user.name as string,
                image: user.image,
                emailVerified: new Date(),
                firstName: (profile as any)?.given_name as string,
                lastName: (profile as any)?.family_name as string,
              }
            });
          }
        } catch (error) {
          console.error('Error during Google sign-in:', error);
          return false;
        }
      }
      return true;
    },
  },
  
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  
  events: {
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`);
    },
    async signIn({ user, account, isNewUser }) {
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
    },
  },
  
  secret: resolvedAuthSecret(),
};