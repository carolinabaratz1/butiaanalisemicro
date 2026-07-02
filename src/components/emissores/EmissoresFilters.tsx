import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EmissorGestaoRow } from '@/hooks/useEmissoresGestao';

export type TriState = 'all' | 'yes' | 'no';

export interface EmissoresFilterState {
  search: string;
  grupo: string;
  setor: string;
  rating: string;
  status: string;
  recomendacao: string;
  analista: string;
  fundo: string;
  comPosicao: TriState;
  analiseVencida: TriState;
  comLimite: TriState;
  acimaLimite: TriState;
  proximoLimite: TriState;
  comAlerta: TriState;
  acao: string; // acao necessaria
}

export const defaultFilters: EmissoresFilterState = {
  search: '',
  grupo: 'all', setor: 'all', rating: 'all', status: 'all',
  recomendacao: 'all', analista: 'all', fundo: 'all',
  comPosicao: 'all', analiseVencida: 'all', comLimite: 'all',
  acimaLimite: 'all', proximoLimite: 'all', comAlerta: 'all',
  acao: 'all',
};

const ACOES: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'analise_vencida', label: 'Análise vencida' },
  { value: 'sem_analise', label: 'Sem análise' },
  { value: 'sem_limite', label: 'Sem limite' },
  { value: 'acima_limite', label: 'Acima do limite' },
  { value: 'proximo_limite', label: 'Próximo do limite' },
  { value: 'sem_rating', label: 'Rating ausente' },
  { value: 'cnpj_nao_mapeado', label: 'CNPJ não mapeado' },
  { value: 'cadastro_incompleto', label: 'Cadastro incompleto' },
];

