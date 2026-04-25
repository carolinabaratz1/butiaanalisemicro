// ============================================================
// src/components/trade/TradeMonitorPage.tsx
// Página principal do Monitor de Trade.
// Aceita prop emisssorCnpj para filtro direto vindo do
// módulo de Emissores/Análise de Crédito.
// ============================================================

import { useState, useMemo } from "react";
import { useTradeData, TradeAtivo } from "@/hooks/useTradeData";
import { TradeTable } from "./TradeTable";
import { TradeDashboard } from "./TradeDashboard";
import { TradeDetail } from "./TradeDetail";
import { TradeLanding } from "./TradeLanding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, TableIcon, RefreshCw, ArrowLeftRight } from "lucide-react";

interface TradeMonitorPageProps {
  /** Se passado, abre o monitor já filtrado por este CNPJ (vindo do módulo de emissores) */
  emissorCnpj?: string;
  /** Se passado, abre o monitor já com este ticker selecionado */
  initialTicker?: string;
}

type View = "dashboard" | "table";

export function TradeMonitorPage({ emissorCnpj, initialTicker }: TradeMonitorPageProps) {
  const [mode, setMode] = useState<"DI" | "IPCA" | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(initialTicker ?? null);

  const { data, history, ntnbHist, lastDate, loading, error, refresh } = useTradeData(mode);

  // Filter by emissor if called from within Emissores module
  const filteredData = useMemo(() => {
    if (!emissorCnpj) return data;
    return data.filter((t) => t.emissor_cnpj === emissorCnpj);
  }, [data, emissorCnpj]);

  // ── Landing ──────────────────────────────────────────────
  if (!mode) {
    return (
      <TradeLanding
        onSelect={(m) => { setMode(m); setSelectedTicker(null); }}
        diData={[]}   // Pre-populated in TradeLanding via separate lightweight query
        ipcaData={[]}
      />
    );
  }

  const cfg = mode === "DI"
    ? { color: "#38bdf8", label: "DI+", unit: "taxa" }
    : { color: "#b78cf7", label: "IPCA+", unit: "spread cap." };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">Monitor de Trade</span>
          <Badge
            variant="outline"
            className="cursor-pointer gap-1.5 font-mono text-xs"
            style={{ borderColor: cfg.color, color: cfg.color }}
            onClick={() => setMode(null)}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />
            {cfg.label}
          </Badge>
          {emissorCnpj && (
            <Badge variant="secondary" className="text-xs">
              Filtrado por emissor
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <Button
              size="sm" variant={view === "dashboard" ? "secondary" : "ghost"}
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setView("dashboard")}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />Dashboard
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
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-600">
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
                mode={mode}
                modeColor={cfg.color}
                onSelectTicker={(t) => { setSelectedTicker(t); setView("table"); }}
              />
            ) : (
              <TradeTable
                data={filteredData}
                mode={mode}
                modeColor={cfg.color}
                onSelectTicker={setSelectedTicker}
                selectedTicker={selectedTicker}
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
              modeColor={cfg.color}
              onClose={() => setSelectedTicker(null)}
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
