import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loginMicrosoft, loginGoogle } from '../services/api';
import { FlaskConical } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  token_missing: 'Token manquant dans la réponse du serveur.',
  auth_failed: 'Échec de l\'authentification. Réessayez.',
  access_denied: 'Accès refusé. Vérifiez vos droits.',
};

export function Login() {
  const { isAuthenticated, isLoading, loginDev } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loadingProvider, setLoadingProvider] = useState<'microsoft' | 'google' | null>(null);

  const errorKey = searchParams.get('error');
  const errorMsg = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? `Erreur d'authentification : ${errorKey}`)
    : null;

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  const redirectTo = async (
    provider: 'microsoft' | 'google',
    fetcher: () => Promise<{ url: string }>
  ) => {
    if (loadingProvider) return;
    setLoadingProvider(provider);
    try {
      const { url } = await fetcher();
      window.location.href = url;
    } catch {
      const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      window.location.href = `${base}/auth/${provider}`;
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
            style={{ backgroundColor: '#2563eb' }}
          >
            🎓
          </div>
          <h1 className="text-2xl font-bold text-white">AlternApp</h1>
          <p className="text-slate-500 text-sm mt-2">Votre assistant alternance intelligent</p>
        </div>

        {errorMsg && (
          <div
            className="rounded-xl px-4 py-3 text-sm mb-4 text-center"
            style={{ backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', color: 'var(--color-error-text)' }}
          >
            {errorMsg}
          </div>
        )}

        <div
          className="rounded-2xl p-6 space-y-3"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <OAuthButton
            onClick={() => redirectTo('microsoft', loginMicrosoft)}
            loading={loadingProvider === 'microsoft'}
            disabled={loadingProvider !== null}
            bgColor="#0078d4"
            textColor="white"
            icon={<MicrosoftIcon />}
            label="Se connecter avec Microsoft"
          />

          <OAuthButton
            onClick={() => redirectTo('google', loginGoogle)}
            loading={loadingProvider === 'google'}
            disabled={loadingProvider !== null}
            bgColor="var(--color-input)"
            textColor="var(--color-text)"
            border="1px solid var(--color-input-border)"
            icon={<GoogleIcon />}
            label="Se connecter avec Google"
          />
        </div>

        <button
          onClick={() => { loginDev(); navigate('/', { replace: true }); }}
          className="flex items-center justify-center gap-2 w-full mt-3 py-2.5 text-xs font-medium rounded-lg transition-colors hover:opacity-80"
          style={{ backgroundColor: 'var(--color-card2)', color: '#22c55e', border: '1px solid #166534' }}
        >
          <FlaskConical size={13} />
          Accès dev (sans backend)
        </button>

        <p className="text-center text-xs text-slate-600 mt-4">
          Connexion sécurisée via OAuth 2.0
        </p>
      </div>
    </div>
  );
}

interface OAuthButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  bgColor: string;
  textColor: string;
  border?: string;
  icon: ReactNode;
  label: string;
}

function OAuthButton({ onClick, loading, disabled, bgColor, textColor, border, icon, label }: OAuthButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ backgroundColor: bgColor, color: textColor, border }}
    >
      {loading ? <Spinner /> : icon}
      {loading ? 'Redirection…' : label}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
