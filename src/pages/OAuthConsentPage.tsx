import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

// The @supabase/supabase-js auth.oauth namespace is in beta; declare a minimal
// local typed surface so TypeScript resolves the three methods we call.
type OAuthResult = {
  data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null;
  error: { message: string } | null;
};
const oauthApi = (supabase.auth as any).oauth as {
  getAuthorizationDetails(id: string): Promise<OAuthResult>;
  approveAuthorization(id: string): Promise<OAuthResult>;
  denyAuthorization(id: string): Promise<OAuthResult>;
};

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente.");
        return;
      }
      if (!oauthApi?.getAuthorizationDetails) {
        setError("Servidor OAuth não disponível neste projeto.");
        return;
      }
      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const call = approve ? oauthApi.approveAuthorization : oauthApi.denyAuthorization;
    const { data, error } = await call(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Nenhum redirect_url retornado pelo servidor de autorização.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            Conectar {details?.client?.name ?? "aplicação externa"} à Butiá Research
          </h1>
          <p className="text-xs text-muted-foreground">
            Isto permite que a aplicação chame ferramentas desta plataforma agindo como você. As permissões da sua conta e políticas de acesso (RLS) continuam valendo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!details && !error && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando solicitação...
            </div>
          )}
          {details && (
            <div className="space-y-3 text-xs text-muted-foreground">
              {details.client?.name && (
                <div>
                  <div className="text-foreground font-medium text-sm">Cliente</div>
                  <div>{details.client.name}</div>
                </div>
              )}
              {details.client?.redirect_uri && (
                <div>
                  <div className="text-foreground font-medium text-sm">Redirect URI</div>
                  <div className="break-all font-mono">{details.client.redirect_uri}</div>
                </div>
              )}
              {details.scope && (
                <div>
                  <div className="text-foreground font-medium text-sm">Permissões solicitadas</div>
                  <div className="font-mono">{details.scope}</div>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={!details || busy}
              onClick={() => decide(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!details || busy}
              onClick={() => decide(true)}
            >
              {busy ? "Autorizando..." : "Autorizar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
