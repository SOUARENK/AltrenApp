import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Agenda } from './pages/Agenda';
import { Files } from './pages/Files';
import { Revision } from './pages/Revision';
import { RevisionSheet } from './pages/RevisionSheet';
import { Settings } from './pages/Settings';
import { MailPage } from './pages/Mail';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';

/** Redirige vers /login si non connecté, affiche un écran de chargement pendant la vérification. */
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: '#2563eb',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="text-sm text-slate-500">Chargement…</p>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-8px); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="auth/callback" element={<AuthCallback />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:id" element={<Chat />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="files" element={<Files />} />
          <Route path="revision" element={<Revision />} />
          <Route path="revision/sheet" element={<RevisionSheet />} />
          <Route path="settings" element={<Settings />} />
          <Route path="mail" element={<MailPage />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
