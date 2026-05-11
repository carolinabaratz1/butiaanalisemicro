import { read, utils } from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface RawRow {
  ticker: string;
  url_b3: string;
  data_assembleia: string; // yyyy-mm-dd
  tipo: string;
}

export interface UploadResult {
  total_linhas: number;
  novas: number;
  duplicadas: number;
  com_posicao: number;
  sem_posicao: number;
  pendente_vinculo: number;
}

const TIPOS_VALIDOS = new Set(['AGO', 'AGE', 'AGO/E', 'AGDEB', 'Assembleia de Cotistas']);

// Converte '04/05/26' (DD/MM/YY) ou serial Excel em ISO yyyy-mm-dd.
function parseData(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // DD/MM/YY ou DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    let yy = m[3];
    if (yy.length === 2) yy = (parseInt(yy, 10) > 70 ? '19' : '20') + yy;
    return `${yy}-${mm}-${dd}`;
  }
  // ISO já vem ok
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export async function parseAssembleiasFile(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const out: RawRow[] = [];
  for (const r of rows) {
    const ticker = String(r['Ticker'] ?? '').trim().toUpperCase();
    const url = String(r['Texto'] ?? '').trim();
    const tipoRaw = String(r['Tipo'] ?? '').trim().toUpperCase();
    const tipo = tipoRaw === 'AGO/E' ? 'AGO/E' : tipoRaw === 'AGDEB' ? 'AGDEB' : tipoRaw;
    const data = parseData(r['Data Assembléia'] ?? r['Data Assembleia']);
    if (!ticker || !data || !TIPOS_VALIDOS.has(tipo)) continue;
    out.push({ ticker, url_b3: url, data_assembleia: data, tipo });
  }
  return out;
}

interface TriageContext {
  empresasByCodigo: Map<string, { cnpj: string; nome: string }>;
  equityTickers: Set<string>;            // tickers em posicoes Equity
  debtCnpjs: Set<string>;                 // CNPJs com posição em debêntures (via emissoes.isin)
}

export async function buildTriageContext(): Promise<TriageContext> {
  const [empresasR, posicoesR, emissoesR] = await Promise.all([
    supabase.from('empresas').select('cnpj, nome, codigo_emissor'),
    supabase.from('posicoes').select('isin, product_class'),
    supabase.from('emissoes').select('isin, ticker, cnpj_emissor'),
  ]);
  const empresasByCodigo = new Map<string, { cnpj: string; nome: string }>();
  for (const e of (empresasR.data ?? []) as Array<{ cnpj: string; nome: string; codigo_emissor: string | null }>) {
    if (e.codigo_emissor) empresasByCodigo.set(e.codigo_emissor.trim().toUpperCase(), { cnpj: e.cnpj, nome: e.nome });
  }
  const equityIsins = new Set<string>();
  const debtIsins = new Set<string>();
  for (const p of (posicoesR.data ?? []) as Array<{ isin: string | null; product_class: string | null }>) {
    if (!p.isin || !p.product_class) continue;
    const pc = p.product_class.trim();
    if (pc === 'Equity') equityIsins.add(p.isin);
    else debtIsins.add(p.isin);
  }
  // Equity tickers — via emissoes.ticker dos isins de equity
  const equityTickers = new Set<string>();
  const debtCnpjs = new Set<string>();
  for (const e of (emissoesR.data ?? []) as Array<{ isin: string; ticker: string | null; cnpj_emissor: string }>) {
    if (equityIsins.has(e.isin) && e.ticker) equityTickers.add(e.ticker.trim().toUpperCase());
    if (debtIsins.has(e.isin)) debtCnpjs.add(e.cnpj_emissor);
  }
  return { empresasByCodigo, equityTickers, debtCnpjs };
}

export function triageRow(row: RawRow, ctx: TriageContext): {
  triagem: 'com_posicao' | 'sem_posicao' | 'pendente_vinculo';
  cnpj_emissor: string | null;
  empresa_nome: string | null;
} {
  const emp = ctx.empresasByCodigo.get(row.ticker);
  const cnpj = emp?.cnpj ?? null;
  const nome = emp?.nome ?? null;
  const isEquityType = row.tipo === 'AGO' || row.tipo === 'AGE' || row.tipo === 'AGO/E';
  if (isEquityType) {
    if (ctx.equityTickers.has(row.ticker)) return { triagem: 'com_posicao', cnpj_emissor: cnpj, empresa_nome: nome };
    return { triagem: 'sem_posicao', cnpj_emissor: cnpj, empresa_nome: nome };
  }
  if (row.tipo === 'AGDEB') {
    if (cnpj && ctx.debtCnpjs.has(cnpj)) return { triagem: 'pendente_vinculo', cnpj_emissor: cnpj, empresa_nome: nome };
    return { triagem: 'sem_posicao', cnpj_emissor: cnpj, empresa_nome: nome };
  }
  return { triagem: 'sem_posicao', cnpj_emissor: cnpj, empresa_nome: nome };
}

export async function processUpload(file: File, userId: string | null): Promise<UploadResult> {
  const rows = await parseAssembleiasFile(file);
  const ctx = await buildTriageContext();

  // Buscar existentes para dedupe
  const { data: existentes } = await supabase
    .from('assembleias' as any)
    .select('ticker, data_assembleia, tipo, url_b3')
    .eq('origem', 'upload');
  const dedupeKey = (t?: string | null, d?: string | null, tipo?: string | null, url?: string | null) =>
    `${t ?? ''}|${d ?? ''}|${tipo ?? ''}|${url ?? ''}`;
  const existingKeys = new Set(
    ((existentes ?? []) as Array<any>).map(e => dedupeKey(e.ticker, e.data_assembleia, e.tipo, e.url_b3)),
  );

  const result: UploadResult = {
    total_linhas: rows.length,
    novas: 0,
    duplicadas: 0,
    com_posicao: 0,
    sem_posicao: 0,
    pendente_vinculo: 0,
  };

  const inserts: any[] = [];
  for (const row of rows) {
    if (existingKeys.has(dedupeKey(row.ticker, row.data_assembleia, row.tipo, row.url_b3))) {
      result.duplicadas++;
      continue;
    }
    const tri = triageRow(row, ctx);
    if (tri.triagem === 'com_posicao') result.com_posicao++;
    else if (tri.triagem === 'pendente_vinculo') result.pendente_vinculo++;
    else result.sem_posicao++;

    inserts.push({
      tipo: row.tipo,
      titulo: `${row.tipo} — ${tri.empresa_nome ?? row.ticker}`,
      ticker: row.ticker,
      url_b3: row.url_b3,
      data_assembleia: row.data_assembleia,
      data_evento: row.data_assembleia, // mantém compatibilidade com coluna existente NOT NULL
      origem: 'upload',
      cnpj_emissor: tri.cnpj_emissor,
      cnpj_empresa: tri.cnpj_emissor,
      triagem: tri.triagem,
      status: 'Agendado',
      documentos: [],
    });
    result.novas++;
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('assembleias' as any).insert(inserts);
    if (error) throw error;
  }

  await supabase.from('assembleia_upload_log' as any).insert({
    filename: file.name,
    total_linhas: result.total_linhas,
    novas: result.novas,
    duplicadas: result.duplicadas,
    com_posicao: result.com_posicao,
    sem_posicao: result.sem_posicao,
    pendente_vinculo: result.pendente_vinculo,
    uploaded_by: userId,
  });

  return result;
}
