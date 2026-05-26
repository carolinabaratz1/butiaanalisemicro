// ============================================================
// src/lib/tradeExport.ts
// Helpers para exportar o conteúdo do Trade Monitor para Excel.
// ============================================================
import * as XLSX from "xlsx";
import type { TradeAtivo, TradeMode, HistoryPoint } from "@/hooks/useTradeData";

function tsTag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function modeLabel(m: TradeMode): string {
  return m === "DI_SPREAD" ? "DI+" : m === "CDI_PCT" ? "%CDI" : "IPCA+";
}

function ativoRow(t: TradeAtivo, mode: TradeMode) {
  const isIPCA = mode === "IPCA";
  return {
    Ticker: t.ticker,
    Emissor: t.emissor_nome ?? "",
    CNPJ: t.emissor_cnpj ?? "",
    Indexador: t.indexador,
    SubIndexador: t.sub_indexador ?? "",
    Vencimento: t.venc_date ?? "",
    "Anos p/ Venc.": t.anos_venc ?? null,
    "Taxa Emissão": t.taxa_emissao ?? "",
    "Spread Emissão": t.spread_emissao ?? null,
    Rating: t.rating ?? "",
    "Data Rating": t.data_rating ?? "",
    "NTN-B Ref": isIPCA ? (t.ntnb_ref ?? "") : "",
    "NTN-B Taxa": isIPCA ? (t.ntnb_taxa ?? null) : "",
    [isIPCA ? "Spread Atual (%)" : "Taxa Atual (%)"]: t.last_val ?? null,
    "Última Data": t.last_date,
    "Qtd. Última": t.last_qtd ?? null,
    "Vol. Financeiro Última": t.last_vol_fin ?? null,
    "Qtd. Total": t.total_qtd ?? null,
    "Vol. Financeiro Total": t.total_vol_fin ?? null,
    "PU Curva": t.pu_curva ?? null,
    "PU Indicativo": t.pu_indicativo ?? null,
    "PU Ind/Curva": t.pu_ratio ?? null,
    "Média 5d": t.avg_5d ?? null,
    "Média 10d": t.avg_10d ?? null,
    "Média 21d": t.avg_21d ?? null,
    "Média 30d": t.avg_30d ?? null,
    "Média 90d": t.avg_90d ?? null,
    "Desv. Pad. 90d": t.std_90d ?? null,
    "Z-Score 5d": t.z_score_5d ?? null,
    "Z-Score 10d": t.z_score_10d ?? null,
    "Z-Score 21d": t.z_score_21d ?? null,
    "Z-Score 90d": t.z_score ?? null,
    "Δ bps": t.change_bps ?? null,
  };
}

/** Exporta os ativos atualmente visíveis na tela. */
export function exportTradeAtivos(
  ativos: TradeAtivo[],
  mode: TradeMode,
  viewLabel: string,
  context?: { fundo?: string | null; emissorCnpj?: string }
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Filtros aplicados
  const meta: { Campo: string; Valor: string | number }[] = [
    { Campo: "Modo", Valor: modeLabel(mode) },
    { Campo: "Visão", Valor: viewLabel },
    { Campo: "Fundo", Valor: context?.fundo ?? "Todos" },
    { Campo: "Emissor (CNPJ)", Valor: context?.emissorCnpj ?? "—" },
    { Campo: "Total de emissões", Valor: ativos.length },
    { Campo: "Exportado em", Valor: new Date().toLocaleString("pt-BR") },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "Filtros");

  // Sheet 2: Emissões
  const rows = ativos.map((t) => ativoRow(t, mode));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Emissões");

  XLSX.writeFile(wb, `trade-monitor_${modeLabel(mode).replace("%", "pct")}_${viewLabel}_${tsTag()}.xlsx`);
}

/** Exporta os dados de um ticker (cabeçalho + histórico). */
export function exportTickerDetail(
  t: TradeAtivo,
  mode: TradeMode,
  history: HistoryPoint[]
): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([ativoRow(t, mode)]),
    "Resumo"
  );
  const isIPCA = mode === "IPCA";
  const histRows = history.map((h) => ({
    Data: h.d,
    [isIPCA ? "Spread (%)" : "Taxa (%)"]: h.r,
    "PU Curva": h.pc ?? null,
    "PU Indicativo": h.pi ?? null,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows), "Histórico");
  XLSX.writeFile(wb, `trade-monitor_${t.ticker}_${tsTag()}.xlsx`);
}