export function EmissoresFilters({
  filters, onChange, rows,
}: {
  filters: EmissoresFilterState;
  onChange: (f: EmissoresFilterState) => void;
  rows: EmissorGestaoRow[];
}) {
  const grupos = useMemo(() => [...new Set(rows.map(r => r.grupo_economico).filter(Boolean))].sort() as string[], [rows]);
  const setores = useMemo(() => [...new Set(rows.map(r => r.setor).filter(Boolean))].sort() as string[], [rows]);
  const ratings = useMemo(() => [...new Set(rows.map(r => r.rating).filter(Boolean))].sort() as string[], [rows]);
  const statuses = useMemo(() => [...new Set(rows.map(r => r.analise_status).filter(Boolean))].sort() as string[], [rows]);
  const recos = useMemo(() => [...new Set(rows.map(r => r.analise_recomendacao).filter(Boolean))].sort() as string[], [rows]);
  const analistas = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => { if (r.analista_id) map.set(r.analista_id, r.analista_nome || r.analista_id); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const fundos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.funds_list.forEach(f => s.add(f.fundo)));
    return [...s].sort();
  }, [rows]);

  const set = (patch: Partial<EmissoresFilterState>) => onChange({ ...filters, ...patch });

  const active = Object.entries(filters).filter(([k, v]) => v !== (defaultFilters as any)[k]).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar emissor, CNPJ ou grupo..."
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            className="pl-8 h-8 text-sm bg-surface-1 border-border"
          />
        </div>
        <FilterSelect label="Grupo" value={filters.grupo} options={grupos} onChange={v => set({ grupo: v })} />
        <FilterSelect label="Setor" value={filters.setor} options={setores} onChange={v => set({ setor: v })} />
        <FilterSelect label="Rating" value={filters.rating} options={ratings} onChange={v => set({ rating: v })} />
        <FilterSelect label="Status" value={filters.status} options={statuses} onChange={v => set({ status: v })} />
        <FilterSelect label="Recomendação" value={filters.recomendacao} options={recos} onChange={v => set({ recomendacao: v })} />
        <FilterSelect
          label="Analista"
          value={filters.analista}
          options={analistas.map(([id, nome]) => ({ value: id, label: nome }))}
          onChange={v => set({ analista: v })}
        />
        <FilterSelect label="Fundo" value={filters.fundo} options={fundos} onChange={v => set({ fundo: v })} />

        <Select value={filters.acao} onValueChange={v => set({ acao: v })}>
          <SelectTrigger className="h-8 w-44 text-xs bg-surface-1 border-border">
            <SelectValue placeholder="Ação necessária" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {ACOES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {active > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onChange(defaultFilters)}>
            Limpar filtros <Badge variant="outline" className="ml-1 h-4 text-[10px]">{active}</Badge>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <TriToggle label="Com posição" value={filters.comPosicao} onChange={v => set({ comPosicao: v })} />
        <TriToggle label="Análise vencida" value={filters.analiseVencida} onChange={v => set({ analiseVencida: v })} />
        <TriToggle label="Com limite" value={filters.comLimite} onChange={v => set({ comLimite: v })} />
        <TriToggle label="Acima do limite" value={filters.acimaLimite} onChange={v => set({ acimaLimite: v })} />
        <TriToggle label="Próximo do limite" value={filters.proximoLimite} onChange={v => set({ proximoLimite: v })} />
        <TriToggle label="Com alerta" value={filters.comAlerta} onChange={v => set({ comAlerta: v })} />
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-36 text-xs bg-surface-1 border-border">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="bg-card border-border max-h-72">
        <SelectItem value="all">Todos · {label}</SelectItem>
        {opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function TriToggle({ label, value, onChange }: { label: string; value: TriState; onChange: (v: TriState) => void }) {
  const next: Record<TriState, TriState> = { all: 'yes', yes: 'no', no: 'all' };
  const cls = value === 'yes' ? 'border-status-success/50 text-status-success bg-status-success/10'
    : value === 'no' ? 'border-muted-foreground/30 text-muted-foreground bg-muted/40'
    : 'border-border text-muted-foreground';
  const sfx = value === 'yes' ? ': Sim' : value === 'no' ? ': Não' : '';
  return (
    <button
      type="button"
      onClick={() => onChange(next[value])}
      className={`text-[11px] px-2 h-7 rounded border ${cls}`}
    >
      {label}{sfx}
    </button>
  );
}

export function applyFilters(rows: EmissorGestaoRow[], f: EmissoresFilterState): EmissorGestaoRow[] {
  const q = f.search.toLowerCase().trim();
  return rows.filter(r => {
    if (q) {
      const hay = `${r.nome} ${r.cnpj} ${r.cnpj_norm} ${r.grupo_economico ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.grupo !== 'all' && r.grupo_economico !== f.grupo) return false;
    if (f.setor !== 'all' && r.setor !== f.setor) return false;
    if (f.rating !== 'all' && r.rating !== f.rating) return false;
    if (f.status !== 'all' && r.analise_status !== f.status) return false;
    if (f.recomendacao !== 'all' && r.analise_recomendacao !== f.recomendacao) return false;
    if (f.analista !== 'all' && r.analista_id !== f.analista) return false;
    if (f.fundo !== 'all' && !r.funds_list.some(x => x.fundo === f.fundo)) return false;
    if (f.comPosicao === 'yes' && !(r.exposure_total > 0)) return false;
    if (f.comPosicao === 'no' && r.exposure_total > 0) return false;
    if (f.analiseVencida === 'yes' && !r.analise_vencida) return false;
    if (f.analiseVencida === 'no' && r.analise_vencida) return false;
    if (f.comLimite === 'yes' && r.limit_status === 'nao_cadastrado') return false;
    if (f.comLimite === 'no' && r.limit_status !== 'nao_cadastrado') return false;
    if (f.acimaLimite === 'yes' && r.limit_status !== 'acima') return false;
    if (f.acimaLimite === 'no' && r.limit_status === 'acima') return false;
    if (f.proximoLimite === 'yes' && r.limit_status !== 'proximo') return false;
    if (f.proximoLimite === 'no' && r.limit_status === 'proximo') return false;
    if (f.comAlerta === 'yes' && r.alerts.length === 0) return false;
    if (f.comAlerta === 'no' && r.alerts.length > 0) return false;
    if (f.acao !== 'all') {
      const has = (t: string) => r.alerts.some(a => a.type === t);
      switch (f.acao) {
        case 'analise_vencida': if (!(r.analise_vencida)) return false; break;
        case 'sem_analise': if (r.analise_id) return false; break;
        case 'sem_limite': if (r.limit_status !== 'nao_cadastrado') return false; break;
        case 'acima_limite': if (r.limit_status !== 'acima') return false; break;
        case 'proximo_limite': if (r.limit_status !== 'proximo') return false; break;
        case 'sem_rating': if (r.rating) return false; break;
        case 'cnpj_nao_mapeado': if (r.cnpj_norm) return false; break;
        case 'cadastro_incompleto': if (!has('cadastro_incompleto')) return false; break;
      }
    }
    return true;
  });
}
