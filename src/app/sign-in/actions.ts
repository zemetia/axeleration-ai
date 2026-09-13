'use server';

import { AuthError } from 'next-auth';

import { signIn } from '@/auth';

export interface SignInResult {
  /** Flag only — the user-facing string is resolved client-side so it can be translated. */
  error?: boolean;
}

export async function signInAction(_prevState: SignInResult, formData: FormData): Promise<SignInResult> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    });
    return {};
  } catch (error) {
    // NEXT_REDIRECT is thrown on success and must propagate.
    if (error instanceof AuthError) return { error: true };
    throw error;
  }
}
