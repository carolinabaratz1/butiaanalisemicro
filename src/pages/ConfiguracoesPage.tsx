import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/data/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, Eye, Pencil, UserCog, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileUser {
  id: string;
  nome: string;
  email: string;
  funcao: string;
  status: string;
}

const roleColors: Record<string, string> = {
  'Gestor': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Analista': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Risco e Compliance': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Consulta': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const roleIcons: Record<string, typeof Shield> = {
  'Gestor': UserCog,
  'Analista': Pencil,
  'Risco e Compliance': Shield,
  'Consulta': Eye,
};

export default function ConfiguracoesPage() {
  const { currentUser, permissions } = useAuth();
  const [userList, setUserList] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', senha: '', funcao: 'Analista' });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('nome');
    if (data) setUserList(data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!permissions.canManageUsers) return;
    const { error } = await supabase.from('profiles').update({ funcao: newRole }).eq('id', userId);
    if (error) {
      toast.error('Erro ao atualizar função');
    } else {
      setUserList(prev => prev.map(u => u.id === userId ? { ...u, funcao: newRole } : u));
      toast.success('Função atualizada');
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.nome || !newUser.email || !newUser.senha) {
      toast.error('Preencha todos os campos');
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-user', {
        body: { email: newUser.email, nome: newUser.nome, senha: newUser.senha, funcao: newUser.funcao },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Erro ao criar usuário');
      } else {
        toast.success('Usuário criado com sucesso');
        setDialogOpen(false);
        setNewUser({ nome: '', email: '', senha: '', funcao: 'Analista' });
        fetchUsers();
      }
    } catch {
      toast.error('Erro ao criar usuário');
    }
    setCreating(false);
  };

  const stats = {
    total: userList.length,
    gestores: userList.filter(u => u.funcao === 'Gestor').length,
    analistas: userList.filter(u => u.funcao === 'Analista').length,
    compliance: userList.filter(u => u.funcao === 'Risco e Compliance').length,
    consulta: userList.filter(u => u.funcao === 'Consulta').length,
  };

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Configurações</h2>
          <p className="text-sm text-muted-foreground">
            Gerenciamento de usuários e permissões
            {!permissions.canManageUsers && ' (somente leitura)'}
          </p>
        </div>
        {permissions.canManageUsers && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-surface-2 border-border">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input value={newUser.nome} onChange={e => setNewUser(p => ({ ...p, nome: e.target.value }))} className="bg-surface-1 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="bg-surface-1 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Senha</Label>
                  <Input type="password" value={newUser.senha} onChange={e => setNewUser(p => ({ ...p, senha: e.target.value }))} className="bg-surface-1 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Função</Label>
                  <Select value={newUser.funcao} onValueChange={v => setNewUser(p => ({ ...p, funcao: v }))}>
                    <SelectTrigger className="bg-surface-1 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gestor">Gestor</SelectItem>
                      <SelectItem value="Analista">Analista</SelectItem>
                      <SelectItem value="Risco e Compliance">Risco e Compliance</SelectItem>
                      <SelectItem value="Consulta">Consulta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateUser} disabled={creating} className="w-full">
                  {creating ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
                const Icon = roleIcons[user.funcao] || Eye;
                return (
                  <TableRow key={user.id} className="border-border">
                    <TableCell className="font-medium text-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {user.nome}
                      {currentUser && user.id === currentUser.id && (
                        <Badge variant="outline" className="text-[10px] ml-1 border-primary/30 text-primary">Você</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{user.email}</TableCell>
                    <TableCell>
                      {permissions.canManageUsers ? (
                        <Select value={user.funcao} onValueChange={(v) => handleRoleChange(user.id, v)}>
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
                        <Badge variant="outline" className={roleColors[user.funcao] || ''}>
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
