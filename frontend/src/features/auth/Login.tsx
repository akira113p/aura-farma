import { useState } from 'react';
import type { AuthUser } from '../../types';
import { Button, Field, Input } from '../../components';
import { authApi } from '../../services/auth';
import { ApiError } from '../../lib/apiClient';

interface LoginProps {
  onLoggedIn: (user: AuthUser) => void;
}

export function Login({ onLoggedIn }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (identifier.trim().length === 0 || password.length === 0) {
      setFormError('Preencha o e-mail/usuário e a senha.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const user = await authApi.login(identifier.trim(), password);
      onLoggedIn(user);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {formError && <div className="auth-error">{formError}</div>}

      <Field label="E-mail ou usuário">
        <Input value={identifier} onChange={setIdentifier} autoFocus placeholder="voce@exemplo.com ou usuário" />
      </Field>

      <Field label="Senha">
        <Input type="password" value={password} onChange={setPassword} placeholder="••••••••" />
      </Field>

      <Button kind="primary" size="lg" block type="submit" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
