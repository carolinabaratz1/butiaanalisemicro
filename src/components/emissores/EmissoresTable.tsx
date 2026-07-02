import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ExternalLink, Download } from 'lucide-react';
import { RatingBadge } from '@/components/ratings/RatingBadge';
import { LimitUsageBar } from './LimitUsageBar';
import { AlertBadges, analysisStatusBadgeClass } from './AlertBadges';
import type { EmissorGestaoRow } from '@/hooks/useEmissoresGestao';
import { cn } from '@/lib/utils';

function fmtBRL(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  if (Math.abs(v) >= 1_000_000_000) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1e3).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const PAGE_SIZE = 40;

export function EmissoresTable({ rows }: { rows: EmissorGestaoRow[] }) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<'nome' | 'exposure' | 'validade' | 'usage'>('exposure');

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'nome': return (a.nome || '').localeCompare(b.nome || '');
        case 'validade': {
          const av = a.analise_data_validade || '9999';
          const bv = b.analise_data_validade || '9999';
          return av.localeCompare(bv);
        }
        case 'usage': return (b.usage_ratio ?? -1) - (a.usage_ratio ?? -1);
        default: return b.exposure_total - a.exposure_total;
      }
    });
    return arr;
  }, [rows, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const exportCsv = () => {
    const header = [
      'Emissor', 'CNPJ', 'Grupo', 'Setor', 'Rating', 'Status Análise', 'Recomendação',
      'Exposição Total', '% PL Consolidado', 'Fundos', 'Maior Fundo', '% PL Maior Fundo',
      'Limite (R$)', 'Limite (% PL)', 'Uso do Limite', 'Validade Análise', 'Analista',
    ];
    const lines = [header.join(';')];
    sorted.forEach(r => {
      lines.push([
        r.nome, r.cnpj, r.grupo_economico ?? '', r.setor ?? '', r.rating ?? '',
        r.analise_status ?? '', r.analise_recomendacao ?? '',
        r.exposure_total, r.consolidated_pct ?? '', r.funds_count,
        r.largest_fund ?? '', r.largest_fund_pct ?? '',
        r.limit_value ?? '', r.limit_pct_nav ?? '', r.usage_ratio ?? '',
        r.analise_data_validade ?? '', r.analista_nome ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'emissores-gestao.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-card border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="text-xs text-muted-foreground">
          {sorted.length} emissor(es) · ordenar por:{' '}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="bg-transparent border border-border rounded px-1 py-0.5 text-xs ml-1"
          >
            <option value="exposure">Exposição</option>
            <option value="nome">Nome</option>
            <option value="validade">Validade análise</option>
            <option value="usage">Uso do limite</option>
          </select>
        </p>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={exportCsv}>
          <Download className="h-3 w-3" /> Exportar
        </Button>
      </div>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[1600px]">
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-[11px] h-9 sticky left-0 bg-card z-10">Emissor</TableHead>
              <TableHead className="text-[11px] h-9">CNPJ</TableHead>
              <TableHead className="text-[11px] h-9">Grupo</TableHead>
              <TableHead className="text-[11px] h-9">Setor</TableHead>
              <TableHead className="text-[11px] h-9">Rating</TableHead>
              <TableHead className="text-[11px] h-9">Status Análise</TableHead>
              <TableHead className="text-[11px] h-9">Recomendação</TableHead>
              <TableHead className="text-[11px] h-9 text-right">Exposição</TableHead>
              <TableHead className="text-[11px] h-9 text-right">% PL Cons.</TableHead>
              <TableHead className="text-[11px] h-9 text-right">Fundos</TableHead>
              <TableHead className="text-[11px] h-9">Maior Fundo</TableHead>
              <TableHead className="text-[11px] h-9 text-right">% PL Maior</TableHead>
              <TableHead className="text-[11px] h-9 text-right">Limite</TableHead>
              <TableHead className="text-[11px] h-9 w-40">Uso Limite</TableHead>
              <TableHead className="text-[11px] h-9">Validade</TableHead>
              <TableHead className="text-[11px] h-9">Analista</TableHead>
              <TableHead className="text-[11px] h-9">Alertas</TableHead>
              <TableHead className="text-[11px] h-9 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map(r => (
              <TableRow key={r.cnpj_norm || r.cnpj} className="border-border">
                <TableCell className="py-2 sticky left-0 bg-card z-10 font-medium text-sm max-w-[240px] truncate">
                  <Link
                    to={`/emissores/${encodeURIComponent(r.cnpj)}`}
                    title="Abrir lâmina do emissor"
                    className="hover:text-primary hover:underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    {r.nome}
                  </Link>
                </TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground font-mono">{r.cnpj || '—'}</TableCell>
                <TableCell className="py-2 text-xs text-muted-foreground max-w-[140px] truncate">{r.grupo_economico || '—'}</TableCell>
                <TableCell className="py-2 text-xs text-muted-foreground">{r.setor || '—'}</TableCell>
                <TableCell className="py-2">
                  <RatingBadge rating={r.rating} source={r.rating_source ?? 'nr'} agencia={r.rating_agencia} data={r.rating_data} />
                </TableCell>
                <TableCell className="py-2">
                  {r.analise_status ? (
                    <Badge variant="outline" className={cn('text-[10px]', analysisStatusBadgeClass(r.analise_status, r.analise_vencida))}>
                      {r.analise_status}{r.analise_vencida ? ' · vencida' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-muted/40 text-muted-foreground border-border">Sem análise</Badge>
                  )}
                </TableCell>
                <TableCell className="py-2">
                  {r.analise_recomendacao ? (
                    <Badge variant="outline" className={cn('text-[10px]', analysisStatusBadgeClass(r.analise_recomendacao))}>
                      {r.analise_recomendacao}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-right text-sm tabular-nums font-medium">{fmtBRL(r.exposure_total)}</TableCell>
                <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">{fmtPct(r.consolidated_pct)}</TableCell>
                <TableCell className="py-2 text-right text-xs tabular-nums">{r.funds_count || '—'}</TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground max-w-[160px] truncate">{r.largest_fund || '—'}</TableCell>
                <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">{fmtPct(r.largest_fund_pct)}</TableCell>
                <TableCell className="py-2 text-right text-xs tabular-nums">
                  {r.limit_value ? fmtBRL(r.limit_value) : (r.limit_pct_nav ? `${(r.limit_pct_nav * 100).toFixed(1)}% PL` : '—')}
                </TableCell>
                <TableCell className="py-2 w-40"><LimitUsageBar ratio={r.usage_ratio} status={r.limit_status} /></TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground">{fmtDateBR(r.analise_data_validade)}</TableCell>
                <TableCell className="py-2 text-[11px] text-muted-foreground max-w-[120px] truncate">{r.analista_nome || '—'}</TableCell>
                <TableCell className="py-2"><AlertBadges alerts={r.alerts} /></TableCell>
                <TableCell className="py-2 text-right">
                  <Link to={`/emissores/${encodeURIComponent(r.cnpj)}`}>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1">
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {!pageItems.length && (
              <TableRow>
                <TableCell colSpan={18} className="text-center text-xs text-muted-foreground py-8">
                  Nenhum emissor corresponde aos filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {sorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Página {current} de {totalPages} · {pageItems.length} de {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={current <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={current >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
