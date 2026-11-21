import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getConfigBool } from '@/lib/config';
import { brandedEmailHtml, getEmailBrand, sendTemplateEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/utils';
import { escapeHtml } from '@/lib/email-shell';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, phone } = body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Validate required fields
    if (!normalizedEmail || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        createdAt: true,
      }
    });

    console.log(`New user registered: ${user.email}`);

    await sendWelcomeEmail(user).catch((error) => {
      console.error('Welcome email automation failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

async function sendWelcomeEmail(user: { id: string; email: string; name: string | null; firstName: string | null }) {
  if (!(await getConfigBool('WELCOME_EMAIL_ENABLED'))) return;

  const brand = await getEmailBrand();
  const shopUrl = absoluteUrl('/shop', brand.siteUrl);
  const name = user.firstName || user.name || 'there';
  const template = {
    subject: `Welcome to ${brand.siteName}`,
    html: brandedEmailHtml(brand, {
      title: 'Welcome to the studio',
      intro: `Hi ${escapeHtml(name)}, thanks for joining. You can explore new artwork, read studio notes, and track orders from your account.`,
      cta: { label: 'Visit the shop', href: shopUrl },
    }),
    text: `Hi ${name}, thanks for joining. You can explore artwork, read studio notes, and track orders from your account: ${shopUrl}`,
  };

  const ok = await sendTemplateEmail(user.email, template);
  await prisma.analyticsEvent.create({
    data: {
      eventName: ok ? 'email_sent' : 'email_failed',
      userId: user.id,
      properties: JSON.stringify({ automation: 'welcome', recipient_email: user.email, delivery_success: ok }),
      timestamp: new Date(),
    },
  }).catch(() => undefined);
}