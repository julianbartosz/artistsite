import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import {
  createJob,
  createJobFromThread,
  deleteJob,
  getCommissionSettings,
  getJobTemplates,
  listJobs,
  markJobStagePaidManually,
  postJobProgressUpdate,
  saveJobTemplates,
  sendProposalEmail,
  updateJob,
} from '@/lib/jobs';
import { issueCertificateForJob } from '@/lib/certificates';
import type { JobTemplate } from '@/lib/jobs-shared';

function handleError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');
    const [jobs, templates, commissionSettings] = await Promise.all([
      listJobs({ status, search }),
      getJobTemplates(),
      getCommissionSettings(),
    ]);
    return NextResponse.json({ jobs, templates, commissionSettings });
  } catch (error) {
    return handleError(error, 'Failed to load studio jobs');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (body?.action === 'from_thread') {
      const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : '';
      if (!threadId) return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
      const result = await createJobFromThread(threadId);
      return NextResponse.json(result, { status: result.existed ? 200 : 201 });
    }

    if (body?.action === 'save_templates') {
      const templates = await saveJobTemplates(body.templates as JobTemplate[]);
      return NextResponse.json({ templates });
    }

    const job = await createJob(body);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return handleError(error, 'Failed to create job');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });

    if (body.action === 'send_proposal') {
      const result = await sendProposalEmail(id);
      return NextResponse.json(result);
    }

    if (body.action === 'progress_update') {
      const result = await postJobProgressUpdate(id, {
        message: String(body.message || ''),
        imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
        nextStatus: body.nextStatus ?? null,
        notifyClient: body.notifyClient !== false,
      });
      return NextResponse.json(result);
    }

    if (body.action === 'mark_stage_paid') {
      const stage = body.stage === 'balance' ? 'balance' : 'deposit';
      const job = await markJobStagePaidManually(id, stage);
      return NextResponse.json({ job });
    }

    if (body.action === 'issue_coa') {
      const certificate = await issueCertificateForJob(id);
      return NextResponse.json({ certificate });
    }

    const job = await updateJob(id, body);
    return NextResponse.json({ job });
  } catch (error) {
    return handleError(error, 'Failed to update job');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    await deleteJob(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error, 'Failed to delete job');
  }
}
