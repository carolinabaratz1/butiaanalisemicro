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


export default function MfaEnrollPage() {
  const { theme } = useTheme();
  const [factorId, setFactorId] = useState('');
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    enrollFactor();
  }, []);

  const enrollFactor = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Butiá Authenticator',
      });

      if (error) {
        toast.error('Erro ao gerar código MFA: ' + error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setFactorId(data.id);
        setQrUri(data.totp.uri);
        setSecret(data.totp.secret);
      }
    } catch {
      toast.error('Erro inesperado ao configurar MFA');
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.length !== 6) {
      toast.error('O código deve ter 6 dígitos');
      return;
    }

    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        toast.error('Erro ao criar desafio: ' + challenge.error.message);
        setVerifying(false);
        return;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });

      if (verify.error) {
        toast.error('Código inválido. Tente novamente.');
        setVerifyCode('');
        setVerifying(false);
        return;
      }

      toast.success('MFA configurado com sucesso!');
      // Reload to let AuthContext pick up the verified MFA
      window.location.href = '/';
    } catch {
      toast.error('Erro ao verificar código');
    }
    setVerifying(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <ButiaLogo variant="full" theme={theme === 'dark' ? 'dark' : 'light'} size="lg" />
      </div>
      <Card className="w-full max-w-md bg-surface-2 border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-foreground">Configurar Autenticação em Duas Etapas</CardTitle>
          <CardDescription>
            Para sua segurança, é necessário configurar um aplicativo autenticador (como Google Authenticator, Microsoft Authenticator ou Authy).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1 — QR Code */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  1. Escaneie o QR Code com seu app autenticador:
                </p>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`} alt="QR Code MFA" width={200} height={200} />
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showSecret ? 'Ocultar chave manual' : 'Não consegue escanear? Insira manualmente'}
                  </button>
                  {showSecret && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs font-mono break-all text-foreground select-all">
                      {secret}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 — Verify */}
              <form onSubmit={handleVerify} className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  2. Digite o código de 6 dígitos gerado pelo app:
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Código de Verificação</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="bg-surface-1 border-border text-center text-lg tracking-widest"
                    autoFocus
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={verifying || verifyCode.length !== 6}>
                  {verifying ? 'Verificando...' : 'Ativar MFA'}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
