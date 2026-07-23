import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, ExternalLink, Search, FileSearch } from "lucide-react";

// ----------------------------------------------------------------------------
// Radar de Ofertas
// Mostra o universo de ofertas públicas de valores mobiliários (CVM), sempre
// completo (nunca filtrado por emissor da plataforma) — apenas sinaliza
// visualmente quando o emissor já está cadastrado. Fonte: view
// v_ofertas_publicas_cvm_enriquecida (ver migração 20260722190500).
//
// NOTA: o nome real de algumas colunas do CSV original da CVM pode variar/ter
// sido renomeado (histórico confirmado no changelog do portal dados.cvm.gov.br).
// A Edge Function sync-cvm-ofertas já lida com isso via alias matching + guarda
// a linha bruta inteira em raw_data — por isso o dialog de detalhes sempre
// exibe raw_data completo, além dos campos normalizados, para nunca esconder
// informação que a CVM disponibilizou mas que não foi mapeada para uma coluna
// dedicada.
// ----------------------------------------------------------------------------

const CVM_DATASET_URL = "https://dados.cvm.gov.br/dataset/oferta-distrib";

type OfertaRow = {
  id: string;
  tipo_ativo: string;
  cnpj_emissor: string | null;
  nome_emissor: string | null;
  numero_registro_cvm: string | null;
  numero_emissao: string | null;
  numero_serie: string | null;
  situacao: string | null;
  modalidade: string | null;
  data_referencia: string | null;
  data_encerramento: string | null;
  valor_total: number | null;
  raw_data: Record<string, string>;
  source_dataset: string | null;
  synced_at: string;
  empresa_id_existente: string | null;
  empresa_nome_cadastrado: string | null;
  empresa_rating_atual: string | null;
  emissor_ja_cadastrado: boolean;
  analise_id_existente: string | null;
  analise_status_existente: string | null;
};

type SyncLogRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "em_andamento" | "sucesso" | "erro" | "parcial";
  total_linhas_processadas: number;
  total_inseridas: number;
  total_atualizadas: number;
  mensagem_erro: string | null;
};

const PERIODO_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o histórico" },
];

function formatCurrency(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return d;
  }
}

function situacaoBadgeVariant(situacao: string | null): "default" | "secondary" | "outline" | "destructive" {
  const s = (situacao || "").toLowerCase();
  if (s.includes("registrad") || s.includes("deferid")) return "default";
  if (s.includes("cancelad") || s.includes("indeferid")) return "destructive";
  if (s.includes("análise") || s.includes("analise")) return "secondary";
  return "outline";
}

