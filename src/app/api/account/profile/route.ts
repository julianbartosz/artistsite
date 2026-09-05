import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { prisma } from '@/lib/db';

const UpdateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function GET() {
  try {
    const session = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireUser();
    const body = UpdateProfileSchema.parse(await request.json());

    if (!body.firstName && !body.lastName && body.phone === undefined) {
      return NextResponse.json({ error: 'No profile fields to update' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, phone: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const firstName = body.firstName ?? existing.firstName ?? '';
    const lastName = body.lastName ?? existing.lastName ?? '';
    const name = `${firstName} ${lastName}`.trim() || session.user.name || session.user.email;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      profile: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid profile payload', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
