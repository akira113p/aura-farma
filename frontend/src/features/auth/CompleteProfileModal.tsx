import { useState } from 'react';
import type { AuthUser } from '../../types';
import { Button, Field, Input, Modal } from '../../components';
import { authApi } from '../../services/auth';
import { ApiError } from '../../lib/apiClient';

interface CompleteProfileModalProps {
  email: string;
  suggestedName: string;
  credential: string;
  onDone: (user: AuthUser) => void;
  onCancel: () => void;
}

/** Shown after Google sign-in for a brand-new account: collect username + pharmacy. */
export function CompleteProfileModal({ email, suggestedName, credential, onDone, onCancel }: CompleteProfileModalProps) {
  const [username, setUsername] = useState(suggestedName.replace(/\s+/g, '').toLowerCase().slice(0, 30));
  const [pharmacyName, setPharmacyName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const user = await authApi.googleComplete(credential, username.trim(), pharmacyName.trim());
      onDone(user);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) setErrors(err.details);
        setFormError(err.details ? null : err.message);
      } else {
        setFormError('Não foi possível concluir o cadastro. Tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  }

  const valid = username.trim().length >= 3 && pharmacyName.trim().length >= 2;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Concluir cadastro"
      footer={
        <>
          <Button kind="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button kind="primary" onClick={submit} disabled={!valid || busy}>
            {busy ? 'Criando…' : 'Criar conta'}
          </Button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Entrando como <strong>{email}</strong>. Só precisamos de mais alguns dados.
      </p>
      {formError && <div className="auth-error">{formError}</div>}
      <Field label="Nome de usuário">
        <Input value={username} onChange={setUsername} autoFocus placeholder="ex: farmacia.central" />
        {errors.username && <span className="field-error">{errors.username}</span>}
      </Field>
      <Field label="Nome da farmácia">
        <Input value={pharmacyName} onChange={setPharmacyName} placeholder="ex: Farmácia Central" />
        {errors.pharmacyName && <span className="field-error">{errors.pharmacyName}</span>}
      </Field>
    </Modal>
  );
}
