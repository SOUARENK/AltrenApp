import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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

function AppRoutes() {
  return (
    <Routes>
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
