export type PasswordResetUserCandidate = {
  id: string;
  supabaseUserId: string | null;
};

export function selectPasswordResetUser<T extends PasswordResetUserCandidate>(
  users: T[],
  supabaseUserId: string
): T | null {
  return (
    users.find((candidate) => candidate.supabaseUserId === supabaseUserId) ??
    (users.length === 1 && users[0].supabaseUserId === null ? users[0] : null)
  );
}

/**
 * Nur ein bereits vorhandener, aber abweichender lokaler Hash belegt, dass
 * Supabase nach einem Passwortwechsel den neueren Stand kennt.
 */
export function initialPasswordFlagAfterSupabaseFallback(
  currentFlag: boolean,
  localPasswordHash: string | null
): boolean {
  return localPasswordHash ? false : currentFlag;
}
