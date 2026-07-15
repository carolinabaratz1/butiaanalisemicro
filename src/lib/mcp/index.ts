import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listEmissoresTool from "./tools/list-emissores";
import getEmissorTool from "./tools/get-emissor";
import listAnalisesTool from "./tools/list-analises";
import listPosicoesTool from "./tools/list-posicoes";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "butia-research-mcp",
  title: "Butiá Research Platform",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura para a Butiá Research Platform: perfil do usuário, emissores, análises de crédito e posições da carteira. Todas as chamadas respeitam a autenticação e RLS do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listEmissoresTool, getEmissorTool, listAnalisesTool, listPosicoesTool],
});
