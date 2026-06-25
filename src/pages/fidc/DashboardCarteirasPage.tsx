import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useFidcMonitorData, FIDC_PORTFOLIOS } from "@/hooks/useFidcMonitorData";
import { BRL, PCT } from "@/lib/fidc/format";
import { MetricCard } from "@/components/fidc/MetricCard";
import { PageHeader } from "@/components/fidc/PageHeader";
import { NoDataInline } from "@/components/fidc/NoDataChip";
import { CompositionSection } from "@/components/fidc/CompositionSection";
import { Loader2, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [mm, dd, yyyy] = s.split("/");
    return `${dd}/${mm}/${yyyy}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }
  return s;
};

export default function DashboardCarteirasPage() {
  const { isLoading, portfolioSummaries, fidcs, latestReportFor, reportSourceStatusFor, fidcsWithReportCount } = useFidcMonitorData();

  const consolidated = useMemo(() => {
    const navTotal = portfolioSummaries.reduce((s, p) => s + p.nav, 0);
    const expoTotal = portfolioSummaries.reduce((s, p) => s + p.exposure, 0);
    const pctMedio = navTotal > 0 ? expoTotal / navTotal : 0;
    const fidcIds = new Set<string>();
    let posicoesTotal = 0;
    let mappedTotal = 0;
    let unmappedTotal = 0;
    portfolioSummaries.forEach((p) => {
      p.positions.forEach((q) => {
        posicoesTotal += 1;
        if (q.fidcId) {
          fidcIds.add(q.fidcId);
          mappedTotal += 1;
        } else {
          unmappedTotal += 1;
        }
      });
    });
    const dates = portfolioSummaries.map((p) => p.valDate).filter(Boolean) as string[];
    const allSame = dates.length > 0 && dates.every((d) => d === dates[0]);
    const lastDate = dates.length
      ? dates.slice().sort().reverse()[0]
      : null;
    const carteirasComPosicao = portfolioSummaries.filter((p) => p.positions.length > 0).length;
    return {
      navTotal, expoTotal, pctMedio,
      fidcsMonitorados: fidcIds.size,
      posicoesTotal, mappedTotal, unmappedTotal,
      allSame, lastDate, carteirasComPosicao,
    };
  }, [portfolioSummaries]);

  if (isLoading) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground text-[12px]">
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando carteiras…
      </div>
    );
  }

  const maxExpo = Math.max(1, ...portfolioSummaries.map((p) => p.exposure));

  return (
    <div>
      <PageHeader
        title="Dashboard Carteiras FIDCs"
        subtitle="Exposição das carteiras Butiá em FIDCs · cruzamento com Cadastro Mestre"
        right={
          consolidated.lastDate ? (
            <span className="text-[11px] text-muted-foreground">
              Última posição: <span className="text-foreground">{fmtDate(consolidated.lastDate)}</span>
            </span>
          ) : null
        }
      />

      {!consolidated.allSame && portfolioSummaries.some((p) => p.valDate) && (
        <div className="mx-6 mt-3 flex items-start gap-2 rounded-sm border border-risk-warning/40 bg-risk-warning/10 px-3 py-2 text-[12px] text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-risk-warning mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Carteiras com datas de posição diferentes.</div>
            <div className="text-muted-foreground text-[11.5px] mt-0.5">
              {portfolioSummaries.map((p) => (
                <span key={p.portfolio.id} className="mr-3">
                  {p.portfolio.name}: <span className="text-foreground">{fmtDate(p.valDate)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPIs consolidados */}
      <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 hairline-b">
        <MetricCard label="PL total carteiras" value={BRL(consolidated.navTotal, { compact: true })} />
        <MetricCard
          label="Exposição em FIDCs"
          value={BRL(consolidated.expoTotal, { compact: true })}
          hint={PCT(consolidated.pctMedio) + " do PL"}
        />
        <MetricCard label="FIDCs monitorados" value={String(consolidated.fidcsMonitorados)} hint={`${fidcs.length} no cadastro`} />
        <MetricCard label="Posições em FIDCs" value={String(consolidated.posicoesTotal)} />
        <MetricCard
          label="ISINs não mapeados"
          value={String(consolidated.unmappedTotal)}
          accent={consolidated.unmappedTotal > 0 ? "warning" : "normal"}
        />
        <MetricCard label="Informes mensais" value={`${fidcsWithReportCount}/${consolidated.fidcsMonitorados}`} hint={fidcsWithReportCount === 0 ? "Pendente de upload" : "Última versão por FIDC"} accent={fidcsWithReportCount < consolidated.fidcsMonitorados ? "warning" : "normal"} />
      </div>

      {/* Tabela de carteiras */}
      <div className="px-6 py-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Carteiras com exposição em FIDCs
        </div>
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr className="hairline-b">
                <th className="text-left font-medium px-3 py-2">Carteira</th>
                <th className="text-right font-medium px-3 py-2">PL mais recente</th>
                <th className="text-right font-medium px-3 py-2">Exposição em FIDCs</th>
                <th className="text-right font-medium px-3 py-2">% em FIDCs</th>
                <th className="text-right font-medium px-3 py-2">Nº FIDCs</th>
                <th className="text-right font-medium px-3 py-2">Nº posições</th>
                <th className="text-right font-medium px-3 py-2">ISINs mapeados</th>
                <th className="text-right font-medium px-3 py-2">ISINs não map.</th>
                <th className="text-right font-medium px-3 py-2">Informes</th>
                <th className="text-left font-medium px-3 py-2">Status informes</th>
                <th className="text-left font-medium px-3 py-2">Data da posição</th>
                <th className="text-right font-medium px-3 py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {portfolioSummaries.map((s) => {
                const mapped = s.positions.filter((p) => p.fidcId).length;
                const fidcIdsInPort = Array.from(new Set(s.positions.map((p) => p.fidcId).filter(Boolean) as string[]));
                const withInforme = fidcIdsInPort.filter((fid) => !!latestReportFor(fid)).length;
                const statuses = fidcIdsInPort.map((fid) => reportSourceStatusFor(fid));
                const hasErr = statuses.includes("Erro de validação");
                const hasManualOnly = statuses.includes("Manual");
                const hasMixed = statuses.includes("CVM + Manual");
                const hasPartial = statuses.includes("Parcial CVM");
                const allComplete = fidcIdsInPort.length > 0 && statuses.every((st) => st === "Completo CVM");
                let consolidated = "Ausente";
                let tone: "ok" | "warn" | "err" | "muted" = "muted";
                if (hasErr) { consolidated = "Erro de validação"; tone = "err"; }
                else if (allComplete) { consolidated = "Completo CVM"; tone = "ok"; }
                else if (hasMixed || (hasManualOnly && withInforme > 0 && statuses.some((s) => s !== "Manual" && s !== "Ausente"))) { consolidated = "CVM + Manual"; tone = "warn"; }
                else if (hasPartial) { consolidated = "Parcial CVM"; tone = "warn"; }
                else if (hasManualOnly && statuses.every((s) => s === "Manual" || s === "Ausente")) { consolidated = "Manual"; tone = "warn"; }
                else if (withInforme === 0) { consolidated = "Ausente"; tone = "muted"; }
                else { consolidated = "Parcial CVM"; tone = "warn"; }
                const toneCls = {
                  ok: "bg-emerald-500/15 text-emerald-700",
                  warn: "bg-amber-500/15 text-amber-700",
                  err: "bg-red-500/15 text-red-700",
                  muted: "bg-muted/40 text-muted-foreground",
                }[tone];
                return (
                  <tr key={s.portfolio.id} className="hairline-b hover:bg-surface-2/50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{s.portfolio.name}</div>
                      <div className="text-[10.5px] text-muted-foreground">{s.portfolio.description}</div>
                    </td>
                    <td className="px-3 py-2 text-right num">
                      {s.nav > 0 ? BRL(s.nav, { compact: true }) : <NoDataInline reason="PL ausente na data" />}
                    </td>
                    <td className="px-3 py-2 text-right num">{BRL(s.exposure, { compact: true })}</td>
                    <td className="px-3 py-2 text-right num">{s.nav > 0 ? PCT(s.pct) : "—"}</td>
                    <td className="px-3 py-2 text-right num">{s.fidcCount}</td>
                    <td className="px-3 py-2 text-right num">{s.positions.length}</td>
                    <td className="px-3 py-2 text-right num">{mapped}</td>
                    <td className={cn("px-3 py-2 text-right num", s.unmappedCount > 0 && "text-risk-warning")}>
                      {s.unmappedCount}
                    </td>
                    <td className="px-3 py-2 text-right num text-muted-foreground">{withInforme}/{s.fidcCount}</td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px]", toneCls)}>
                        {tone === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {consolidated}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.valDate)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/fidc-monitor/monitor?portfolio=${s.portfolio.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-[12px]"
                      >
                        Abrir Monitor <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Composição da Exposição em FIDCs */}
      <CompositionSection portfolioSummaries={portfolioSummaries} latestReportFor={latestReportFor} />

      {/* Exposição por carteira (barras) */}
      <div className="px-6 pb-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Exposição em FIDCs por carteira
        </div>
        <div className="bg-card border border-border p-4 space-y-3">
          {portfolioSummaries.map((s) => {
            const w = (s.exposure / maxExpo) * 100;
            return (
              <div key={s.portfolio.id} className="space-y-1">
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="font-medium">{s.portfolio.name}</span>
                  <span className="num text-muted-foreground">
                    {BRL(s.exposure, { compact: true })}{" "}
                    <span className="text-[11px]">· {s.nav > 0 ? PCT(s.pct) : "—"} do PL</span>
                  </span>
                </div>
                <div className="h-2 w-full rounded-sm bg-muted/40 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${w}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Qualidade dos dados */}
      <div className="px-6 pb-6">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Qualidade dos dados
        </div>
        <div className="bg-card border border-border p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-[12.5px]">
          <QualityItem
            label="Carteiras com posição"
            value={`${consolidated.carteirasComPosicao}/${FIDC_PORTFOLIOS.length}`}
            ok={consolidated.carteirasComPosicao === FIDC_PORTFOLIOS.length}
          />
          <QualityItem
            label="ISINs mapeados"
            value={`${consolidated.mappedTotal}/${consolidated.posicoesTotal}`}
            ok={consolidated.unmappedTotal === 0 && consolidated.posicoesTotal > 0}
          />
          <QualityItem
            label="ISINs não mapeados"
            value={String(consolidated.unmappedTotal)}
            ok={consolidated.unmappedTotal === 0}
          />
          <QualityItem
            label="FIDCs com posição"
            value={String(consolidated.fidcsMonitorados)}
            ok={consolidated.fidcsMonitorados > 0}
          />
          <QualityItem
            label="Informes mensais"
            value={`${fidcsWithReportCount}/${consolidated.fidcsMonitorados}`}
            ok={consolidated.fidcsMonitorados > 0 && fidcsWithReportCount === consolidated.fidcsMonitorados}
          />
          <div>
            <div className="section-title">Status</div>
            <div className={cn("text-[12px] mt-0.5 inline-flex items-center gap-1",
              fidcsWithReportCount === consolidated.fidcsMonitorados && consolidated.fidcsMonitorados > 0 ? "text-risk-normal" : "text-risk-warning")}>
              {fidcsWithReportCount === consolidated.fidcsMonitorados && consolidated.fidcsMonitorados > 0
                ? <><CheckCircle2 className="h-3 w-3" /> Informes mensais completos</>
                : <><AlertTriangle className="h-3 w-3" /> {fidcsWithReportCount > 0 ? "Informes mensais parcialmente importados" : "Pendente upload informes mensais"}</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QualityItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div>
      <div className="section-title">{label}</div>
      <div className={cn("text-[15px] font-semibold num mt-0.5 inline-flex items-center gap-1.5",
        ok ? "text-foreground" : "text-risk-warning")}>
        {ok && <CheckCircle2 className="h-3.5 w-3.5 text-risk-normal" />}
        {value}
      </div>
    </div>
  );
}
