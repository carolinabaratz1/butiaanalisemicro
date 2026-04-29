import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Download, Upload, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, XCircle, Clock, FileQuestion } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f43f5e'];
const STATUS_COLORS: Record<string, string> = {
  'Aprovada': '#22c55e',
  'Vencida': '#eab308',
  'Reprovada': '#ef4444',
  'Em Análise': '#3b82f6',
  'Pendente': '#8b5cf6',
  'Sem Análise': '#64748b',
};

interface PosicaoRow {
  id: string;
  trading_desk_share_source: string;
  val_date: string;
  product_class: string;
  product: string;
  amount: number;
  isin: string | null;
  financial_price: number | null;
  duration_du: number | null;
  yield: number | null;
  implied_spread: number | null;
  dv01: number | null;
  created_at: string;
}

interface EnrichedPosition extends PosicaoRow {
  cnpj?: string;
  empresaNome?: string;
  empresaRating?: string | null;
  analiseStatus?: string;
  analiseRecomendacao?: string | null;
  analisePrecoMin?: number | null;
  analisePrecoMedio?: number | null;
  analisePrecoMax?: number | null;
  analiseDataConclusao?: string | null;
}

export default function PosicoesPage() {
  const [fundFilter, setFundFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('latest');
  const [biFundFilter, setBiFundFilter] = useState<string>('all');
  const [biClassFilter, setBiClassFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drillStatus, setDrillStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const pageSize = 50;

  // Fetch all distinct val_dates
  const { data: availableDates = [] } = useQuery({
    queryKey: ['posicoes-dates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posicoes')
        .select('val_date')
        .order('val_date', { ascending: false });
      if (error) throw error;
      const unique = [...new Set((data as any[]).map(d => d.val_date))].filter(Boolean);
      return unique as string[];
    },
  });

  const selectedDate = dateFilter === 'latest' ? (availableDates[0] || null) : dateFilter;

  const { data: posicoes = [], isLoading } = useQuery({
    queryKey: ['posicoes', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      let allData: PosicaoRow[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('posicoes')
          .select('*')
          .eq('val_date', selectedDate)
          .range(from, from + batchSize - 1)
          .order('created_at', { ascending: false });
        if (error) throw error;
        allData = [...allData, ...(data as PosicaoRow[])];
        hasMore = data.length === batchSize;
        from += batchSize;
      }
      return allData;
    },
    enabled: !!selectedDate,
  });

  // BI queries: emissoes, empresas, analises
  const { data: emissoes = [] } = useQuery({
    queryKey: ['emissoes-all'],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.from('emissoes').select('isin, cnpj_emissor, ticker').range(from, from + 999);
        if (error) throw error;
        all = [...all, ...data];
        hasMore = data.length === 1000;
        from += 1000;
      }
      return all as { isin: string; cnpj_emissor: string; ticker: string | null }[];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('cnpj, nome, rating, setor, tipo');
      if (error) throw error;
      return data as { cnpj: string; nome: string; rating: string | null; setor: string | null }[];
    },
  });

  const { data: analises = [] } = useQuery({
    queryKey: ['analises-all'],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.from('analises').select('empresa_id, status, tipo, recomendacao, preco_min, preco_medio, preco_maximo, data_conclusao, data_inicio').range(from, from + 999);
        if (error) throw error;
        all = [...all, ...data];
        hasMore = data.length === 1000;
        from += 1000;
      }
      return all as { empresa_id: string; status: string; tipo: string; recomendacao: string | null; preco_min: number | null; preco_medio: number | null; preco_maximo: number | null; data_conclusao: string | null; data_inicio: string }[];
    },
  });

  // Lookup maps
  const isinToCnpj = useMemo(() => {
    const map: Record<string, string> = {};
    emissoes.forEach(e => { map[e.isin] = e.cnpj_emissor; });
    return map;
  }, [emissoes]);

  const cnpjToEmpresa = useMemo(() => {
    const map: Record<string, { nome: string; rating: string | null; setor: string | null; tipo: string | null }> = {};
    empresas.forEach(e => { map[e.cnpj] = { nome: e.nome, rating: e.rating, setor: e.setor, tipo: (e as any).tipo ?? null }; });
    return map;
  }, [empresas]);

  // Latest analysis per empresa_id (cnpj)
  const latestAnaliseByEmpresa = useMemo(() => {
    const map: Record<string, typeof analises[0]> = {};
    const now = new Date();
    // Sort by data_inicio desc to get latest first
    const sorted = [...analises].sort((a, b) => (b.data_inicio || '').localeCompare(a.data_inicio || ''));
    sorted.forEach(a => {
      if (!map[a.empresa_id]) {
        map[a.empresa_id] = a;
      }
    });
    return map;
  }, [analises]);

  const getAnaliseStatus = (analise: typeof analises[0] | undefined, tipoEmissor?: string | null): string => {
    if (!analise) return 'Sem Análise';
    if (analise.status === 'Aprovada') {
      // FIDC: análise aprovada não vence
      if (tipoEmissor === 'FIDC') return 'Aprovada';
      if (analise.data_conclusao) {
        const conclusao = new Date(analise.data_conclusao);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (conclusao < oneYearAgo) return 'Vencida';
      }
      return 'Aprovada';
    }
    if (analise.status === 'Reprovada') return 'Reprovada';
    if (analise.status === 'Em Análise' || analise.status === 'em_andamento') return 'Em Análise';
    if (analise.status === 'Pendente' || analise.status === 'pendente') return 'Pendente';
    return analise.status;
  };

  // Enriched positions
  const enriched = useMemo<EnrichedPosition[]>(() => {
    return posicoes.map(p => {
      const cnpj = p.isin ? isinToCnpj[p.isin] : undefined;
      const empresa = cnpj ? cnpjToEmpresa[cnpj] : undefined;
      const analise = cnpj ? latestAnaliseByEmpresa[cnpj] : undefined;
      return {
        ...p,
        cnpj,
        empresaNome: empresa?.nome,
        empresaRating: empresa?.rating,
        analiseStatus: getAnaliseStatus(analise, empresa?.tipo),
        analiseRecomendacao: analise?.recomendacao || null,
        analisePrecoMin: analise?.preco_min ?? null,
        analisePrecoMedio: analise?.preco_medio ?? null,
        analisePrecoMax: analise?.preco_maximo ?? null,
        analiseDataConclusao: analise?.data_conclusao || null,
      };
    });
  }, [posicoes, isinToCnpj, cnpjToEmpresa, latestAnaliseByEmpresa]);

  // BI filtered
  const biFiltered = useMemo(() => {
    return enriched.filter(p => {
      return (biFundFilter === 'all' || p.trading_desk_share_source === biFundFilter)
        && (biClassFilter === 'all' || p.product_class === biClassFilter);
    });
  }, [enriched, biFundFilter, biClassFilter]);

  const allFunds = useMemo(() => [...new Set(posicoes.map(p => p.trading_desk_share_source))], [posicoes]);
  const allProductClasses = useMemo(() => [...new Set(posicoes.map(p => p.product_class))], [posicoes]);

  const filtered = useMemo(() => {
    return posicoes.filter(p => {
      return (fundFilter === 'all' || p.trading_desk_share_source === fundFilter)
        && (classFilter === 'all' || p.product_class === classFilter);
    });
  }, [posicoes, fundFilter, classFilter]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const byClass = useMemo(() => {
    const classes = [...new Set(biFiltered.map(p => p.product_class))];
    return classes.map(pc => ({
      name: pc,
      value: biFiltered.filter(p => p.product_class === pc).length,
    }));
  }, [biFiltered]);

  const byFund = useMemo(() => {
    const funds = [...new Set(biFiltered.map(p => p.trading_desk_share_source))];
    return funds.map(f => ({
      name: f.length > 25 ? f.substring(0, 25) + '…' : f,
      fullName: f,
      value: biFiltered.filter(p => p.trading_desk_share_source === f).length,
    }));
  }, [biFiltered]);

  const latestDate = selectedDate;

  const fmtNum = (v: number | null) => v === null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  const fmtPct = (v: number | null) => v === null ? '—' : (Number(v) * 100).toFixed(2) + '%';
  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    const dashParts = d.split('-');
    if (dashParts.length === 3 && dashParts[0].length === 4) return `${dashParts[2]}/${dashParts[1]}/${dashParts[0]}`;
    const slashParts = d.split('/');
    if (slashParts.length === 3 && slashParts[2].length === 4) return `${slashParts[1]}/${slashParts[0]}/${slashParts[2]}`;
    return d;
  };

  // ── BI Metrics ──
  // Posições que requerem análise (exclui Termo)
  const biFilteredForAnalysis = useMemo(() => biFiltered.filter(p => p.product !== 'Termo'), [biFiltered]);

  const biMetrics = useMemo(() => {
    const aprovadas = biFilteredForAnalysis.filter(p => p.analiseStatus === 'Aprovada').length;
    const vencidas = biFilteredForAnalysis.filter(p => p.analiseStatus === 'Vencida').length;
    const semAnalise = biFilteredForAnalysis.filter(p => p.analiseStatus === 'Sem Análise').length;
    const cobertura = biFilteredForAnalysis.length > 0 ? ((aprovadas / biFilteredForAnalysis.length) * 100).toFixed(1) : '0';
    return { aprovadas, vencidas, semAnalise, cobertura };
  }, [biFilteredForAnalysis]);

  const drillPositions = useMemo(() => {
    if (!drillStatus) return [];
    return biFilteredForAnalysis.filter(p => p.analiseStatus === drillStatus);
  }, [biFilteredForAnalysis, drillStatus]);

  const drillTitle = drillStatus === 'Vencida' ? 'Posições com Análise Vencida'
    : drillStatus === 'Sem Análise' ? 'Posições sem Análise'
    : drillStatus === 'Aprovada' ? 'Posições com Análise Aprovada'
    : `Posições: ${drillStatus}`;

  const handleDrillExport = () => {
    if (drillPositions.length === 0) return;
    const exportData = drillPositions.map(p => ({
      'Produto': p.product,
      'ISIN': p.isin || '',
      'Fundo': p.trading_desk_share_source,
      'Tipo': p.product_class,
      'Emissor': p.empresaNome || '',
      'Rating': p.empresaRating || '',
      'Quantidade': Number(p.amount),
      'Data Conclusão': p.analiseDataConclusao || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Posições');
    XLSX.writeFile(wb, `posicoes_${drillStatus?.toLowerCase().replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


  const durationData = useMemo(() => {
    const brackets = [
      { label: '0-1', min: 0, max: 1 },
      { label: '1-2', min: 1, max: 2 },
      { label: '2-3', min: 2, max: 3 },
      { label: '3-5', min: 3, max: 5 },
      { label: '5-10', min: 5, max: 10 },
      { label: '10+', min: 10, max: Infinity },
    ];
    return brackets.map(b => {
      const items = biFiltered.filter(p => {
        const d = p.duration_du ? Number(p.duration_du) / 252 : null; // DU to years
        return d !== null && d >= b.min && d < b.max;
      });
      return { name: b.label, qtd: items.length, volume: items.reduce((s, p) => s + Number(p.amount), 0) };
    });
  }, [biFiltered]);

  // Analysis status distribution
  const analiseStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    biFilteredForAnalysis.forEach(p => {
      const st = p.analiseStatus || 'Sem Análise';
      counts[st] = (counts[st] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [biFilteredForAnalysis]);

  // Coverage by fund (stacked bar)
  const coverageByFund = useMemo(() => {
    const funds = [...new Set(biFilteredForAnalysis.map(p => p.trading_desk_share_source))];
    return funds.map(f => {
      const items = biFilteredForAnalysis.filter(p => p.trading_desk_share_source === f);
      return {
        name: f.length > 20 ? f.substring(0, 20) + '…' : f,
        fullName: f,
        Aprovada: items.filter(p => p.analiseStatus === 'Aprovada').length,
        Vencida: items.filter(p => p.analiseStatus === 'Vencida').length,
        'Sem Análise': items.filter(p => p.analiseStatus === 'Sem Análise').length,
        Outras: items.filter(p => !['Aprovada', 'Vencida', 'Sem Análise'].includes(p.analiseStatus || '')).length,
      };
    });
  }, [biFilteredForAnalysis]);

  // Rating distribution
  const ratingData = useMemo(() => {
    const counts: Record<string, number> = {};
    biFiltered.forEach(p => {
      const r = p.empresaRating || 'Sem Rating';
      counts[r] = (counts[r] || 0) + 1;
    });
    const order = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC', 'CC', 'C', 'D', 'Sem Rating'];
    return Object.entries(counts)
      .sort(([a], [b]) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([name, value]) => ({ name, value }));
  }, [biFiltered]);

  // Equity panel
  const equityPositions = useMemo(() => {
    return biFiltered
      .filter(p => {
        const pc = p.product_class.toLowerCase();
        return pc.includes('equit') || pc.includes('ação') || pc.includes('acoes') || pc.includes('ações') || pc.includes('rv') || pc.includes('renda variável') || pc.includes('renda variavel');
      })
      .map(p => {
        const price = p.financial_price ? Number(p.financial_price) : null;
        const min = p.analisePrecoMin ? Number(p.analisePrecoMin) : null;
        const max = p.analisePrecoMax ? Number(p.analisePrecoMax) : null;
        let priceStatus: 'Abaixo' | 'Em Linha' | 'Acima' | '—' = '—';
        if (price !== null && min !== null && max !== null) {
          if (price < min) priceStatus = 'Abaixo';
          else if (price > max) priceStatus = 'Acima';
          else priceStatus = 'Em Linha';
        }
        return { ...p, priceStatus };
      });
  }, [biFiltered]);

  // ── Import ──
  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: 'Selecione um arquivo', variant: 'destructive' });
      return;
    }

    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

      if (rows.length === 0) {
        toast({ title: 'Arquivo vazio', description: 'Nenhuma linha encontrada.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      const colMap: Record<string, string> = {};
      const firstRow = rows[0];
      const keys = Object.keys(firstRow);
      const find = (candidates: string[]) => keys.find(k => candidates.some(c => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(c)));

      colMap.trading_desk_share_source = find(['tradingdesk', 'sharesource', 'fundo', 'fund']) || keys[0];
      colMap.val_date = find(['valdate', 'data', 'date']) || keys[1];
      colMap.product_class = find(['productclass', 'class', 'tipo', 'classe']) || keys[2];
      colMap.product = find(['product', 'produto', 'ativo']) || keys[3];
      colMap.amount = find(['amount', 'quantidade', 'qtd']) || keys[4];
      colMap.isin = find(['isin']) || '';
      colMap.financial_price = find(['financialprice', 'price', 'preco', 'pu']) || '';
      colMap.duration_du = find(['duration', 'duracao']) || '';
      colMap.yield = find(['yield', 'taxa']) || '';
      colMap.implied_spread = find(['spread', 'impliedspread']) || '';
      colMap.dv01 = find(['dv01']) || '';

      const firstValDate = rows[0][colMap.val_date];
      let valDateStr = '';
      if (firstValDate) {
        if (typeof firstValDate === 'number') {
          const d = XLSX.SSF.parse_date_code(firstValDate);
          valDateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        } else {
          valDateStr = String(firstValDate);
        }
      }

      if (valDateStr) {
        await supabase.from('posicoes').delete().eq('val_date', valDateStr);
      }

      const toNum = (v: any): number | null => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const toDateStr = (v: any): string => {
        if (!v) return '';
        if (typeof v === 'number') {
          const d = XLSX.SSF.parse_date_code(v);
          return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
        return String(v);
      };

      const insertRows = rows.map(r => ({
        trading_desk_share_source: String(r[colMap.trading_desk_share_source] || ''),
        val_date: toDateStr(r[colMap.val_date]),
        product_class: String(r[colMap.product_class] || ''),
        product: String(r[colMap.product] || ''),
        amount: toNum(r[colMap.amount]) ?? 0,
        isin: colMap.isin ? String(r[colMap.isin] || '') || null : null,
        financial_price: colMap.financial_price ? toNum(r[colMap.financial_price]) : null,
        duration_du: colMap.duration_du ? toNum(r[colMap.duration_du]) : null,
        yield: colMap.yield ? toNum(r[colMap.yield]) : null,
        implied_spread: colMap.implied_spread ? toNum(r[colMap.implied_spread]) : null,
        dv01: colMap.dv01 ? toNum(r[colMap.dv01]) : null,
      }));

      const batchSize = 500;
      for (let i = 0; i < insertRows.length; i += batchSize) {
        const batch = insertRows.slice(i, i + batchSize);
        const { error } = await supabase.from('posicoes').insert(batch);
        if (error) throw error;
      }

      toast({ title: 'Importação concluída', description: `${insertRows.length} posições importadas com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['posicoes'] });
      queryClient.invalidateQueries({ queryKey: ['posicoes-dates'] });
      queryClient.invalidateQueries({ queryKey: ['posicoes-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['posicoes-total-latest'] });
      setImportOpen(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro na importação', description: err.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  // ── Export ──
  const handleExport = () => {
    if (filtered.length === 0) {
      toast({ title: 'Sem dados', description: 'Nenhuma posição para exportar.', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      const exportData = filtered.map(p => ({
        'Fundo': p.trading_desk_share_source,
        'Data Ref': p.val_date,
        'Tipo': p.product_class,
        'Produto': p.product,
        'ISIN': p.isin || '',
        'Quantidade': Number(p.amount),
        'PU (R$)': p.financial_price !== null ? Number(p.financial_price) : '',
        'Duration': p.duration_du !== null ? Number(p.duration_du) : '',
        'Yield': p.yield !== null ? Number(p.yield) : '',
        'Spread': p.implied_spread !== null ? Number(p.implied_spread) : '',
        'DV01': p.dv01 !== null ? Number(p.dv01) : '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Posições');

      const colWidths = Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length, ...exportData.map(r => String((r as any)[key]).length).slice(0, 100)) + 2,
      }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `posicoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: 'Exportação concluída', description: `${filtered.length} registros exportados.` });
    } catch (err: any) {
      toast({ title: 'Erro na exportação', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const tooltipStyle = {
    backgroundColor: 'hsl(240 6% 10%)',
    border: '1px solid hsl(240 4% 20%)',
    borderRadius: '6px',
    fontSize: '12px',
    color: 'hsl(0 0% 95%)',
  };

  const getRecBadge = (rec: string | null) => {
    if (!rec) return <Badge variant="outline" className="text-[10px]">—</Badge>;
    const r = rec.toLowerCase();
    if (r === 'buy' || r === 'compra' || r === 'comprar') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"><TrendingUp className="h-3 w-3 mr-0.5" />Buy</Badge>;
    if (r === 'sell' || r === 'venda' || r === 'vender') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]"><TrendingDown className="h-3 w-3 mr-0.5" />Sell</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]"><Minus className="h-3 w-3 mr-0.5" />Hold</Badge>;
  };

  const getPriceStatusBadge = (status: string) => {
    if (status === 'Abaixo') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Abaixo</Badge>;
    if (status === 'Acima') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Acima</Badge>;
    if (status === 'Em Linha') return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Em Linha</Badge>;
    return <Badge variant="outline" className="text-[10px]">—</Badge>;
  };

  const getAnaliseStatusIcon = (status: string) => {
    switch (status) {
      case 'Aprovada': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case 'Vencida': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />;
      case 'Reprovada': return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case 'Em Análise': return <Clock className="h-3.5 w-3.5 text-blue-400" />;
      case 'Pendente': return <Clock className="h-3.5 w-3.5 text-purple-400" />;
      default: return <FileQuestion className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Posições</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-border flex-1 sm:flex-none" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Importar posições
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-border flex-1 sm:flex-none" onClick={handleExport} disabled={exporting || filtered.length === 0}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Exportar .xlsx
          </Button>
        </div>
      </div>

      {/* Import Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Posições</DialogTitle>
            <DialogDescription>
              Selecione um arquivo .xlsx ou .csv com as posições. As posições existentes para a mesma data de referência serão substituídas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Colunas esperadas: TradingDeskShareSource, ValDate, ProductClass, Product, Amount, ISIN, FinancialPrice, DurationDU, Yield, ImpliedSpread, DV01
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="tabela">
        <TabsList className="bg-surface-1 border border-border">
          <TabsTrigger value="tabela" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Tabela</TabsTrigger>
          <TabsTrigger value="analitico" className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Painel Analítico</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela" className="space-y-3 mt-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={fundFilter} onValueChange={v => { setFundFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-72 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Fundo" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todos os fundos</SelectItem>
                {allFunds.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={v => { setClassFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-52 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todos os tipos</SelectItem>
                {allProductClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={v => { setDateFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-52 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Data ref" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="latest">Mais recente</SelectItem>
                {availableDates.map(d => <SelectItem key={d} value={d}>{fmtDate(d)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center text-xs text-muted-foreground sm:ml-auto">
              Data ref: <span className="text-foreground font-medium ml-1">{latestDate ? fmtDate(latestDate) : '—'}</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando posições...</span>
            </div>
          ) : posicoes.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma posição importada</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Importar posições" para carregar os dados</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-card border-border">
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-[11px] h-9">Fundo</TableHead>
                        <TableHead className="text-[11px] h-9">Tipo</TableHead>
                        <TableHead className="text-[11px] h-9">Produto</TableHead>
                        <TableHead className="text-[11px] h-9">ISIN</TableHead>
                        <TableHead className="text-[11px] h-9 text-right">Qtd</TableHead>
                        <TableHead className="text-[11px] h-9 text-right">PU (R$)</TableHead>
                        <TableHead className="text-[11px] h-9 text-right">Duration</TableHead>
                        <TableHead className="text-[11px] h-9 text-right">Yield</TableHead>
                        <TableHead className="text-[11px] h-9 text-right">Spread</TableHead>
                        <TableHead className="text-[11px] h-9 text-right">DV01</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                            Nenhum resultado para os filtros selecionados
                          </TableCell>
                        </TableRow>
                      ) : paged.map((p) => {
                        const isDimmed = p.dv01 === null;
                        return (
                          <TableRow key={p.id} className={`border-border ${isDimmed ? 'text-muted-foreground/60' : ''}`}>
                            <TableCell className="text-[11px] py-1.5 max-w-[200px] truncate">{p.trading_desk_share_source}</TableCell>
                            <TableCell className="text-[11px] py-1.5">{p.product_class}</TableCell>
                            <TableCell className="text-[11px] py-1.5 font-mono font-medium">{p.product}</TableCell>
                            <TableCell className="text-[11px] py-1.5 font-mono text-muted-foreground">{p.isin || '—'}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{Number(p.amount).toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtNum(p.financial_price)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtNum(p.duration_du)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtPct(p.yield)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtPct(p.implied_spread)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtNum(p.dv01)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filtered.length} registros</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 text-xs border-border">Anterior</Button>
                    <span className="flex items-center px-2">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 text-xs border-border">Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="analitico" className="space-y-4 mt-3">
          {/* BI Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={biFundFilter} onValueChange={setBiFundFilter}>
              <SelectTrigger className="w-full sm:w-72 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Fundo" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todos os fundos</SelectItem>
                {allFunds.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={biClassFilter} onValueChange={setBiClassFilter}>
              <SelectTrigger className="w-full sm:w-52 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo de Ativo" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todos os tipos</SelectItem>
                {allProductClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center text-xs text-muted-foreground sm:ml-auto">
              Data ref: <span className="text-foreground font-medium ml-1">{latestDate ? fmtDate(latestDate) : '—'}</span>
            </div>
          </div>

          {/* KPIs Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Total de ativos</p>
              <p className="text-xl font-bold text-foreground mt-1">{biFiltered.length}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Fundos com posição</p>
              <p className="text-xl font-bold text-foreground mt-1">{new Set(biFiltered.map(p => p.trading_desk_share_source)).size}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Tipos distintos</p>
              <p className="text-xl font-bold text-foreground mt-1">{new Set(biFiltered.map(p => p.product_class)).size}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase">Data referência</p>
              <p className="text-xl font-bold text-foreground mt-1">{latestDate ? fmtDate(latestDate) : '—'}</p>
            </CardContent></Card>
          </div>

          {/* KPIs Row 2 - Research */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-card border-border border-l-4 border-l-emerald-500 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setDrillStatus('Aprovada')}><CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <p className="text-[11px] text-muted-foreground uppercase">Análise Aprovada</p>
              </div>
              <p className="text-xl font-bold text-emerald-400 mt-1">{biMetrics.aprovadas}</p>
            </CardContent></Card>
            <Card className="bg-card border-border border-l-4 border-l-yellow-500 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setDrillStatus('Vencida')}><CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <p className="text-[11px] text-muted-foreground uppercase">Análise Vencida</p>
              </div>
              <p className="text-xl font-bold text-yellow-400 mt-1">{biMetrics.vencidas}</p>
            </CardContent></Card>
            <Card className="bg-card border-border border-l-4 border-l-slate-500 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setDrillStatus('Sem Análise')}><CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <FileQuestion className="h-4 w-4 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground uppercase">Sem Análise</p>
              </div>
              <p className="text-xl font-bold text-muted-foreground mt-1">{biMetrics.semAnalise}</p>
            </CardContent></Card>
            <Card className="bg-card border-border border-l-4 border-l-blue-500"><CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-400" />
                <p className="text-[11px] text-muted-foreground uppercase">% Cobertura</p>
              </div>
              <p className="text-xl font-bold text-blue-400 mt-1">{biMetrics.cobertura}%</p>
            </CardContent></Card>
          </div>

          {posicoes.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <p className="text-sm text-muted-foreground">Importe posições para visualizar os gráficos</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Row: Tipo + Fundo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Tipo</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={byClass} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {byClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Posição por Fundo</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={byFund} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(240 5% 65%)' }} />
                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 9, fill: 'hsl(240 5% 65%)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Row: Status de Análise + Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Status de Análise da Carteira</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={analiseStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {analiseStatusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Duration (anos)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={durationData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(240 5% 65%)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(240 5% 65%)' }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => [Number(value).toLocaleString('pt-BR'), name === 'qtd' ? 'Qtd Ativos' : 'Volume']} />
                        <Bar dataKey="qtd" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Qtd Ativos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Row: Cobertura por Fundo + Rating */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cobertura por Fundo</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(250, coverageByFund.length * 30)}>
                      <BarChart data={coverageByFund} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(240 5% 65%)' }} />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 9, fill: 'hsl(240 5% 65%)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="Aprovada" stackId="a" fill="#22c55e" />
                        <Bar dataKey="Vencida" stackId="a" fill="#eab308" />
                        <Bar dataKey="Sem Análise" stackId="a" fill="#64748b" />
                        <Bar dataKey="Outras" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Exposição por Rating</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={ratingData}>
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(240 5% 65%)' }} interval={0} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(240 5% 65%)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Posições" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Equity Panel */}
              {equityPositions.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Painel de Ações ({equityPositions.length} posições)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-[11px] h-9">Ativo</TableHead>
                          <TableHead className="text-[11px] h-9">Fundo</TableHead>
                          <TableHead className="text-[11px] h-9">Status</TableHead>
                          <TableHead className="text-[11px] h-9">Recomendação</TableHead>
                          <TableHead className="text-[11px] h-9 text-right">Preço Atual</TableHead>
                          <TableHead className="text-[11px] h-9 text-right">Mín</TableHead>
                          <TableHead className="text-[11px] h-9 text-right">Médio</TableHead>
                          <TableHead className="text-[11px] h-9 text-right">Máx</TableHead>
                          <TableHead className="text-[11px] h-9">Range</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equityPositions.map(p => (
                          <TableRow key={p.id} className="border-border">
                            <TableCell className="text-[11px] py-1.5 font-medium">
                              <div>{p.product}</div>
                              {p.empresaNome && <div className="text-muted-foreground text-[10px]">{p.empresaNome}</div>}
                            </TableCell>
                            <TableCell className="text-[11px] py-1.5 max-w-[150px] truncate">{p.trading_desk_share_source}</TableCell>
                            <TableCell className="text-[11px] py-1.5">
                              <div className="flex items-center gap-1">
                                {getAnaliseStatusIcon(p.analiseStatus || 'Sem Análise')}
                                <span>{p.analiseStatus}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[11px] py-1.5">{getRecBadge(p.analiseRecomendacao)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{fmtNum(p.financial_price)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono text-muted-foreground">{fmtNum(p.analisePrecoMin)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono text-muted-foreground">{fmtNum(p.analisePrecoMedio)}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono text-muted-foreground">{fmtNum(p.analisePrecoMax)}</TableCell>
                            <TableCell className="text-[11px] py-1.5">{getPriceStatusBadge(p.priceStatus)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Drill-down Modal */}
      <Dialog open={!!drillStatus} onOpenChange={(open) => { if (!open) setDrillStatus(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{drillTitle}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {drillPositions.length} posição(ões) encontrada(s)
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-[11px] h-8">Produto</TableHead>
                  <TableHead className="text-[11px] h-8">ISIN</TableHead>
                  <TableHead className="text-[11px] h-8">Fundo</TableHead>
                  <TableHead className="text-[11px] h-8">Tipo</TableHead>
                  <TableHead className="text-[11px] h-8">Emissor</TableHead>
                  <TableHead className="text-[11px] h-8">Rating</TableHead>
                  <TableHead className="text-[11px] h-8 text-right">Quantidade</TableHead>
                  <TableHead className="text-[11px] h-8">Data Conclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillPositions.map(p => (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="text-[11px] py-1.5 font-medium">{p.product}</TableCell>
                    <TableCell className="text-[11px] py-1.5 font-mono">{p.isin || '—'}</TableCell>
                    <TableCell className="text-[11px] py-1.5 max-w-[180px] truncate">{p.trading_desk_share_source}</TableCell>
                    <TableCell className="text-[11px] py-1.5">{p.product_class}</TableCell>
                    <TableCell className="text-[11px] py-1.5">{p.empresaNome || '—'}</TableCell>
                    <TableCell className="text-[11px] py-1.5">{p.empresaRating || '—'}</TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono">{Number(p.amount).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-[11px] py-1.5">{p.analiseDataConclusao ? fmtDate(p.analiseDataConclusao) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDrillStatus(null)}>Fechar</Button>
            <Button size="sm" onClick={handleDrillExport} disabled={drillPositions.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar .xlsx
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
