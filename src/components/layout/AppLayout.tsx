import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center border-b border-border px-4 bg-surface-1 shrink-0">
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
            <Menu className="h-4 w-4" />
          </button>
          <span className="ml-3 text-sm font-semibold text-foreground tracking-wide">ResearchDesk</span>
          <div className="ml-auto flex items-center gap-2">
            {currentUser && (
              <>
                <Badge variant="outline" className="text-[10px]">{currentUser.funcao}</Badge>
                <span className="text-xs text-muted-foreground">{currentUser.nome}</span>
                <Button variant="ghost" size="sm" onClick={signOut} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
