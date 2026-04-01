import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentUser, signOut } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      {isMobile ? (
        <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
        </div>
      ) : (
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center border-b border-border px-4 bg-card shrink-0">
          <button
            onClick={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="ml-3 text-sm font-semibold text-foreground tracking-wide">Butiá Research Platform</span>
          <div className="ml-auto flex items-center gap-2">
            {currentUser && (
              <>
                <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{currentUser.funcao}</Badge>
                <span className="text-xs text-muted-foreground hidden sm:inline">{currentUser.nome}</span>
                <Button variant="ghost" size="sm" onClick={signOut} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
