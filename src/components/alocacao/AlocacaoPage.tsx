import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FundLimitsPanel } from "./FundLimitsPanel";
import { IssuerExposurePanel } from "./IssuerExposurePanel";
import { TargetsPanel } from "./TargetsPanel";
import { FidcClassesPanel } from "./FidcClassesPanel";
import { FUNDOS, FundoKey } from "./allocationUtils";
import { useAllocationDates } from "./useAllocationData";

function formatDateLabel(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/");
    return `${d}/${m}/${y}`;
  }
  return s;
}

export function AlocacaoPage() {
  const [fundo, setFundo] = useState<FundoKey>("TOP_CP");
  const [tab, setTab] = useState("fundo");
  const [valDate, setValDate] = useState<string | null>(null);

  const { data: dates = [] } = useAllocationDates(fundo);

  // Reset to "latest" whenever the fund changes
  useEffect(() => { setValDate(null); }, [fundo]);

  const selectedDate = valDate ?? dates[0] ?? null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Alocação de Carteira</h1>
          <p className="text-xs text-muted-foreground">Monitoramento de enquadramento de limites gerenciais.</p>
        </div>
        {tab !== "targets" && (
          <div className="flex items-center gap-2 flex-wrap">
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
            <Select
              value={selectedDate ?? ""}
              onValueChange={(v) => setValDate(v)}
              disabled={dates.length === 0}
            >
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Data de referência" />
              </SelectTrigger>
              <SelectContent>
                {dates.map((d, i) => (
                  <SelectItem key={d} value={d}>
                    {formatDateLabel(d)}{i === 0 ? " (mais recente)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fundo">Visão por Fundo</TabsTrigger>
          <TabsTrigger value="emissor">Enquadramento por Emissor</TabsTrigger>
          <TabsTrigger value="targets">Targets de Alocação</TabsTrigger>
        </TabsList>
        <TabsContent value="fundo" className="mt-4">
          <FundLimitsPanel fundo={fundo} valDate={selectedDate} />
        </TabsContent>
        <TabsContent value="emissor" className="mt-4">
          <IssuerExposurePanel fundo={fundo} valDate={selectedDate} />
        </TabsContent>
        <TabsContent value="targets" className="mt-4">
          <TargetsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
