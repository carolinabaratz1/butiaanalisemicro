import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFidcMonitorData } from "@/hooks/useFidcMonitorData";
import { BRL, PCT, formatCNPJ } from "@/lib/fidc/format";
import { MetricCard } from "@/components/fidc/MetricCard";
import { PageHeader } from "@/components/fidc/PageHeader";
import { NoDataChip, NoDataInline } from "@/components/fidc/NoDataChip";
import { Loader2, AlertTriangle } from "lucide-react";

export default function FidcDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { fidcById, portfoliosForFidc, portfolioSummaries, exposureForFidc, latestValDate, isLoading } = useFidcMonitorData();

  const { data: quotas = [] } = useQuery({
    queryKey: ["fidc-detail-quotas", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("fidc_quota_classes").select("*").eq("fidc_id", id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="px-6 py-12 text-center text-muted-foreground text-[12px]">
      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
    </div>;
  }

  const f = fidcById(id);
  if (!f) return <Navigate to="/fidc-monitor/fidcs" replace />;

  const ports = portfoliosForFidc(id);
  const exposureTotal = exposureForFidc(id);

  const positionsByPortfolio = portfolioSummaries.map((s) => ({
    portfolio: s.portfolio,
    positions: s.positions.filter((p) => p.fidcId === id),
  })).filter((x) => x.positions.length > 0);

  return (
    <div>
      <div className="px-6 py-4 hairline-b">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[20px] font-semibold tracking-tight">{f.name}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] bg-muted/40 text-muted-foreground">
                <AlertTriangle className="h-3 w-3" /> Informe mensal pendente
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>CNPJ <span className="num text-foreground">{f.cnpj ? formatCNPJ(f.cnpj) : "—"}</span></span>
              {f.manager && <span>Gestor <span className="text-foreground">{f.manager}</span></span>}
              {f.administrator && <span>Administrador <span className="text-foreground">{f.administrator}</span></span>}
              {f.custodian && <span>Custodiante <span className="text-foreground">{f.custodian}</span></span>}
              {f.main_originator && <span>Originador <span className="text-foreground">{f.main_originator}</span></span>}
              {f.sector && <span>Setor <span className="text-foreground">{f.sector}</span></span>}
              <span>Data posição <span className="text-foreground">{latestValDate ?? "—"}</span></span>
            </div>
          </div>
          <div className="text-right text-[11px]">
            <div className="section-title">Carteiras</div>
            <div className="mt-1 space-y-0.5">
              {ports.map((p) => (
                <Link key={p.id} to={`/fidc-monitor?portfolio=${p.id}`} className="block text-foreground hover:text-primary">
                  {p.name}
                </Link>
              ))}
              {!ports.length && <div className="text-muted-foreground">—</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Exposição Butiá" value={BRL(exposureTotal, { compact: true })} hint={`${ports.length} carteira(s)`} />
        <MetricCard label="PL" value={<NoDataInline />} />
        <MetricCard label="Cota" value={<NoDataInline />} />
        <MetricCard label="Direitos Creditórios" value={<NoDataInline />} />
        <MetricCard label="Atraso/DC" value={<NoDataInline />} />
        <MetricCard label="PDD/DC" value={<NoDataInline />} />
        <MetricCard label="PDD/Atrasos" value={<NoDataInline />} />
        <MetricCard label="Caixa/PL" value={<NoDataInline />} />
        <MetricCard label="Recompras/DC" value={<NoDataInline />} />
        <MetricCard label="Subordinação" value={<NoDataInline />} />
        <MetricCard label="Var. mensal PL" value={<NoDataInline />} />
        <MetricCard label="Investidores" value={<NoDataInline />} />
      </div>

      <div className="px-6 pb-4">
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Exposição por carteira</div>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-3 py-2 font-medium">Carteira</th>
                  <th className="text-left px-3 py-2 font-medium">ISIN</th>
                  <th className="text-left px-3 py-2 font-medium">Classe</th>
                  <th className="text-right px-3 py-2 font-medium">Exposição</th>
                  <th className="text-right px-3 py-2 font-medium">% Cart.</th>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {positionsByPortfolio.flatMap(({ portfolio, positions }) =>
                  positions.map((p, i) => {
                    const s = portfolioSummaries.find((x) => x.portfolio.id === portfolio.id)!;
                    return (
                      <tr key={`${portfolio.id}-${i}`} className="hairline-b">
                        <td className="px-3 py-2 font-medium">{portfolio.name}</td>
                        <td className="px-3 py-2 num">{p.isin}</td>
                        <td className="px-3 py-2">{p.quota?.class_name || p.quota?.internal_quota_name || "—"}</td>
                        <td className="px-3 py-2 text-right num">{BRL(p.value, { compact: true })}</td>
                        <td className="px-3 py-2 text-right num">{s.nav > 0 ? PCT(p.value / s.nav) : "—"}</td>
                        <td className="px-3 py-2 num text-muted-foreground">{p.valDate}</td>
                      </tr>
                    );
                  }),
                )}
                {positionsByPortfolio.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                    Sem posições nesta data.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="bg-card border border-border">
          <div className="section-title px-4 pt-3">Cotas / classes cadastradas</div>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-[12px]">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr className="hairline-b">
                  <th className="text-left px-3 py-2 font-medium">Classe</th>
                  <th className="text-left px-3 py-2 font-medium">ISIN</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Benchmark</th>
                  <th className="text-left px-3 py-2 font-medium">Rating</th>
                  <th className="text-right px-3 py-2 font-medium">PL classe</th>
                  <th className="text-right px-3 py-2 font-medium">Cota</th>
                </tr>
              </thead>
              <tbody>
                {(quotas as any[]).map((c) => (
                  <tr key={c.id} className="hairline-b">
                    <td className="px-3 py-2 font-medium">{c.class_name || "—"}</td>
                    <td className="px-3 py-2 num text-muted-foreground">{c.isin}</td>
                    <td className="px-3 py-2">{c.quota_type || "—"}</td>
                    <td className="px-3 py-2">{c.benchmark || "—"}</td>
                    <td className="px-3 py-2">{c.current_rating || "—"}</td>
                    <td className="px-3 py-2 text-right"><NoDataChip /></td>
                    <td className="px-3 py-2 text-right"><NoDataChip /></td>
                  </tr>
                ))}
                {quotas.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-[11.5px]">
                    Nenhuma cota cadastrada.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="bg-card border border-border p-5">
          <div className="section-title">Histórico mensal</div>
          <div className="mt-3 text-[12px] text-muted-foreground">
            Métricas mensais (PL, cota, atraso/DC, caixa/PL, PDD, recompras, subordinação) serão exibidas
            assim que o informe mensal do FIDC for importado.
          </div>
        </div>
      </div>
    </div>
  );
}
