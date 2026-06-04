import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

/** Password policy: min 8 chars, at least one letter, one number and one symbol. */
export const PASSWORD_POLICY = {
  minLength: 8,
  hasLetter: /[A-Za-z]/,
  hasNumber: /\d/,
  hasSymbol: /[^A-Za-z0-9]/,
};

export function passwordPolicyErrors(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < PASSWORD_POLICY.minLength) errors.push('mínimo de 8 caracteres');
  if (!PASSWORD_POLICY.hasLetter.test(pw)) errors.push('pelo menos uma letra');
  if (!PASSWORD_POLICY.hasNumber.test(pw)) errors.push('pelo menos um número');
  if (!PASSWORD_POLICY.hasSymbol.test(pw)) errors.push('pelo menos um símbolo');
  return errors;
}

/**
 * A valid bcrypt hash of a throwaway value. Used by the login route as a
 * constant-work comparison target when the account doesn't exist, so the
 * "user not found" and "wrong password" paths take similar time (anti-enumeration)
 * — and so `bcrypt.compare` never gets a malformed hash (which would throw).
 */
export const DUMMY_HASH = bcrypt.hashSync('a-non-matching-placeholder-password', BCRYPT_ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
