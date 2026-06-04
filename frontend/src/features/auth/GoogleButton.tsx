import { useEffect, useRef, useState } from 'react';
import { authApi, type GoogleConfig } from '../../services/auth';

/** Minimal typing for the Google Identity Services global we use. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (opts: { client_id: string; callback: (r: { credential?: string }) => void }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: { accounts?: GoogleIdentity['accounts'] };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleButtonProps {
  onCredential: (credential: string) => void;
}

/**
 * "Entrar com Google" using Google Identity Services. Fetches the public client id
 * from the backend (`/auth/google/config`). If Google isn't configured, renders a
 * disabled button so the option is visible but clearly inactive.
 */
export function GoogleButton({ onCredential }: GoogleButtonProps) {
  const [cfg, setCfg] = useState<GoogleConfig | null>(null);
  // Initialize from whether GIS is already on window, so the effect only updates
  // state inside the async `load` callback (never synchronously in the effect body).
  const [scriptReady, setScriptReady] = useState<boolean>(() => Boolean(window.google?.accounts));
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authApi.googleConfig().then(setCfg).catch(() => setCfg({ enabled: false, clientId: '' }));
  }, []);

  useEffect(() => {
    if (!cfg?.enabled || scriptReady) return;
    let script = document.getElementById('gis-script') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'gis-script';
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onLoad = () => setScriptReady(true);
    script.addEventListener('load', onLoad);
    return () => script?.removeEventListener('load', onLoad);
  }, [cfg?.enabled, scriptReady]);

  useEffect(() => {
    if (!cfg?.enabled || !scriptReady || !window.google?.accounts || !divRef.current) return;
    window.google.accounts.id.initialize({
      client_id: cfg.clientId,
      callback: (r) => {
        if (r.credential) onCredential(r.credential);
      },
    });
    window.google.accounts.id.renderButton(divRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
      locale: 'pt-BR',
    });
  }, [cfg, scriptReady, onCredential]);

  if (cfg && !cfg.enabled) {
    return (
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled
        title="Defina GOOGLE_CLIENT_ID no backend para ativar"
      >
        Entrar com Google (desativado)
      </button>
    );
  }

  return <div ref={divRef} className="google-btn" />;
}
