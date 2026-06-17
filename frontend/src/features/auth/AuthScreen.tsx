import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/auth';
import { ApiError } from '../../lib/apiClient';
import { Login } from './Login';
import { Register } from './Register';
import { GoogleButton } from './GoogleButton';
import { CompleteProfileModal } from './CompleteProfileModal';

type Mode = 'login' | 'register';
interface PendingGoogle {
  credential: string;
  email: string;
  name: string;
}

/** Full-screen auth gate: login / cadastro + Google, shown when no one is logged in. */
export function AuthScreen() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [pending, setPending] = useState<PendingGoogle | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function handleGoogleCredential(credential: string) {
    setGoogleError(null);
    try {
      const res = await authApi.google(credential);
      if ('user' in res) setUser(res.user);
      else setPending({ credential, email: res.email, name: res.name });
    } catch (err) {
      setGoogleError(err instanceof ApiError ? err.message : 'Falha no login com Google.');
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">f</div>
          <div>
            <h1 className="auth-title tighter">auraFarma</h1>
            <div className="auth-sub">{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</div>
          </div>
        </div>

        {googleError && (
          <div className="auth-error" style={{ marginBottom: 14 }}>
            {googleError}
          </div>
        )}

        {mode === 'login' ? <Login onLoggedIn={setUser} /> : <Register onRegistered={setUser} />}

        <div className="auth-divider">ou</div>
        <GoogleButton onCredential={handleGoogleCredential} />

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <button type="button" onClick={() => setMode('register')}>
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button type="button" onClick={() => setMode('login')}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>

      {pending && (
        <CompleteProfileModal
          email={pending.email}
          suggestedName={pending.name}
          credential={pending.credential}
          onDone={(u) => {
            setPending(null);
            setUser(u);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
