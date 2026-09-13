'use server';

import { z } from 'zod';

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { projectSchema, projectUpdateSchema } from '@/lib/validations';
import { projectService } from '@/services';

/*
 * THIS FILE IS IN THE CLIENT'S MODULE GRAPH.
 *
 * `'use server'` marks these functions as server-only at *runtime*, but the client
 * components that call them (`useProjects` → `DashboardContent` → the dashboard) still
 * `import` this module, so the bundler must walk everything it imports at build time.
 *
 * This file used to import `@/ai/premise/refine-premise-chain` and `@/providers/register`
 * at module scope. Those pull in LangChain, LangGraph, and every provider SDK
 * (@langchain/anthropic, @langchain/openai, @google/genai, replicate, @fal-ai/client,
 * elevenlabs) — tens of thousands of modules that Turbopack had to traverse before the
 * dashboard could render a single project card. That is what made most pages sit on a
 * loading skeleton forever.
 *
 * Rule for this file: no static import of anything from `@/ai`, `@/inngest`, `@/mcp` or
 * `@/providers/register`. Pull them in with `await import()` inside the one action that
 * needs them, so the cost is paid on that call and never at compile time.
 */
async function emitBibleGenerate(projectId: string): Promise<void> {
  const [{ inngest }, { bibleGenerate }] = await Promise.all([
    import('@/inngest/client'),
    import('@/inngest/events'),
  ]);
  await inngest.send(bibleGenerate.create({ projectId }));
}

export interface ActionResult {
  errors?: Record<string, string[]>;
  message?: string;
  projectId?: string;
}

export interface RefinePremiseResult {
  premise?: string;
  message?: string;
}

const refinePremiseInputSchema = z.object({
  premise: z.string().min(1, 'Premise is required').max(4000, 'Premise is too long'),
  projectType: z.string().min(1),
});

/**
 * Returns the new project id instead of calling `redirect()` — this action is invoked
 * through TanStack Query's `mutateAsync`, not a `<form action>`, so it runs outside the
 * transition Next.js needs to apply a server-side redirect. Callers navigate themselves.
 */
export async function createProjectAction(input: unknown): Promise<ActionResult> {
  const session = await requireAuth();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const project = await projectService.create(session.user.id, parsed.data);
  await prisma.characterBible.create({
    data: { projectId: project.id, lockedTraits: {}, status: 'generating' },
  });
  await emitBibleGenerate(project.id);

  return { projectId: project.id };
}

export async function updateProjectAction(projectId: string, input: unknown): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await projectService.ownerOf(projectId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  const parsed = projectUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await projectService.update(projectId, parsed.data);
  return {};
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await projectService.ownerOf(projectId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  await projectService.remove(projectId);

  return {};
}

/** New-project wizard has no `projectId` yet — any authenticated user may call this, it never touches the DB. */
export async function refinePremiseAction(input: unknown): Promise<RefinePremiseResult> {
  await requireAuth();
  const parsed = refinePremiseInputSchema.safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? 'Invalid premise' };
  }

  try {
    const [{ registerProviders }, { runRefinePremiseChain }] = await Promise.all([
      import('@/providers/register'),
      import('@/ai/premise/refine-premise-chain'),
    ]);
    registerProviders();
    const premise = await runRefinePremiseChain(parsed.data);
    return { premise: premise.trim() };
  } catch (err) {
    console.error('[refinePremiseAction] failed:', err);
    return { message: 'Could not refine the premise right now — try again in a moment.' };
  }
}

export async function resetCharacterBibleAction(projectId: string): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await projectService.ownerOf(projectId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  const existing = await prisma.characterBible.findUnique({ where: { projectId } });
  await prisma.characterBible.upsert({
    where: { projectId },
    create: { projectId, lockedTraits: {}, status: 'generating' },
    update: { version: (existing?.version ?? 1) + 1, lockedTraits: {}, status: 'generating' },
  });
  await emitBibleGenerate(projectId);

  return {};
}
