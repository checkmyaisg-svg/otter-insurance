/**
 * Typed result envelope returned by every server action. Callers switch on
 * `ok` and get a discriminated union — no throwing across the action boundary,
 * so the UI can render precise errors (validation vs conflict vs not-found).
 */
export type ActionErrorCode =
  | 'validation'
  | 'conflict'
  | 'not_found'
  | 'unauthorized'
  | 'unknown';

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(code: ActionErrorCode, error: string): ActionResult<never> {
  return { ok: false, code, error };
}

/**
 * Maps a Postgres/Supabase error to a typed action error. Recognizes the custom
 * SQLSTATEs raised by our RPCs (PT409 conflict, PT404 not-found) and common
 * Postgres codes, falling back to message inspection.
 */
export function mapDbError(
  e: { code?: string; message?: string } | null | undefined,
): ActionResult<never> {
  const code = e?.code ?? '';
  const msg = e?.message ?? 'Unexpected database error';
  if (code === 'PT409' || msg.includes('version_conflict')) {
    return fail(
      'conflict',
      'This record was changed in another tab. Refresh and try again.',
    );
  }
  if (code === 'PT404' || msg.includes('not_found')) {
    return fail('not_found', 'That record no longer exists.');
  }
  if (code === '28000' || msg.includes('unauthorized')) {
    return fail('unauthorized', 'You are not signed in.');
  }
  if (code === '23505') {
    return fail('validation', 'That value already exists.');
  }
  return fail('unknown', msg);
}
