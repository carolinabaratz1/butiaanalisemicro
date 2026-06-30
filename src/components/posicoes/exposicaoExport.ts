import * as XLSX from "xlsx";
import type { ExposicaoData, GrupoAgg, EmissorAgg, AssetRow } from "./useExposicaoData";

function fmtPct(v: number | null | undefined): string {
  return v == null ? "" : (v * 100).toFixed(2) + "%";
}

export function exportExposicao(
  data: ExposicaoData,
  mode: "grupo" | "emissor",
  filtersLabel: string,
): void {
  const wb = XLSX.utils.book_new();
  const meta = [
    { Campo: "Modo", Valor: mode === "grupo" ? "Grupo Econômico" : "Emissor" },
    { Campo: "Data Referência", Valor: data.valDate },
    { Campo: "Filtros", Valor: filtersLabel },
    { Campo: "Exportado em", Valor: new Date().toLocaleString("pt-BR") },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "Filtros");

  const fundos = data.fundos;

  if (mode === "grupo") {
    const rows = data.porGrupo.map((g) => {
      const r: Record<string, any> = {
        "Grupo Econômico": g.grupo,
        "Nº Emissores": g.nEmissores,
        Rating: g.ratingBucketLabel,
        Setor: g.setor,
        "Taxa Média (%)": g.weightedRate ?? "",
        "Exposição Total (R$)": g.totalButia,
        "% Consolidado": fmtPct(g.consolidatedPct),
        "Última Análise": g.ultimaAnalise ?? "",
        Status: g.status,
      };
      for (const f of fundos) {
        r[`${f} R$`] = g.exposureByFundo[f] ?? 0;
        r[`${f} %`] = fmtPct(g.pctByFundo[f] ?? null);
      }
      return r;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Exposição por Grupo");

    const emRows = data.porGrupo.flatMap((g) =>
      g.emissores.map((e) => ({
        Grupo: g.grupo,
        Emissor: e.nome,
        CNPJ: e.cnpj,
        Rating: e.ratingBucketLabel,
        Setor: e.setor,
        "Exposição Total (R$)": e.totalButia,
        "% Consolidado": fmtPct(e.consolidatedPct),
        "Taxa Média (%)": e.weightedRate ?? "",
        Status: e.status,
        "Última Análise": e.ultimaAnalise ?? "",
      })),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emRows), "Detalhamento Emissor");

    const ativos = data.porGrupo.flatMap((g) =>
      g.emissores.flatMap((e) => e.ativos.map((a) => ativoRow(a, g.grupo, e.nome))),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ativos), "Detalhamento Ativo");
  } else {
    const rows = data.porEmissor.map((e) => {
      const r: Record<string, any> = {
        Emissor: e.nome,
        "Grupo Econômico": e.grupoEconomico,
        CNPJ: e.cnpj,
        Rating: e.ratingBucketLabel,
        Setor: e.setor,
        "Taxa Média (%)": e.weightedRate ?? "",
        "Exposição Total (R$)": e.totalButia,
        "% Consolidado": fmtPct(e.consolidatedPct),
        "Última Análise": e.ultimaAnalise ?? "",
        Status: e.status,
      };
      for (const f of fundos) {
        r[`${f} R$`] = e.exposureByFundo[f] ?? 0;
        r[`${f} %`] = fmtPct(e.pctByFundo[f] ?? null);
      }
      return r;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Exposição por Emissor");

    const ativos = data.porEmissor.flatMap((e) =>
      e.ativos.map((a) => ativoRow(a, e.grupoEconomico, e.nome)),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ativos), "Detalhamento Ativo");
  }

  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  XLSX.writeFile(wb, `exposicao-${mode}-${ts}.xlsx`);
}

function ativoRow(a: AssetRow, grupo: string, emissor: string) {
  return {
    Grupo: grupo,
    Emissor: emissor,
    Ativo: a.produto,
    "Tipo de Ativo": a.tipoAtivo,
    ISIN: a.isin ?? "",
    Ticker: a.ticker ?? "",
    Fundo: a.fundo,
    "Valor (R$)": a.valor,
    "% do Fundo": fmtPct(a.pctFundo),
    Taxa: a.taxaLabel ?? (a.taxaNum != null ? a.taxaNum.toFixed(2) + "%" : ""),
    Vencimento: a.vencimento ?? "",
    "Duration (DU)": a.durationDU ?? "",
    Status: a.status,
    "Última Análise": a.ultimaAnalise ?? "",
  };
}