export default function RadarDeOfertasPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("30");
  const [busca, setBusca] = useState("");
  const [detalheOferta, setDetalheOferta] = useState<OfertaRow | null>(null);

  const { data: ultimoSync } = useQuery({
    queryKey: ["cvm-ofertas-sync-log-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cvm_ofertas_sync_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SyncLogRow | null;
    },
    refetchInterval: 30_000,
  });

  const { data: ofertas = [], isLoading } = useQuery({
    queryKey: ["radar-ofertas-cvm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_ofertas_publicas_cvm_enriquecida")
        .select("*")
        .order("data_referencia", { ascending: false, nullsFirst: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as OfertaRow[];
    },
  });

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    ofertas.forEach((o) => o.tipo_ativo && set.add(o.tipo_ativo));
    return Array.from(set).sort();
  }, [ofertas]);

  const ofertasFiltradas = useMemo(() => {
    const cutoff = periodoFiltro === "all" ? null : Date.now() - Number(periodoFiltro) * 86_400_000;
    const buscaLower = busca.trim().toLowerCase();

    return ofertas.filter((o) => {
      if (tipoFiltro !== "todos" && o.tipo_ativo !== tipoFiltro) return false;
      if (cutoff !== null) {
        const ref = o.data_referencia ? new Date(o.data_referencia + "T00:00:00").getTime() : null;
        if (ref === null || ref < cutoff) return false;
      }
      if (buscaLower) {
        const haystack = `${o.nome_emissor ?? ""} ${o.cnpj_emissor ?? ""} ${o.numero_registro_cvm ?? ""}`.toLowerCase();
        if (!haystack.includes(buscaLower)) return false;
      }
      return true;
    });
  }, [ofertas, tipoFiltro, periodoFiltro, busca]);

  const novosEmissores = useMemo(
    () => ofertasFiltradas.filter((o) => !o.emissor_ja_cadastrado).length,
    [ofertasFiltradas],
  );

  const sincronizarAgora = useMutation({
    mutationFn: async () => {
      type SyncResponse = {
        log_id?: string;
        status?: "em_andamento" | "sucesso" | "parcial" | "erro";
        total_linhas_processadas?: number;
        total_inseridas?: number;
        total_atualizadas?: number;
        next_file_index?: number;
        next_row_offset?: number;
        done?: boolean;
        mensagem_erro?: string;
      };

      let payload: {
        log_id?: string;
        file_index?: number;
        row_offset?: number;
        totals?: {
          totalProcessadas: number;
          totalInseridas: number;
          totalAtualizadas: number;
        };
      } = {};

      for (let step = 0; step < 80; step++) {
        const { data, error } = await supabase.functions.invoke("sync-cvm-ofertas", { body: payload });
        if (error) throw error;
        const result = data as SyncResponse;

        queryClient.invalidateQueries({ queryKey: ["cvm-ofertas-sync-log-latest"] });

        if (result.done || result.status === "sucesso") return result;
        if (result.status === "erro" || result.status === "parcial") return result;
        if (!result.log_id) throw new Error("Sincronização sem identificador de log");

        payload = {
          log_id: result.log_id,
          file_index: result.next_file_index ?? 0,
          row_offset: result.next_row_offset ?? 0,
          totals: {
            totalProcessadas: result.total_linhas_processadas ?? 0,
            totalInseridas: result.total_inseridas ?? 0,
            totalAtualizadas: result.total_atualizadas ?? 0,
          },
        };
      }

      throw new Error("Sincronização não terminou dentro do limite de etapas");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cvm-ofertas-sync-log-latest"] });
      queryClient.invalidateQueries({ queryKey: ["radar-ofertas-cvm"] });

      if (data?.status === "sucesso") {
        toast.success(
          `Sincronização concluída: ${data.total_inseridas ?? 0} novas, ${data.total_atualizadas ?? 0} atualizadas`,
        );
      } else if (data?.status === "parcial") {
        toast.warning(
          `Sincronização parcial (${data.total_linhas_processadas ?? 0} linhas processadas) — ${data.mensagem_erro ?? "erro desconhecido"}`,
        );
      } else if (data?.status === "erro") {
        toast.error(data.mensagem_erro || "Erro durante a sincronização");
      } else {
        toast.success("Sincronização concluída");
      }
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao iniciar sincronização"),
  });

  // ----------------------------------------------------------------------------
  // Botão "Analisar": cria (ou reaproveita) um registro mínimo em `empresas` para
  // o emissor da oferta, e cria uma nova análise em `analises` já vinculada à
  // oferta via `oferta_cvm_id`. Mantém as convenções já usadas por
  // EmpresasPage/PipelineResearchPage (tipo='Crédito Privado', status inicial
  // 'Pendente', empresa_id = CNPJ em texto, sem FK).
  // ----------------------------------------------------------------------------
  const analisarOferta = useMutation({
    mutationFn: async (oferta: OfertaRow) => {
      if (!oferta.cnpj_emissor) {
        throw new Error("Esta oferta não possui CNPJ do emissor identificado — não é possível vincular ao Pipeline.");
      }

      let empresaId = oferta.empresa_id_existente;
      if (!empresaId) {
        const { data: existing } = await supabase
          .from("empresas")
          .select("cnpj")
          .eq("cnpj", oferta.cnpj_emissor)
          .maybeSingle();

        if (existing) {
          empresaId = existing.cnpj;
        } else {
          const { error: insertEmpresaError } = await supabase.from("empresas").insert({
            nome: oferta.nome_emissor || oferta.cnpj_emissor,
            cnpj: oferta.cnpj_emissor,
            tipo: "CORPORATIVO",
          });
          if (insertEmpresaError) throw insertEmpresaError;
          empresaId = oferta.cnpj_emissor;
        }
      }

      const { data: maxRows } = await supabase
        .from("analises")
        .select("versao")
        .eq("empresa_id", empresaId)
        .order("versao", { ascending: false })
        .limit(1);
      const novaVersao = (maxRows?.[0]?.versao ?? 0) + 1;

      const hoje = new Date().toISOString().slice(0, 10);

      const { error: insertAnaliseError } = await (supabase.from("analises") as any).insert({
        empresa_id: empresaId,
        tipo: "Crédito Privado",
        analista_responsavel: currentUser?.nome || currentUser?.email || "",
        data_inicio: hoje,
        status: "Pendente",
        versao: novaVersao,
        oferta_cvm_id: oferta.id,
        observacoes: `Origem: Radar de Ofertas CVM (${oferta.tipo_ativo}, registro ${oferta.numero_registro_cvm ?? "s/n"})`,
      });
      if (insertAnaliseError) throw insertAnaliseError;
    },
    onSuccess: () => {
      toast.success("Análise criada no Pipeline");
      queryClient.invalidateQueries({ queryKey: ["radar-ofertas-cvm"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-analises"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar análise"),
  });

  const statusLabel: Record<SyncLogRow["status"], string> = {
    em_andamento: "Em andamento",
    sucesso: "OK",
    erro: "Erro",
    parcial: "Parcial",
  };
  const statusVariant: Record<SyncLogRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
    em_andamento: "secondary",
    sucesso: "default",
    erro: "destructive",
    parcial: "outline",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Radar de Ofertas</h2>
          <p className="text-xs text-muted-foreground">
            Ofertas públicas de valores mobiliários (CVM) — universo completo, sempre atualizado.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          disabled={sincronizarAgora.isPending}
          onClick={() => sincronizarAgora.mutate()}
        >
          {sincronizarAgora.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sincronizar agora
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ofertas no filtro atual</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{ofertasFiltradas.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Emissores novos (não cadastrados)</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{novosEmissores}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border sm:col-span-2 lg:col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Última sincronização</p>
            {ultimoSync ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-sm font-medium text-foreground">{formatDateTime(ultimoSync.started_at)}</p>
                <Badge variant={statusVariant[ultimoSync.status]} className="text-[10px]">
                  {statusLabel[ultimoSync.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {ultimoSync.total_inseridas} novas · {ultimoSync.total_atualizadas} atualizadas
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Nenhuma sincronização registrada ainda</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar emissor, CNPJ ou registro..."
            className="h-8 text-xs pl-8 pr-3 rounded-md border border-input bg-background w-64"
          />
        </div>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="h-8 text-xs w-48">
            <SelectValue placeholder="Tipo de ativo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tiposDisponiveis.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {PERIODO_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando ofertas...
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Emissor</TableHead>
                  <TableHead>Nº Registro CVM</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Data ref.</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ofertasFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma oferta encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
                {ofertasFiltradas.map((oferta) => (
                  <TableRow key={oferta.id}>
                    <TableCell className="text-xs">{oferta.tipo_ativo}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{oferta.nome_emissor || "—"}</span>
                        {oferta.emissor_ja_cadastrado ? (
                          <Badge variant="default" className="text-[9px]">
                            Cadastrado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">
                            Novo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{oferta.numero_registro_cvm || "—"}</TableCell>
                    <TableCell className="text-xs">{oferta.modalidade || "—"}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={situacaoBadgeVariant(oferta.situacao)} className="text-[9px]">
                        {oferta.situacao || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(oferta.data_referencia)}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(oferta.valor_total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => setDetalheOferta(oferta)}
                        >
                          <FileSearch className="h-3.5 w-3.5" /> Detalhes
                        </Button>
                        {oferta.analise_id_existente ? (
                          <Badge variant="secondary" className="text-[9px]">
                            Já em análise
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={analisarOferta.isPending}
                            onClick={() => analisarOferta.mutate(oferta)}
                          >
                            Analisar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de detalhes */}
      <Dialog open={!!detalheOferta} onOpenChange={(open) => !open && setDetalheOferta(null)}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalheOferta?.nome_emissor || "Detalhes da oferta"}</DialogTitle>
            <DialogDescription>
              {detalheOferta?.tipo_ativo} · Registro CVM {detalheOferta?.numero_registro_cvm || "s/n"}
            </DialogDescription>
          </DialogHeader>

          {detalheOferta && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">CNPJ do emissor</p>
                  <p className="font-medium">{detalheOferta.cnpj_emissor || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nº emissão / série</p>
                  <p className="font-medium">
                    {detalheOferta.numero_emissao || "—"} / {detalheOferta.numero_serie || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modalidade</p>
                  <p className="font-medium">{detalheOferta.modalidade || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Situação</p>
                  <p className="font-medium">{detalheOferta.situacao || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data de referência</p>
                  <p className="font-medium">{formatDate(detalheOferta.data_referencia)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data de encerramento</p>
                  <p className="font-medium">{formatDate(detalheOferta.data_encerramento)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor total</p>
                  <p className="font-medium">{formatCurrency(detalheOferta.valor_total)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Emissor na plataforma</p>
                  <p className="font-medium">
                    {detalheOferta.emissor_ja_cadastrado
                      ? `${detalheOferta.empresa_nome_cadastrado} (rating ${detalheOferta.empresa_rating_atual || "—"})`
                      : "Ainda não cadastrado"}
                  </p>
                </div>
              </div>

              {/* Todos os campos brutos vindos do CSV da CVM — inclui qualquer coluna
                  que a Edge Function ainda não normalizou, para nunca esconder dado disponível. */}
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Todos os campos disponíveis (fonte CVM)</p>
                <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                  {Object.entries(detalheOferta.raw_data || {}).map(([campo, valor]) => (
                    <div key={campo} className="flex justify-between gap-4 px-3 py-1.5 text-[11px]">
                      <span className="text-muted-foreground shrink-0">{campo}</span>
                      <span className="text-right break-all">{valor || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href={CVM_DATASET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Ver fonte de dados na CVM
              </a>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDetalheOferta(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
