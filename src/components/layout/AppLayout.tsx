import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { Menu, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { users } from '@/data/users';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser, setCurrentUser } = useAuth();

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
            <Badge variant="outline" className="text-[10px]">{currentUser.funcao}</Badge>
            <Select value={currentUser.id} onValueChange={(id) => {
              const u = users.find(u => u.id === id);
              if (u) setCurrentUser(u);
            }}>
              <SelectTrigger className="h-7 w-52 text-xs bg-surface-2 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.nome} ({u.funcao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
