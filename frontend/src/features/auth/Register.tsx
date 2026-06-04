import { useState } from 'react';
import type { AuthUser } from '../../types';
import { Button, Field, Input } from '../../components';
import { authApi } from '../../services/auth';
import { ApiError } from '../../lib/apiClient';

interface RegisterProps {
  onRegistered: (user: AuthUser) => void;
}

/** Mirrors the server-side password policy so the user gets instant feedback. */
function passwordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

export function Register({ onRegistered }: RegisterProps) {
  const [username, setUsername] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = passwordChecks(password);
  const passwordOk = checks.length && checks.letter && checks.number && checks.symbol;

  /** Client-side validation surfaced on submit (mirrors the backend's zod rules). */
  function clientErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (username.trim().length < 3) e.username = 'Use ao menos 3 caracteres.';
    if (pharmacyName.trim().length < 2) e.pharmacyName = 'Informe o nome da farmácia.';
    if (!/\S+@\S+\.\S+/.test(email.trim())) e.email = 'E-mail inválido.';
    if (!passwordOk) e.password = 'A senha precisa cumprir os 4 requisitos acima.';
    return e;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ce = clientErrors();
    if (Object.keys(ce).length > 0) {
      setErrors(ce);
      setFormError(null);
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const user = await authApi.register({
        username: username.trim(),
        pharmacyName: pharmacyName.trim(),
        email: email.trim(),
        password,
      });
      onRegistered(user);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) setErrors(err.details);
        setFormError(err.details ? null : err.message);
      } else {
        setFormError('Não foi possível criar a conta. Tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  }

  // Clear a field's error as soon as the user edits it (no stale/contradictory messages).
  const clear = (k: string) => setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {formError && <div className="auth-error">{formError}</div>}

      <Field label="Nome de usuário">
        <Input
          value={username}
          onChange={(v) => {
            setUsername(v);
            clear('username');
          }}
          autoFocus
          placeholder="ex: farmacia.central"
        />
        {errors.username && <span className="field-error">{errors.username}</span>}
      </Field>

      <Field label="Nome da farmácia">
        <Input
          value={pharmacyName}
          onChange={(v) => {
            setPharmacyName(v);
            clear('pharmacyName');
          }}
          placeholder="ex: Farmácia Central"
        />
        {errors.pharmacyName && <span className="field-error">{errors.pharmacyName}</span>}
      </Field>

      <Field label="E-mail">
        <Input
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clear('email');
          }}
          placeholder="voce@exemplo.com"
        />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </Field>

      <Field label="Senha">
        <Input
          type="password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clear('password');
          }}
          placeholder="••••••••"
        />
        <ul className="pw-check" aria-label="Requisitos da senha">
          <li className={checks.length ? 'ok' : ''}>• 8+ caracteres</li>
          <li className={checks.letter ? 'ok' : ''}>• letra</li>
          <li className={checks.number ? 'ok' : ''}>• número</li>
          <li className={checks.symbol ? 'ok' : ''}>• símbolo</li>
        </ul>
        {errors.password && <span className="field-error">{errors.password}</span>}
      </Field>

      <Button kind="primary" size="lg" block type="submit" disabled={busy}>
        {busy ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  );
}
