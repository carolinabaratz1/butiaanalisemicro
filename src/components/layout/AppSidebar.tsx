import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, FileSearch, Kanban, CreditCard,
  TrendingUp, Users, Settings, ChevronDown, ChevronRight, Briefcase
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const mainItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Posições', icon: Briefcase, path: '/posicoes' },
  { label: 'Empresas', icon: Building2, path: '/empresas' },
  { label: 'Análises', icon: FileSearch, path: '/analises' },
  { label: 'Pipeline Research', icon: Kanban, path: '/pipeline-de-research' },
];

const creditoItems = [
  { label: 'Crédito Corporativo', path: '/credito/corporativo' },
  { label: 'Crédito Estruturado', path: '/credito/estruturado' },
];

const bottomItems = [
  { label: 'Ações', icon: TrendingUp, path: '/acoes' },
  { label: 'Analistas', icon: Users, path: '/analistas' },
  { label: 'Configurações', icon: Settings, path: '/configuracoes' },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed }: Props) {
  const location = useLocation();
  const { hasAccess } = useAuth();
  const [creditoOpen, setCreditoOpen] = useState(
    location.pathname.startsWith('/credito')
  );

  const isActive = (path: string) => location.pathname === path;
  const isCreditoActive = location.pathname.startsWith('/credito');
  const hasCreditoAccess = hasAccess('/credito/corporativo') || hasAccess('/credito/estruturado');

  const linkClass = (path: string) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
      isActive(path)
        ? 'bg-primary/15 text-primary font-medium'
        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
    );

  const filteredMain = mainItems.filter(item => hasAccess(item.path));
  const filteredBottom = bottomItems.filter(item => hasAccess(item.path));

  if (collapsed) {
    return (
      <aside className="w-14 bg-surface-1 border-r border-border flex flex-col items-center py-4 gap-2 shrink-0">
        {filteredMain.map(item => (
          <Link key={item.path} to={item.path} className={cn('p-2 rounded-md transition-colors', isActive(item.path) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
            <item.icon className="h-4 w-4" />
          </Link>
        ))}
        {hasCreditoAccess && (
          <Link to="/credito/corporativo" className={cn('p-2 rounded-md transition-colors', isCreditoActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
            <CreditCard className="h-4 w-4" />
          </Link>
        )}
        {filteredBottom.map(item => (
          <Link key={item.path} to={item.path} className={cn('p-2 rounded-md transition-colors', isActive(item.path) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
            <item.icon className="h-4 w-4" />
          </Link>
        ))}
      </aside>
    );
  }

  return (
    <aside className="w-56 bg-surface-1 border-r border-border flex flex-col shrink-0">
      <div className="px-4 py-4">
        <h1 className="text-base font-bold text-foreground tracking-tight">ResearchDesk</h1>
        <p className="text-[10px] text-muted-foreground mt-0.5">Asset Management Platform</p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {filteredMain.map(item => (
          <Link key={item.path} to={item.path} className={linkClass(item.path)}>
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
        {hasCreditoAccess && (
          <>
            <button
              onClick={() => setCreditoOpen(!creditoOpen)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full transition-colors',
                isCreditoActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Crédito</span>
              {creditoOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {creditoOpen && (
              <div className="ml-7 space-y-0.5">
                {creditoItems.filter(item => hasAccess(item.path)).map(item => (
                  <Link key={item.path} to={item.path} className={linkClass(item.path)}>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
        {filteredBottom.map(item => (
          <Link key={item.path} to={item.path} className={linkClass(item.path)}>
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
