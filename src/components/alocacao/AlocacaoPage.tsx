import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FundLimitsPanel } from "./FundLimitsPanel";
import { IssuerExposurePanel } from "./IssuerExposurePanel";
import { TargetsPanel } from "./TargetsPanel";
import { FUNDOS, FundoKey } from "./allocationUtils";

export function AlocacaoPage() {
  const [fundo, setFundo] = useState<FundoKey>("TOP_CP");
  const [tab, setTab] = useState("fundo");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Alocação de Carteira</h1>
          <p className="text-xs text-muted-foreground">Monitoramento de enquadramento de limites gerenciais.</p>
        </div>
        {tab !== "targets" && (
          <Select value={fundo} onValueChange={(v) => setFundo(v as FundoKey)}>
            <SelectTrigger className="w-[260px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUNDOS.map(f => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fundo">Visão por Fundo</TabsTrigger>
          <TabsTrigger value="emissor">Enquadramento por Emissor</TabsTrigger>
          <TabsTrigger value="targets">Targets de Alocação</TabsTrigger>
        </TabsList>
        <TabsContent value="fundo" className="mt-4">
          <FundLimitsPanel fundo={fundo} />
        </TabsContent>
        <TabsContent value="emissor" className="mt-4">
          <IssuerExposurePanel fundo={fundo} />
        </TabsContent>
        <TabsContent value="targets" className="mt-4">
          <TargetsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
