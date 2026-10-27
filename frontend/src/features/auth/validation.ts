const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (v: string) => EMAIL.test(v.trim());

/** Client-side checks mirror the server's, so most mistakes are caught without a round trip. */
export function validateRegistration(v: {
  name: string;
  email: string;
  password: string;
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = 'Add your first name so we know what to call you.';
  if (!isEmail(v.email)) e.email = 'That email doesn’t look right. Check for a missing @ or dot.';
  if (v.password.length < 8) e.password = 'Use at least 8 characters for your password.';
  return e;
}
