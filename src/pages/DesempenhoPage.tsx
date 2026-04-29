import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { ANALISES_MOCK } from '@/data/desempenhoMock';
import {
  Periodo,
  inicioDoPeriodo,
  periodoAnterior,
  filtrarPorPeriodo,
  calcularKpis,
  calcularMetricasPorAnalista,
  AnalistaMetrica,
} from '@/utils/desempenhoUtils';
import { PeriodoSelector } from '@/components/desempenho/PeriodoSelector';
import { KpiCards } from '@/components/desempenho/KpiCards';
import { TabelaAnalistas } from '@/components/desempenho/TabelaAnalistas';
import { AnalistaSheet } from '@/components/desempenho/AnalistaSheet';
import { CalendarioEntregas } from '@/components/desempenho/CalendarioEntregas';
import { PainelSlaAcertividade } from '@/components/desempenho/PainelSlaAcertividade';

export default function DesempenhoPage() {
  const { currentUser } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [analistaSel, setAnalistaSel] = useState<AnalistaMetrica | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Guard de perfil
  if (!currentUser) return null;
  if (currentUser.funcao !== 'Gestor' && currentUser.funcao !== 'Coordenação/Especialista') {
    return <Navigate to="/" replace />;
  }

  const ref = useMemo(() => {
    // Usar a data mais recente do mock como "hoje" (mock é 2026); fallback para hoje real
    const datas = ANALISES_MOCK.map((a) => new Date(a.dataInicio).getTime());
    const max = Math.max(...datas, Date.now());
    return new Date(max);
  }, []);

  const filtradas = useMemo(
    () => filtrarPorPeriodo(ANALISES_MOCK, inicioDoPeriodo(periodo, ref)),
    [periodo, ref],
  );

  const filtradasAnt = useMemo(() => {
    const { inicio, fim } = periodoAnterior(periodo, ref);
    return filtrarPorPeriodo(ANALISES_MOCK, inicio, fim);
  }, [periodo, ref]);

  const kpisAtual = useMemo(() => calcularKpis(filtradas), [filtradas]);
  const kpisAnt   = useMemo(() => calcularKpis(filtradasAnt), [filtradasAnt]);
  const metricas  = useMemo(() => calcularMetricasPorAnalista(filtradas), [filtradas]);

  const handleSelect = (m: AnalistaMetrica) => {
    setAnalistaSel(m);
    setSheetOpen(true);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">Desempenho & Agenda</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Métricas de produtividade da equipe e calendário de entregas.
            </p>
          </div>
          <Badge variant="secondary" className="font-normal">{currentUser.funcao}</Badge>
        </div>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>

      {/* KPIs */}
      <KpiCards atual={kpisAtual} anterior={kpisAnt} />

      {/* Tabela */}
      <TabelaAnalistas metricas={metricas} onSelect={handleSelect} />

      {/* Grid inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalendarioEntregas analises={filtradas} />
        <PainelSlaAcertividade pendentes={filtradas} todasParaAcertividade={ANALISES_MOCK} />
      </div>

      <AnalistaSheet metrica={analistaSel} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
