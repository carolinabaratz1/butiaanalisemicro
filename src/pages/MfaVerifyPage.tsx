import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ButiaLogo } from '@/components/ui/ButiaLogo';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function MfaVerifyPage() {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFactor();
  }, []);

  const loadFactor = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error('Erro ao carregar fatores MFA');
      setLoading(false);
      return;
    }

    const verifiedTotps = data.totp.filter(f => f.status === 'verified');
    if (verifiedTotps.length > 0) {
      setFactorId(verifiedTotps[0].id);
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;

    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        toast.error('Erro ao criar desafio MFA');
        setVerifying(false);
        return;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });

      if (verify.error) {
        toast.error('Código inválido. Tente novamente.');
        setCode('');
        setVerifying(false);
        return;
      }

      // MFA verified — reload to let AuthContext pick up AAL2
      window.location.href = '/';
    } catch {
      toast.error('Erro ao verificar código');
    }
    setVerifying(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <ButiaLogo variant="full" theme={theme === 'dark' ? 'dark' : 'light'} size="lg" />
      </div>
      <Card className="w-full max-w-sm bg-surface-2 border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-foreground">Verificação em Duas Etapas</CardTitle>
          <CardDescription>
            Abra seu aplicativo autenticador e digite o código de 6 dígitos para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Código de Verificação</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="bg-surface-1 border-border text-center text-lg tracking-widest"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
              {verifying ? 'Verificando...' : 'Verificar'}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={handleSignOut}>
              Sair e usar outra conta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
