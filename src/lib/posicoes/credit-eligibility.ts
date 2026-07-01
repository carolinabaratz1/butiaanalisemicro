// Classifica ativos da BASE LOTE 45 quanto à elegibilidade para análise de
// crédito/emissor (rating, setor, grupo econômico).

export type DataQualityStatus =
  | 'ok'
  | 'sem_rating'          // elegível, tem CNPJ, mas sem rating encontrado
  | 'cnpj_nao_mapeado'    // elegível, mas sem CNPJ do emissor mapeado
  | 'sem_setor'
  | 'sem_mapeamento'
  | 'nao_aplicavel';

export interface CreditClassification {
  credit_analytics_eligible: boolean;
  non_credit_reason: string | null;
  data_quality_status: DataQualityStatus;
}

export interface ClassifiableAsset {
  product_class?: string | null;
  rating?: string | null;
  setor?: string | null;
  grupo_economico?: string | null;
  nome_emissor?: string | null;
  codigo_emissor?: string | null;
  cnpj_emissor?: string | null;
  ticker?: string | null;
  isin?: string | null;
}

function norm(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ELIGIBLE_PATTERNS = [
  /\bDEBEN/,           // Debênture / Debentures
  /\bCRI\b/,
  /\bCRA\b/,
  /\bLETRA FINANC/,    // Letra Financeira
  /\bLF\b/,
  /\bCDB\b/,
  /\bDPGE\b/,
  /\bFIDC\b/,
  /\bNOTA COMERCIAL/,
  /\bNC\b/,
  /\bCOMMERCIAL PAPER\b/,
  /\bLCA\b/,
  /\bLCI\b/,
];

const NON_ELIGIBLE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bLFT\b/, reason: 'Título público (LFT)' },
  { pattern: /\bLTN\b/, reason: 'Título público (LTN)' },
  { pattern: /\bNTN[- ]?[BFC]?\b/, reason: 'Título público (NTN)' },
  { pattern: /\bTESOURO\b/, reason: 'Título público' },
  { pattern: /\bTITULO PUBLICO\b/, reason: 'Título público' },
  { pattern: /\bTERMO\b/, reason: 'Operação de termo' },
  { pattern: /\bDAP\b/, reason: 'Contrato futuro (DAP)' },
  { pattern: /\bDI[- ]?FUTURE\b|\bDI FUT/, reason: 'Contrato futuro (DI)' },
  { pattern: /\bFUTURO\b|\bFUTURE\b/, reason: 'Contrato futuro' },
  { pattern: /\bCOMPROMISSADA\b|\bCOMPROM\b/, reason: 'Operação compromissada' },
  { pattern: /\bCAIXA\b|\bDISPONIBILIDADES\b/, reason: 'Caixa / disponibilidades' },
  { pattern: /\bDERIVATIV/, reason: 'Derivativo' },
  { pattern: /\bOPCA/, reason: 'Opção' },
  { pattern: /\bSWAP\b/, reason: 'Swap' },
  // Fundos genéricos (exceto FIDC, tratado como elegível acima).
  { pattern: /\bFUNDO\b|\bFUNDOS BR\b|\bCOTAS DE FUNDO\b|\bFI\b/, reason: 'Cotas de fundo' },
];

const NAO_APLICAVEL_MSG = 'Não aplicável para análise de crédito';

export function classifyCreditEligibility(row: ClassifiableAsset): CreditClassification {
  const cls = norm(row.product_class);

  // 1) Elegíveis por padrão
  for (const pat of ELIGIBLE_PATTERNS) {
    if (pat.test(cls)) {
      return {
        credit_analytics_eligible: true,
        non_credit_reason: null,
        data_quality_status: pickQualityStatus(row),
      };
    }
  }

  // 2) Não elegíveis por padrão
  for (const { pattern } of NON_ELIGIBLE_PATTERNS) {
    if (pattern.test(cls)) {
      return {
        credit_analytics_eligible: false,
        non_credit_reason: NAO_APLICAVEL_MSG,
        data_quality_status: 'nao_aplicavel',
      };
    }
  }

  // 3) Fallback: se tiver emissor + (rating ou setor), tratar como elegível
  const hasEmissor = !!(row.codigo_emissor?.trim() || row.nome_emissor?.trim());
  const hasRating = !!row.rating?.trim();
  const hasSetor = !!row.setor?.trim();
  if (hasEmissor && (hasRating || hasSetor)) {
    return {
      credit_analytics_eligible: true,
      non_credit_reason: null,
      data_quality_status: pickQualityStatus(row),
    };
  }

  return {
    credit_analytics_eligible: false,
    non_credit_reason: cls ? `Tipo de ativo não classificado (${row.product_class})` : NAO_APLICAVEL_MSG,
    data_quality_status: 'nao_aplicavel',
  };
}

function pickQualityStatus(row: ClassifiableAsset): DataQualityStatus {
  const cnpj = (row.cnpj_emissor ?? '').replace(/[^0-9]/g, '');
  const rating = row.rating?.trim();
  if (!cnpj) return 'cnpj_nao_mapeado';
  if (!rating || rating.toUpperCase() === 'S/R' || rating.toUpperCase() === 'N/R') {
    return 'sem_rating';
  }
  if (!row.setor?.trim()) return 'sem_setor';
  if (!row.grupo_economico?.trim() && !row.nome_emissor?.trim()) return 'sem_mapeamento';
  return 'ok';
}

export const CREDIT_ELIGIBILITY_LABELS: Record<DataQualityStatus, string> = {
  ok: 'Mapeado corretamente',
  sem_rating: 'Sem rating para o CNPJ',
  cnpj_nao_mapeado: 'CNPJ emissor não mapeado',
  sem_setor: 'Sem setor',
  sem_mapeamento: 'Grupo não mapeado',
  nao_aplicavel: 'Não aplicável para análise de crédito',
};
