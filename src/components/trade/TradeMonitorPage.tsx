// ============================================================
// src/components/trade/TradeMonitorPage.tsx
// Página principal do Monitor de Trade.
// Aceita prop emisssorCnpj para filtro direto vindo do
// módulo de Emissores/Análise de Crédito.
// ============================================================

import { useState, useMemo } from "react";
import { useTradeData, TradeMode } from "@/hooks/useTradeData";
import { useTradeIntegration } from "@/hooks/useTradeIntegration";
import { TradeTable } from "./TradeTable";
import { TradeDashboard } from "./TradeDashboard";
import { TradeSectorDashboard } from "./TradeSectorDashboard";
import { TradeDetail } from "./TradeDetail";
import { TradeLanding } from "./TradeLanding";
import { AlocacaoPage } from "@/components/alocacao/AlocacaoPage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutDashboard, TableIcon, RefreshCw, ArrowLeftRight, Wallet, X, Layers } from "lucide-react";

interface TradeMonitorPageProps {
  /** Se passado, abre o monitor já filtrado por este CNPJ (vindo do módulo de emissores) */
  emissorCnpj?: string;
  /** Se passado, abre o monitor já com este ticker selecionado */
  initialTicker?: string;
}

type View = "dashboard" | "sector" | "table";

export function TradeMonitorPage({ emissorCnpj, initialTicker }: TradeMonitorPageProps) {
  const [mode, setMode] = useState<TradeMode | null>(null);
  const [showAlocacao, setShowAlocacao] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(initialTicker ?? null);
  const [selectedFund, setSelectedFund] = useState<string | null>(null);

  const { data, history, ntnbHist, lastDate, loading, error, refresh } = useTradeData(mode);
  const integration = useTradeIntegration();

  const fundsList = useMemo(() => integration.getFundsList(), [integration]);

  // Filter by emissor and/or fund
  const filteredData = useMemo(() => {
    let d = data;
    if (emissorCnpj) d = d.filter((t) => t.emissor_cnpj === emissorCnpj);
    if (selectedFund) {
      const tickers = integration.getTickersByFund(selectedFund);
      d = d.filter((t) => tickers.has(t.ticker));
    }
    return d;
  }, [data, emissorCnpj, selectedFund, integration]);

  // ── Alocação view ────────────────────────────────────────
  if (showAlocacao) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm">Monitor de Trade</span>
            <Badge variant="outline" className="cursor-pointer gap-1.5 font-mono text-xs border-emerald-400 text-emerald-400" onClick={() => setShowAlocacao(false)}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Alocação
            </Badge>
          </div>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setShowAlocacao(false)}>
            <ArrowLeftRight className="w-3.5 h-3.5" />Trocar
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <AlocacaoPage />
        </div>
      </div>
    );
  }

  // ── Landing ──────────────────────────────────────────────
  if (!mode) {
    return (
      <TradeLanding
        onSelect={(m) => { setMode(m); setSelectedTicker(null); }}
        onSelectAlocacao={() => setShowAlocacao(true)}
        diData={[]}
        ipcaData={[]}
      />
    );
  }

  const cfg: Record<TradeMode, { color: string; label: string; unit: string }> = {
    DI_SPREAD: { color: "#38bdf8", label: "DI+",   unit: "taxa" },
    CDI_PCT:   { color: "#22d3ee", label: "%CDI",  unit: "% CDI" },
    IPCA:      { color: "#b78cf7", label: "IPCA+", unit: "spread cap." },
  };
  const modeCfg = cfg[mode];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b bg-card flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-sm">Monitor de Trade</span>
          <Badge
            variant="outline"
            className="cursor-pointer gap-1.5 font-mono text-xs"
            style={{ borderColor: modeCfg.color, color: modeCfg.color }}
            onClick={() => setMode(null)}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: modeCfg.color }} />
            {modeCfg.label}
          </Badge>
          {emissorCnpj && (
            <Badge variant="secondary" className="text-xs">
              Filtrado por emissor
            </Badge>
          )}
          {selectedFund && (
            <Badge
              variant="outline"
              className="text-xs gap-1.5 cursor-pointer hover:bg-muted"
              onClick={() => setSelectedFund(null)}
              title="Remover filtro de fundo"
            >
              <Wallet className="w-3 h-3" />
              <span className="max-w-[180px] truncate">{selectedFund}</span>
              <X className="w-3 h-3" />
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Fund selector */}
          <Select
            value={selectedFund ?? "__all__"}
            onValueChange={(v) => setSelectedFund(v === "__all__" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <Wallet className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Todos os fundos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os fundos</SelectItem>
              {fundsList.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <Button
              size="sm" variant={view === "dashboard" ? "secondary" : "ghost"}
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setView("dashboard")}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />Geral
            </Button>
            <Button
              size="sm" variant={view === "sector" ? "secondary" : "ghost"}
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setView("sector")}
            >
              <Layers className="w-3.5 h-3.5" />Setorial
            </Button>
            <Button
              size="sm" variant={view === "table" ? "secondary" : "ghost"}
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setView("table")}
            >
              <TableIcon className="w-3.5 h-3.5" />Emissões
            </Button>
          </div>

          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setMode(null)}>
            <ArrowLeftRight className="w-3.5 h-3.5" />Trocar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {lastDate && (
            <span className="text-xs text-muted-foreground font-mono">{lastDate}</span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-6 py-2 bg-destructive/10 border-b border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data.length && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Carregando dados de mercado…
        </div>
      )}

      {/* Content */}
      {!loading || data.length > 0 ? (
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-auto">
            {view === "dashboard" ? (
              <TradeDashboard
                data={filteredData}
                history={history}
                mode={mode}
                modeColor={modeCfg.color}
                onSelectTicker={(t) => { setSelectedTicker(t); setView("table"); }}
                selectedFund={selectedFund}
                fundTotal={selectedFund ? integration.getFundTotal(selectedFund) : 0}
                allocatedInFund={
                  selectedFund
                    ? filteredData.reduce(
                        (s, t) =>
                          s +
                          integration
                            .getAllocations(t.ticker)
                            .filter((a) => a.fundo === selectedFund)
                            .reduce((ss, a) => ss + a.financial_price, 0),
                        0,
                      )
                    : 0
                }
              />
            ) : view === "sector" ? (
              <TradeSectorDashboard
                data={filteredData}
                history={history}
                mode={mode}
                modeColor={modeCfg.color}
                onSelectTicker={setSelectedTicker}
              />
            ) : (
              <TradeTable
                data={filteredData}
                mode={mode}
                modeColor={modeCfg.color}
                onSelectTicker={setSelectedTicker}
                selectedTicker={selectedTicker}
                integration={integration}
              />
            )}
          </div>

          {/* Detail panel — shown when a ticker is selected */}
          {selectedTicker && (
            <TradeDetail
              ticker={selectedTicker}
              data={filteredData}
              history={history}
              ntnbHist={ntnbHist}
              mode={mode}
              modeColor={modeCfg.color}
              onClose={() => setSelectedTicker(null)}
              integration={integration}
              // Integration: link to emissor profile
              onViewEmissor={(cnpj) => {
                // Dispatch event for parent system to navigate to emissor page
                window.dispatchEvent(new CustomEvent("trade:view-emissor", { detail: { cnpj } }));
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
