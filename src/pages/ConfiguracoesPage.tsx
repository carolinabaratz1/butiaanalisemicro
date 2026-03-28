import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { users, User, UserRole } from '@/data/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Eye, Pencil, UserCog } from 'lucide-react';

const roleColors: Record<UserRole, string> = {
  'Gestor': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Analista': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Risco e Compliance': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Consulta': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const roleIcons: Record<UserRole, typeof Shield> = {
  'Gestor': UserCog,
  'Analista': Pencil,
  'Risco e Compliance': Shield,
  'Consulta': Eye,
};

export default function ConfiguracoesPage() {
  const { currentUser, permissions } = useAuth();
  const [userList, setUserList] = useState<User[]>(users);

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (!permissions.canManageUsers) return;
    setUserList(prev => prev.map(u => u.id === userId ? { ...u, funcao: newRole } : u));
  };

  const stats = {
    total: userList.length,
    gestores: userList.filter(u => u.funcao === 'Gestor').length,
    analistas: userList.filter(u => u.funcao === 'Analista').length,
    compliance: userList.filter(u => u.funcao === 'Risco e Compliance').length,
    consulta: userList.filter(u => u.funcao === 'Consulta').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Configurações</h2>
        <p className="text-sm text-muted-foreground">
          Gerenciamento de usuários e permissões
          {!permissions.canManageUsers && ' (somente leitura)'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Gestores', value: stats.gestores },
          { label: 'Analistas', value: stats.analistas },
          { label: 'Risco & Compliance', value: stats.compliance },
          { label: 'Consulta', value: stats.consulta },
        ].map(s => (
          <Card key={s.label} className="bg-surface-2 border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card className="bg-surface-2 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Usuários do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">E-mail</TableHead>
                <TableHead className="text-muted-foreground">Função</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userList.map(user => {
                const Icon = roleIcons[user.funcao];
                return (
                  <TableRow key={user.id} className="border-border">
                    <TableCell className="font-medium text-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {user.nome}
                      {user.id === currentUser.id && (
                        <Badge variant="outline" className="text-[10px] ml-1 border-primary/30 text-primary">Você</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{user.email}</TableCell>
                    <TableCell>
                      {permissions.canManageUsers ? (
                        <Select value={user.funcao} onValueChange={(v) => handleRoleChange(user.id, v as UserRole)}>
                          <SelectTrigger className="h-7 w-44 text-xs bg-surface-1 border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gestor">Gestor</SelectItem>
                            <SelectItem value="Analista">Analista</SelectItem>
                            <SelectItem value="Risco e Compliance">Risco e Compliance</SelectItem>
                            <SelectItem value="Consulta">Consulta</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={roleColors[user.funcao]}>
                          {user.funcao}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                        {user.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
