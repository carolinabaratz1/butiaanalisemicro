import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Kanban, Settings, Briefcase,
  CalendarDays, ArrowLeftRight, Upload, BarChart3, Activity, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ButiaLogo } from '@/components/ui/ButiaLogo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const mainItems = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/' },
  { label: 'Posições',          icon: Briefcase,        path: '/posicoes' },
  { label: 'Positions Monitor', icon: BarChart3,        path: '/positions-monitor' },
  { label: 'Emissores',         icon: Building2,        path: '/emissores' },
  { label: 'Rating Resolver',   icon: Sparkles,         path: '/ratings/resolver' },
  { label: 'Assembleias',       icon: CalendarDays,     path: '/assembleias' },
  { label: 'Pipeline Research', icon: Kanban,           path: '/pipeline-de-research' },
  { label: 'Desempenho & Agenda', icon: BarChart3,      path: '/desempenho' },
  { label: 'Trade Monitor',     icon: ArrowLeftRight,   path: '/trade' },
  { label: 'Trade Activity',    icon: Activity,         path: '/trade/activity' },
  { label: 'Atualizar Dados',   icon: Upload,           path: '/trade/upload' },
  { label: 'FIDC Monitor',      icon: Activity,         path: '/fidc-monitor' },
];

const bottomItems = [
  { label: 'Configurações', icon: Settings,   path: '/configuracoes' },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function AppSidebar({ collapsed, onNavigate }: Props) {
  const location = useLocation();
  const { hasAccess } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
      isActive(path)
        ? 'bg-white/15 text-sidebar-foreground font-medium'
        : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/8'
    );

  const filteredMain   = mainItems.filter(item => hasAccess(item.path));
  const filteredBottom = bottomItems.filter(item => hasAccess(item.path));

  const handleNav = () => onNavigate?.();

  if (collapsed) {
    return (
      <aside className="w-14 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-2 shrink-0">
        <div className="mb-3">
          <ButiaLogo variant="icon" theme="dark" size="sm" />
        </div>
        {filteredMain.map(item => (
          <Link key={item.path} to={item.path} onClick={handleNav} className={cn('p-2 rounded-md transition-colors', isActive(item.path) ? 'bg-white/15 text-sidebar-foreground' : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/8')}>
            <item.icon className="h-4 w-4" />
          </Link>
        ))}
        {filteredBottom.map(item => (
          <Link key={item.path} to={item.path} onClick={handleNav} className={cn('p-2 rounded-md transition-colors', isActive(item.path) ? 'bg-white/15 text-sidebar-foreground' : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/8')}>
            <item.icon className="h-4 w-4" />
          </Link>
        ))}
        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-white/10">
        <ButiaLogo variant="full" theme="dark" size="md" />
        <p className="mt-2 text-xs text-white/50 font-medium tracking-widest uppercase">
          Research Platform
        </p>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {filteredMain.map(item => (
          <Link key={item.path} to={item.path} onClick={handleNav} className={linkClass(item.path)}>
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
        {filteredBottom.map(item => (
          <Link key={item.path} to={item.path} onClick={handleNav} className={linkClass(item.path)}>
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-white/40">Tema</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
