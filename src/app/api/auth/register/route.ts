import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getConfig } from '@/lib/config';
import { sendTemplateEmail } from '@/lib/email';
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
  const enabled = await getConfig('WELCOME_EMAIL_ENABLED');
  if (enabled && !['1', 'true', 'yes', 'on'].includes(enabled.toLowerCase())) return;

  const siteUrl = await getConfig('NEXT_PUBLIC_SITE_URL') || await getConfig('NEXT_PUBLIC_BASE_URL') || '';
  const name = user.firstName || user.name || 'there';
  const template = {
    subject: 'Welcome to the studio',
    html: `<p>Hi ${escapeHtml(name)},</p><p>Thanks for joining the studio list. You can explore new artwork, read studio notes, and track orders from your account.</p><p><a href="${escapeHtml(siteUrl ? `${siteUrl}/shop` : '/shop')}">Visit the shop</a></p>`,
    text: `Hi ${name}, thanks for joining the studio list. You can explore artwork, read studio notes, and track orders from your account: ${siteUrl ? `${siteUrl}/shop` : '/shop'}`,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}