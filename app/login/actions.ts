'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// Every input crossing the trust boundary is validated with zod.
const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signupSchema = credentials.extend({
  full_name: z.string().min(1, 'Name is required'),
});

/** Email/password sign-in. Redirects back to /login with an error on failure. */
export async function login(formData: FormData): Promise<void> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    redirect('/login?error=' + encodeURIComponent('Enter a valid email and password.'));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Email/password sign-up. full_name is passed as user metadata; the
 * handle_new_user() DB trigger reads it to populate the agents row. If the
 * project requires email confirmation, the session won't be active until the
 * user confirms — the agents row is still created at signup time.
 */
export async function signup(formData: FormData): Promise<void> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Invalid signup details.';
    redirect('/login?error=' + encodeURIComponent(first));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name } },
  });
  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/** Sign out and return to the login page. */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
