import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayStatus, statusBadgeClass, fetchAllPaged } from '@/utils/analiseStatus';

const recomendacaoColors: Record<string, string> = {
  'Buy': 'bg-status-success/15 text-status-success border-status-success/30',
  'Hold': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Sell': 'bg-status-danger/15 text-status-danger border-status-danger/30',
};

function fmtDateBR(d: string | null | undefined): string {
  if (!d) return '—';
  const clean = d.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return clean;
}

function getAnalistaNome(id: string, profiles: { id: string; nome: string }[] = []): string {
  if (!id) return '—';
  const p = profiles.find(p => p.id === id || p.nome === id);
  if (p) return p.nome;
  return id;
}

type SortKey =
  | 'empresa' | 'tipo' | 'analista' | 'data_inicio' | 'data_conclusao'
  | 'status' | 'recomendacao' | 'data_comite' | 'versao';
type SortDir = 'asc' | 'desc';

export default function AnalisesPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [analistaFilter, setAnalistaFilter] = useState('all');
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('data_inicio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<any | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-lookup'],
    queryFn: async () =>
      fetchAllPaged<{ cnpj: string; nome: string; tipo: string | null }>((from, to) =>
        supabase.from('empresas').select('cnpj, nome, tipo').range(from, to),
      ),
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles-lookup-analises'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_profile_names');
      if (error) throw error;
      return (data as Array<{ id: string; nome: string; funcao: string; status: string }>) || [];
    },
  });

  const empresaByCnpj = useMemo(() => new Map(empresas.map(e => [e.cnpj, e])), [empresas]);

  function getEmpresaNome(id: string): string {
    return empresaByCnpj.get(id)?.nome || id;
  }
  function getTipoEmissor(cnpj: string): string | null {
    return empresaByCnpj.get(cnpj)?.tipo ?? null;
  }

  const { data: analises = [], isLoading } = useQuery({
    queryKey: ['analises'],
    queryFn: async () =>
      fetchAllPaged<any>((from, to) =>
        supabase.from('analises').select('*').order('data_inicio', { ascending: false }).range(from, to),
      ),
  });

  const analistasAtivos = allProfiles.filter(p =>
    p.status === 'Ativo' && (p.funcao === 'Analista' || p.funcao === 'Coordenação/Especialista')
  );

  const filteredSorted = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = analises.filter((a: any) => {
      const displayStatus = getDisplayStatus(a, getTipoEmissor(a.empresa_id));
      if (statusFilter !== 'all' && displayStatus !== statusFilter) return false;
      if (tipoFilter !== 'all' && a.tipo !== tipoFilter) return false;
      if (analistaFilter !== 'all' && a.analista_responsavel !== analistaFilter) return false;
      if (q) {
        const nome = getEmpresaNome(a.empresa_id).toLowerCase();
        const cnpj = (a.empresa_id || '').toLowerCase();
        const analista = getAnalistaNome(a.analista_responsavel, allProfiles).toLowerCase();
        if (!nome.includes(q) && !cnpj.includes(q) && !analista.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (av: any, bv: any) => {
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'pt-BR') * dir;
    };

    const keyOf = (a: any): any => {
      switch (sortKey) {
        case 'empresa': return getEmpresaNome(a.empresa_id);
        case 'tipo': return a.tipo;
        case 'analista': return getAnalistaNome(a.analista_responsavel, allProfiles);
        case 'data_inicio': return a.data_inicio;
        case 'data_conclusao': return a.data_conclusao;
        case 'status': return getDisplayStatus(a, getTipoEmissor(a.empresa_id));
        case 'recomendacao': return a.recomendacao;
        case 'data_comite': return a.data_comite;
        case 'versao': return a.versao ?? 0;
      }
    };
    return [...arr].sort((a, b) => cmp(keyOf(a), keyOf(b)));
  }, [analises, statusFilter, tipoFilter, analistaFilter, busca, sortKey, sortDir, empresaByCnpj, allProfiles]);

  const versions = selected
    ? analises.filter((a: any) => a.empresa_id === selected.empresa_id && a.tipo === selected.tipo)
    : [];

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="inline h-3 w-3 ml-1" />
      : <ArrowDown className="inline h-3 w-3 ml-1" />;
  }
  const SortableHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`text-[11px] h-9 cursor-pointer select-none hover:text-foreground ${className ?? ''}`}
      onClick={() => toggleSort(k)}
    >
      {children}<SortIcon k={k} />
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando análises…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Análises</h2>
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa, CNPJ ou analista..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-8 h-8 text-sm bg-surface-1 border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Em Análise">Em Análise</SelectItem>
            <SelectItem value="Concluída">Concluída</SelectItem>
            <SelectItem value="Aprovada">Aprovada</SelectItem>
            <SelectItem value="Reprovada">Reprovada</SelectItem>
            <SelectItem value="Vencida">Vencida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-32 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="Crédito Privado">Crédito Privado</SelectItem>
            <SelectItem value="Ações">Ações</SelectItem>
          </SelectContent>
        </Select>
        <Select value={analistaFilter} onValueChange={setAnalistaFilter}>
          <SelectTrigger className="w-full sm:w-44 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Analista" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos analistas</SelectItem>
            {analistasAtivos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0 overflow-x-auto">
          {filteredSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">Nenhuma análise encontrada</p>
              <p className="text-xs mt-1">As análises aparecerão aqui quando forem cadastradas no sistema.</p>
            </div>
          ) : (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="border-border">
                  <SortableHead k="empresa">Empresa</SortableHead>
                  <SortableHead k="tipo">Tipo</SortableHead>
                  <SortableHead k="analista">Analista</SortableHead>
                  <SortableHead k="data_inicio">Início</SortableHead>
                  <SortableHead k="data_conclusao">Conclusão</SortableHead>
                  <SortableHead k="status">Status</SortableHead>
                  <SortableHead k="recomendacao">Recomendação</SortableHead>
                  <SortableHead k="data_comite">Comitê</SortableHead>
                  <SortableHead k="versao">Versão</SortableHead>
                  <TableHead className="text-[11px] h-9 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((a: any) => {
                  const displayStatus = getDisplayStatus(a, getTipoEmissor(a.empresa_id));
                  return (
                    <TableRow key={a.id} className="border-border">
                      <TableCell className="text-sm py-2">
                        <div className="font-medium">{getEmpresaNome(a.empresa_id)}</div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5" title={a.empresa_id}>{a.empresa_id}</div>
                      </TableCell>
                      <TableCell className="text-sm py-2">{a.tipo}</TableCell>
                      <TableCell className="text-sm py-2">{getAnalistaNome(a.analista_responsavel, allProfiles)}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{fmtDateBR(a.data_inicio)}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{fmtDateBR(a.data_conclusao)}</TableCell>
                      <TableCell className="py-2"><Badge variant="outline" className={`text-[10px] ${statusBadgeClass(displayStatus)}`}>{displayStatus}</Badge></TableCell>
                      <TableCell className="py-2">
                        {a.recomendacao ? (
                          <Badge variant="outline" className={`text-[10px] ${recomendacaoColors[a.recomendacao] || ''}`}>{a.recomendacao}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{fmtDateBR(a.data_comite)}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">v{a.versao}</TableCell>
                      <TableCell className="py-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelected(a)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          {selected && (() => {
            const displayStatus = getDisplayStatus(selected, getTipoEmissor(selected.empresa_id));
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{getEmpresaNome(selected.empresa_id)} — Análise v{selected.versao}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground text-xs">Tipo:</span> <span>{selected.tipo}</span></div>
                    <div><span className="text-muted-foreground text-xs">Status:</span> <Badge variant="outline" className={`text-[10px] ml-1 ${statusBadgeClass(displayStatus)}`}>{displayStatus}</Badge></div>
                    <div><span className="text-muted-foreground text-xs">Analista Responsável:</span> <span>{getAnalistaNome(selected.analista_responsavel, allProfiles)}</span></div>
                    <div><span className="text-muted-foreground text-xs">Analista Secundário:</span> <span>{getAnalistaNome(selected.analista_secundario || '', allProfiles)}</span></div>
                    <div><span className="text-muted-foreground text-xs">Início:</span> <span>{fmtDateBR(selected.data_inicio)}</span></div>
                    <div><span className="text-muted-foreground text-xs">Conclusão:</span> <span>{fmtDateBR(selected.data_conclusao)}</span></div>
                    <div><span className="text-muted-foreground text-xs">Decisão:</span> <span>{selected.decisao || '—'}</span></div>
                    <div><span className="text-muted-foreground text-xs">Convicção:</span> <span>{selected.conviccao || '—'}</span></div>
                    {selected.data_comite && <div><span className="text-muted-foreground text-xs">Data do Comitê:</span> <span>{fmtDateBR(selected.data_comite)}</span></div>}
                    {selected.aprovado_por && <div><span className="text-muted-foreground text-xs">Aprovado por:</span> <span>{selected.aprovado_por}</span></div>}
                    {selected.data_aprovacao && <div><span className="text-muted-foreground text-xs">Data aprovação:</span> <span>{fmtDateBR(selected.data_aprovacao)}</span></div>}
                  </div>

                  {selected.recomendacao && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">Recomendação:</span>
                        <Badge variant="outline" className={`text-[10px] ${recomendacaoColors[selected.recomendacao] || ''}`}>{selected.recomendacao}</Badge>
                      </div>
                      {(selected.preco_min || selected.preco_medio || selected.preco_maximo) && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-surface-1 p-2 rounded text-center">
                            <p className="text-[9px] text-muted-foreground uppercase">Preço Mín.</p>
                            <p className="text-sm font-medium">{selected.preco_min ? `R$ ${Number(selected.preco_min).toFixed(2)}` : '—'}</p>
                          </div>
                          <div className="bg-surface-1 p-2 rounded text-center">
                            <p className="text-[9px] text-muted-foreground uppercase">Preço Médio</p>
                            <p className="text-sm font-medium">{selected.preco_medio ? `R$ ${Number(selected.preco_medio).toFixed(2)}` : '—'}</p>
                          </div>
                          <div className="bg-surface-1 p-2 rounded text-center">
                            <p className="text-[9px] text-muted-foreground uppercase">Preço Máx.</p>
                            <p className="text-sm font-medium">{selected.preco_maximo ? `R$ ${Number(selected.preco_maximo).toFixed(2)}` : '—'}</p>
                          </div>
                        </div>
                      )}
                      {selected.data_alvo && (
                        <div><span className="text-muted-foreground text-xs">Data-Alvo:</span> <span>{fmtDateBR(selected.data_alvo)}</span></div>
                      )}
                    </div>
                  )}

                  {selected.justificativa_rejeicao && (
                    <div><p className="text-xs text-muted-foreground mb-1">Justificativa de Devolução:</p><p className="text-sm bg-surface-1 p-2 rounded text-status-danger">{selected.justificativa_rejeicao}</p></div>
                  )}
                  <div><p className="text-xs text-muted-foreground mb-1">Riscos:</p><p className="text-sm bg-surface-1 p-2 rounded">{selected.riscos || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Gatilhos:</p><p className="text-sm bg-surface-1 p-2 rounded">{selected.gatilhos || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Justificativa:</p><p className="text-sm bg-surface-1 p-2 rounded">{selected.justificativa || '—'}</p></div>
                  {selected.relatorio && (
                    <div><p className="text-xs text-muted-foreground mb-1">Relatório:</p><p className="text-sm bg-surface-1 p-2 rounded whitespace-pre-wrap">{selected.relatorio}</p></div>
                  )}
                  {versions.length > 1 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Histórico de versões:</p>
                      <div className="space-y-1">
                        {versions.map((v: any) => {
                          const vStatus = getDisplayStatus(v, getTipoEmissor(v.empresa_id));
                          return (
                            <div key={v.id} className="flex items-center gap-3 text-xs p-2 bg-surface-1 rounded">
                              <span className="font-medium">v{v.versao}</span>
                              <Badge variant="outline" className={`text-[9px] ${statusBadgeClass(vStatus)}`}>{vStatus}</Badge>
                              <span className="text-muted-foreground">{fmtDateBR(v.data_inicio)}</span>
                              {v.recomendacao && <Badge variant="outline" className={`text-[9px] ${recomendacaoColors[v.recomendacao] || ''}`}>{v.recomendacao}</Badge>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
