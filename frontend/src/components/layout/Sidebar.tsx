
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  FolderOpen,
  BookOpen,
  LogOut,
  Menu,
  X,
  Settings,
  Mail,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'Chat IA' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/mail', icon: Mail, label: 'Mails' },
  { to: '/files', icon: FolderOpen, label: 'Fichiers' },
  { to: '/revision', icon: BookOpen, label: 'Révision' },
  { to: '/profile', icon: User, label: 'Profil' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 md:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onToggle} />
      )}

      <aside
        className="fixed top-0 left-0 z-30 h-full flex flex-col transition-all duration-300"
        style={{ width: isOpen ? '240px' : '64px', backgroundColor: 'var(--color-sidebar)', borderRight: '1px solid var(--color-sidebar-border)' }}
      >
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: '1px solid var(--color-sidebar-border)', height: '64px' }}>
          {isOpen && <span className="font-semibold text-lg truncate" style={{ color: 'var(--color-text)' }}>AlternApp</span>}
          <button onClick={onToggle} className="rounded-lg p-1.5 transition-colors hover:bg-black/10 ml-auto" style={{ color: 'var(--color-muted)' }}>
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              style={({ isActive }) => isActive
                ? { backgroundColor: '#2563eb', color: '#ffffff' }
                : { color: 'var(--color-muted)' }}
              title={!isOpen ? label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {isOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--color-sidebar-border)' }}>
          {isOpen && user && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#2563eb', color: 'white' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{user.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{user.email}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5" style={{ color: 'var(--color-muted)' }} title={!isOpen ? 'Déconnexion' : undefined}>
            <LogOut size={18} className="shrink-0" />
            {isOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
