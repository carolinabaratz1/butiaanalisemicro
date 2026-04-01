import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ButiaLogo } from '@/components/ui/ButiaLogo';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

export default function ChangePasswordPage() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        toast.error(updateError.message);
        setLoading(false);
        return;
      }

      // Mark password as changed
      if (currentUser) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false } as any)
          .eq('id', currentUser.id);
      }

      toast.success('Senha atualizada com sucesso!');
      // Reload to let AuthContext pick up the change
      window.location.href = '/';
    } catch {
      toast.error('Erro ao atualizar senha');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <ButiaLogo variant="full" theme={theme === 'dark' ? 'dark' : 'light'} size="lg" />
      </div>
      <Card className="w-full max-w-md bg-surface-2 border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-foreground">Troca de Senha Obrigatória</CardTitle>
          <CardDescription>
            Esta é sua primeira entrada ou sua senha foi resetada. Por favor, defina uma nova senha para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nova Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-surface-1 border-border"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar Senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="bg-surface-1 border-border"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvando...' : 'Definir Nova Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
