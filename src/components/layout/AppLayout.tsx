import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { Menu } from 'lucide-react';

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center border-b border-border px-4 bg-surface-1 shrink-0">
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
            <Menu className="h-4 w-4" />
          </button>
          <span className="ml-3 text-sm font-semibold text-foreground tracking-wide">ResearchDesk</span>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
