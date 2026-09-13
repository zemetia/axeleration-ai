'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';

import { signIn } from '@/auth';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validations';

/** Machine-readable outcome — user-facing copy is resolved client-side. */
export type RegisterErrorCode = 'emailTaken' | 'createdSignIn';

export interface RegisterResult {
  /** Zod field errors, keyed by field name. Messages come from the schema. */
  errors?: Record<string, string[]>;
  code?: RegisterErrorCode;
}

export async function registerAction(_prevState: RegisterResult, formData: FormData): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { code: 'emailTaken' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, password: passwordHash },
  });

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/dashboard',
    });
    return {};
  } catch (error) {
    // NEXT_REDIRECT is thrown on success and must propagate.
    if (error instanceof AuthError) return { code: 'createdSignIn' };
    throw error;
  }
}
