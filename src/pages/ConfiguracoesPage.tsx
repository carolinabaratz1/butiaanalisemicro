import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Shield, Eye, Pencil, UserCog, Plus, UserX, UserCheck, KeyRound, Check, X } from 'lucide-react';
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
  'Coordenação/Especialista': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Analista': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Risco e Compliance': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Consulta': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const roleIcons: Record<string, typeof Shield> = {
  'Gestor': UserCog,
  'Coordenação/Especialista': UserCog,
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
  const [confirmAction, setConfirmAction] = useState<{ userId: string; userName: string; action: 'deactivate' | 'reactivate' } | null>(null);
  const [resetDialog, setResetDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('nome');
    if (data) setUserList(data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!permissions.canManageUsers) return;
    try {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'change-role', userId, newRole },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Erro ao atualizar função');
      } else {
        setUserList(prev => prev.map(u => u.id === userId ? { ...u, funcao: newRole } : u));
        toast.success('Função atualizada');
      }
    } catch {
      toast.error('Erro ao atualizar função');
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmAction) return;
    const { userId, action } = confirmAction;
    const newStatus = action === 'deactivate' ? 'Inativo' : 'Ativo';
    try {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'toggle-status', userId, newStatus },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Erro ao alterar status');
      } else {
        setUserList(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        toast.success(action === 'deactivate' ? 'Usuário desativado' : 'Usuário reativado');
      }
    } catch {
      toast.error('Erro ao alterar status');
    }
    setConfirmAction(null);
  };

  const passwordChecks = {
    length: resetPassword.length >= 8,
    letter: /[A-Za-z]/.test(resetPassword),
    number: /[0-9]/.test(resetPassword),
    symbol: /[^A-Za-z0-9]/.test(resetPassword),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  const handleResetPassword = async () => {
    if (!resetDialog || !resetPassword) return;
    if (!passwordValid) {
      toast.error('A senha não atende a todos os requisitos');
      return;
    }
    setResetting(true);
    try {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'reset-password', userId: resetDialog.userId, newPassword: resetPassword },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Erro ao resetar senha');
      } else {
        toast.success('Senha resetada. O usuário deverá trocá-la no próximo login.');
      }
    } catch {
      toast.error('Erro ao resetar senha');
    }
    setResetting(false);
    setResetDialog(null);
    setResetPassword('');
  };

  const handleCreateUser = async () => {
    if (!newUser.nome || !newUser.email || !newUser.senha) {
      toast.error('Preencha todos os campos');
      return;
    }
    setCreating(true);
    try {
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
    coordenadores: userList.filter(u => u.funcao === 'Coordenação/Especialista').length,
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
                      <SelectItem value="Coordenação/Especialista">Coordenação/Especialista</SelectItem>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Gestores', value: stats.gestores },
          { label: 'Coord./Espec.', value: stats.coordenadores },
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
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">E-mail</TableHead>
                <TableHead className="text-muted-foreground">Função</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                {permissions.canManageUsers && <TableHead className="text-muted-foreground text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {userList.map(user => {
                const Icon = roleIcons[user.funcao] || Eye;
                const isCurrentUser = currentUser && user.id === currentUser.id;
                const isActive = user.status === 'Ativo';
                return (
                  <TableRow key={user.id} className={`border-border ${!isActive ? 'opacity-50' : ''}`}>
                    <TableCell className="font-medium text-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {user.nome}
                      {isCurrentUser && (
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
                            <SelectItem value="Coordenação/Especialista">Coordenação/Especialista</SelectItem>
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
                      <Badge variant="outline" className={isActive
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }>
                        {user.status}
                      </Badge>
                    </TableCell>
                    {permissions.canManageUsers && (
                      <TableCell className="text-right space-x-1">
                        {!isCurrentUser && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              title="Resetar senha"
                              onClick={() => setResetDialog({ userId: user.id, userName: user.nome })}
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 text-xs gap-1 ${isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                              onClick={() => setConfirmAction({
                                userId: user.id,
                                userName: user.nome,
                                action: isActive ? 'deactivate' : 'reactivate',
                              })}
                            >
                              {isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                              {isActive ? 'Desativar' : 'Reativar'}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="bg-surface-2 border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'deactivate' ? 'Desativar Usuário' : 'Reativar Usuário'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'deactivate'
                ? `Tem certeza que deseja desativar "${confirmAction?.userName}"? O usuário não poderá mais acessar o sistema.`
                : `Deseja reativar "${confirmAction?.userName}"? O usuário voltará a ter acesso ao sistema.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus}>
              {confirmAction?.action === 'deactivate' ? 'Desativar' : 'Reativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetDialog} onOpenChange={(open) => { if (!open) { setResetDialog(null); setResetPassword(''); } }}>
        <DialogContent className="bg-surface-2 border-border">
          <DialogHeader>
            <DialogTitle>Resetar Senha — {resetDialog?.userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Defina uma senha temporária. O usuário será obrigado a trocá-la no próximo login.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Nova Senha Temporária</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-surface-1 border-border"
              />
            </div>
            <Button onClick={handleResetPassword} disabled={resetting} className="w-full">
              {resetting ? 'Resetando...' : 'Resetar Senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
