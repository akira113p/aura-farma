import { z } from 'zod';
import { PASSWORD_POLICY } from './password';

const username = z
  .string()
  .trim()
  .min(3, 'O nome de usuário precisa de ao menos 3 caracteres')
  .max(30, 'O nome de usuário pode ter no máximo 30 caracteres')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use apenas letras, números, ponto, hífen ou underline');

const pharmacyName = z
  .string()
  .trim()
  .min(2, 'Informe o nome da farmácia')
  .max(120, 'Nome da farmácia muito longo');

const email = z.string().trim().toLowerCase().email('E-mail inválido');

const password = z
  .string()
  .min(PASSWORD_POLICY.minLength, 'A senha precisa de ao menos 8 caracteres')
  .regex(PASSWORD_POLICY.hasLetter, 'A senha precisa de ao menos uma letra')
  .regex(PASSWORD_POLICY.hasNumber, 'A senha precisa de ao menos um número')
  .regex(PASSWORD_POLICY.hasSymbol, 'A senha precisa de ao menos um símbolo');

export const registerSchema = z.object({
  username,
  pharmacyName,
  email,
  password,
});

export const loginSchema = z.object({
  // accepts either the e-mail or the username
  identifier: z.string().trim().min(1, 'Informe o e-mail ou usuário'),
  password: z.string().min(1, 'Informe a senha'),
});

export const googleVerifySchema = z.object({
  credential: z.string().min(1, 'Token do Google ausente'),
});

export const googleCompleteSchema = z.object({
  credential: z.string().min(1, 'Token do Google ausente'),
  username,
  pharmacyName,
});

/** Catalog search query params (`q` + optional `limit`). */
export const medSearchSchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleCompleteInput = z.infer<typeof googleCompleteSchema>;
export type MedSearchInput = z.infer<typeof medSearchSchema>;
