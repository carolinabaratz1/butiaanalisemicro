import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EmissorGestaoRow } from '@/hooks/useEmissoresGestao';
import { cn } from '@/lib/utils';

type Pendencia = {
  tipo: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  status: string;
  observacoes: string;
  action?: { label: string; to?: string; };
};

function buildPendencias(row: EmissorGestaoRow | null): Pendencia[] {
  if (!row) return [];
  const list: Pendencia[] = [];
  const hasPos = row.exposure_total > 0;

  if (row.analise_vencida) {
    list.push({
      tipo: 'Análise vencida',
      descricao: hasPos ? 'Análise expirada e emissor com posição em carteira' : 'Análise expirada',
      responsavel: row.analista_nome || 'Risco e Compliance',
      prazo: row.analise_data_validade || '—',
      prioridade: hasPos ? 'Alta' : 'Média',
      status: 'Aberta',
      observacoes: row.analise_recomendacao ? `Recomendação anterior: ${row.analise_recomendacao}` : '',
      action: { label: 'Renovar análise', to: `/pipeline-de-research` },
    });
  }
  if (!row.analise_id) {
    list.push({
      tipo: 'Sem análise',
      descricao: hasPos ? 'Emissor com posição sem análise cadastrada' : 'Emissor sem análise',
      responsavel: 'Coordenação/Especialista',
      prazo: '—',
      prioridade: hasPos ? 'Alta' : 'Baixa',
      status: 'Aberta',
      observacoes: '',
      action: { label: 'Solicitar análise', to: `/pipeline-de-research` },
    });
  }
  if (row.limit_status === 'nao_cadastrado' && hasPos) {
    list.push({
      tipo: 'Sem limite',
      descricao: 'Emissor com posição sem limite aprovado',
      responsavel: 'Risco e Compliance',
      prazo: '—',
      prioridade: 'Média',
      status: 'Aberta',
      observacoes: '',
      action: { label: 'Cadastrar limite' },
    });
  }
  if (row.limit_status === 'acima') {
    list.push({
      tipo: 'Acima do limite',
      descricao: `Uso do limite em ${((row.usage_ratio ?? 0) * 100).toFixed(0)}%`,
      responsavel: 'Risco e Compliance',
      prazo: 'Imediato',
      prioridade: 'Alta',
      status: 'Aberta',
      observacoes: '',
    });
  }
  if (row.limit_status === 'proximo') {
    list.push({
      tipo: 'Próximo do limite',
      descricao: `Uso do limite em ${((row.usage_ratio ?? 0) * 100).toFixed(0)}%`,
      responsavel: 'Gestor',
      prazo: '30 dias',
      prioridade: 'Média',
      status: 'Aberta',
      observacoes: '',
    });
  }
  if (!row.rating) {
    list.push({
      tipo: 'Rating ausente',
      descricao: 'Emissor sem rating no cadastro mestre',
      responsavel: 'Risco e Compliance',
      prazo: '—',
      prioridade: 'Média',
      status: 'Aberta',
      observacoes: '',
    });
  }
  if (!row.grupo_economico || !row.setor) {
    list.push({
      tipo: 'Cadastro incompleto',
      descricao: !row.grupo_economico && !row.setor ? 'Sem grupo econômico e sem setor' : (!row.grupo_economico ? 'Sem grupo econômico' : 'Sem setor'),
      responsavel: 'Gestor',
      prazo: '—',
      prioridade: hasPos ? 'Média' : 'Baixa',
      status: 'Aberta',
      observacoes: '',
    });
  }
  return list;
}

function prioClass(p: string): string {
  return p === 'Alta' ? 'bg-status-danger/15 text-status-danger border-status-danger/30'
    : p === 'Média' ? 'bg-status-warning/15 text-status-warning border-status-warning/30'
    : 'bg-muted/40 text-muted-foreground border-border';
}

export function AgendaPendenciasTab({ row }: { row: EmissorGestaoRow | null }) {
  const pendencias = buildPendencias(row);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <p className="text-xs font-medium">Pendências e ações requeridas</p>
          <Badge variant="outline" className="text-[10px]">{pendencias.length}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-[11px] h-9">Pendência</TableHead>
              <TableHead className="text-[11px] h-9">Responsável</TableHead>
              <TableHead className="text-[11px] h-9">Prazo</TableHead>
              <TableHead className="text-[11px] h-9">Prioridade</TableHead>
              <TableHead className="text-[11px] h-9">Status</TableHead>
              <TableHead className="text-[11px] h-9">Observações</TableHead>
              <TableHead className="text-[11px] h-9 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendencias.map((p, i) => (
              <TableRow key={i} className={cn(
                'border-border',
                p.prioridade === 'Alta' && 'bg-status-danger/5',
              )}>
                <TableCell className="py-2">
                  <div className="text-sm font-medium">{p.tipo}</div>
                  <div className="text-[11px] text-muted-foreground">{p.descricao}</div>
                </TableCell>
                <TableCell className="py-2 text-xs text-muted-foreground">{p.responsavel}</TableCell>
                <TableCell className="py-2 text-xs">{p.prazo}</TableCell>
                <TableCell className="py-2"><Badge variant="outline" className={cn('text-[10px]', prioClass(p.prioridade))}>{p.prioridade}</Badge></TableCell>
                <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{p.status}</Badge></TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground">{p.observacoes || '—'}</TableCell>
                <TableCell className="py-2 text-right">
                  {p.action?.to ? (
                    <Link to={p.action.to}><Button size="sm" variant="ghost" className="h-6 text-[11px]">{p.action.label}</Button></Link>
                  ) : p.action ? (
                    <span className="text-[10px] text-muted-foreground">{p.action.label}</span>
                  ) : '—'}
                </TableCell>
              </TableRow>
            ))}
            {!pendencias.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">Nenhuma pendência aberta.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
