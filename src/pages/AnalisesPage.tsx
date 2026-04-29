import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';


const statusClass: Record<string, string> = {
  'Pendente': 'bg-status-warning/15 text-status-warning border-status-warning/30',
  'Em Análise': 'bg-status-info/15 text-status-info border-status-info/30',
  'Concluída': 'bg-muted/30 text-muted-foreground border-border',
  'Aprovada': 'bg-status-success/15 text-status-success border-status-success/30',
  'Reprovada': 'bg-status-danger/15 text-status-danger border-status-danger/30',
  'Vencida': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

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

function isVencida(status: string, dataConclusao: string | null, tipoEmissor?: string | null): boolean {
  // FIDC analyses do not expire — they have continuous monitoring instead
  if (tipoEmissor === 'FIDC') return false;
  if (status !== 'Aprovada' || !dataConclusao) return false;
  const conclusao = new Date(dataConclusao.split('T')[0]);
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  return conclusao < umAnoAtras;
}

function getDisplayStatus(status: string, dataConclusao: string | null, tipoEmissor?: string | null): string {
  if (isVencida(status, dataConclusao, tipoEmissor)) return 'Vencida';
  return status;
}

function getAnalistaNome(id: string, profiles: { id: string; nome: string }[] = []): string {
  if (!id) return '—';
  const p = profiles.find(p => p.id === id || p.nome === id);
  if (p) return p.nome;
  return id;
}

export default function AnalisesPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [analistaFilter, setAnalistaFilter] = useState('all');
  const [selected, setSelected] = useState<any | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('cnpj, nome, tipo');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles-lookup-analises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, funcao, status');
      if (error) throw error;
      return data || [];
    },
  });

  function getEmpresaNome(id: string): string {
    const e = empresas.find(em => em.cnpj === id);
    return e?.nome || id;
  }

  function getTipoEmissor(cnpj: string): string | null {
    const e = empresas.find(em => em.cnpj === cnpj);
    return e?.tipo ?? null;
  }

  const { data: analises = [], isLoading } = useQuery({
    queryKey: ['analises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analises')
        .select('*')
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = analises.filter(a => {
    const displayStatus = getDisplayStatus(a.status, a.data_conclusao);
    return (statusFilter === 'all' || displayStatus === statusFilter)
      && (tipoFilter === 'all' || a.tipo === tipoFilter)
      && (analistaFilter === 'all' || a.analista_responsavel === analistaFilter);
  });

  const versions = selected
    ? analises.filter(a => a.empresa_id === selected.empresa_id && a.tipo === selected.tipo)
    : [];

  const analistasAtivos = allProfiles.filter(p =>
    p.status === 'Ativo' && (p.funcao === 'Analista' || p.funcao === 'Coordenação/Especialista')
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
      <div className="flex flex-col sm:flex-row gap-3">
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
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">Nenhuma análise encontrada</p>
              <p className="text-xs mt-1">As análises aparecerão aqui quando forem cadastradas no sistema.</p>
            </div>
          ) : (
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-[11px] h-9">Empresa</TableHead>
                  <TableHead className="text-[11px] h-9">Tipo</TableHead>
                  <TableHead className="text-[11px] h-9">Analista</TableHead>
                  <TableHead className="text-[11px] h-9">Início</TableHead>
                  <TableHead className="text-[11px] h-9">Conclusão</TableHead>
                  <TableHead className="text-[11px] h-9">Status</TableHead>
                  <TableHead className="text-[11px] h-9">Recomendação</TableHead>
                  <TableHead className="text-[11px] h-9">Comitê</TableHead>
                  <TableHead className="text-[11px] h-9">Versão</TableHead>
                  <TableHead className="text-[11px] h-9 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const displayStatus = getDisplayStatus(a.status, a.data_conclusao);
                  return (
                    <TableRow key={a.id} className="border-border">
                      <TableCell className="text-sm py-2 font-medium">{getEmpresaNome(a.empresa_id)}</TableCell>
                      <TableCell className="text-sm py-2">{a.tipo}</TableCell>
                      <TableCell className="text-sm py-2">{getAnalistaNome(a.analista_responsavel, allProfiles)}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{fmtDateBR(a.data_inicio)}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{fmtDateBR(a.data_conclusao)}</TableCell>
                      <TableCell className="py-2"><Badge variant="outline" className={`text-[10px] ${statusClass[displayStatus] || ''}`}>{displayStatus}</Badge></TableCell>
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
            const displayStatus = getDisplayStatus(selected.status, selected.data_conclusao);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{getEmpresaNome(selected.empresa_id)} — Análise v{selected.versao}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground text-xs">Tipo:</span> <span>{selected.tipo}</span></div>
                    <div><span className="text-muted-foreground text-xs">Status:</span> <Badge variant="outline" className={`text-[10px] ml-1 ${statusClass[displayStatus] || ''}`}>{displayStatus}</Badge></div>
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

                  {/* Recomendação + Preços */}
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
                        {versions.map(v => {
                          const vStatus = getDisplayStatus(v.status, v.data_conclusao);
                          return (
                            <div key={v.id} className="flex items-center gap-3 text-xs p-2 bg-surface-1 rounded">
                              <span className="font-medium">v{v.versao}</span>
                              <Badge variant="outline" className={`text-[9px] ${statusClass[vStatus] || ''}`}>{vStatus}</Badge>
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
