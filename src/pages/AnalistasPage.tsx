import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnalistaProfile {
  id: string;
  nome: string;
  email: string;
  status: string;
  created_at: string;
  funcao: string;
}

export default function AnalistasPage() {
  const [analistas, setAnalistas] = useState<AnalistaProfile[]>([]);
  const [analisesCounts, setAnalisesCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Fetch analysts from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, email, status, created_at, funcao')
        .in('funcao', ['Analista', 'Coordenação/Especialista'])
        .order('nome');

      if (profiles) setAnalistas(profiles);

      // Fetch analysis counts per analyst
      const { data: analises } = await supabase
        .from('analises')
        .select('analista_responsavel');

      if (analises) {
        const counts: Record<string, number> = {};
        analises.forEach(a => {
          const key = a.analista_responsavel;
          counts[key] = (counts[key] || 0) + 1;
        });
        setAnalisesCounts(counts);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  const ativos = analistas.filter(a => a.status === 'Ativo').length;
  const inativos = analistas.filter(a => a.status !== 'Ativo').length;

  // Match analyst name to analista_responsavel field
  function getQtdAnalises(nome: string) {
    return analisesCounts[nome.trim()] || 0;
  }

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Analistas</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Analistas</p>
              <p className="text-2xl font-bold text-foreground">{analistas.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-success/15 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-status-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Analistas Ativos</p>
              <p className="text-2xl font-bold text-foreground">{ativos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
              <UserX className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ex-Analistas</p>
              <p className="text-2xl font-bold text-foreground">{inativos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-[11px] h-9">Nome</TableHead>
                <TableHead className="text-[11px] h-9">Função</TableHead>
                <TableHead className="text-[11px] h-9">E-mail</TableHead>
                <TableHead className="text-[11px] h-9">Data de Entrada</TableHead>
                <TableHead className="text-[11px] h-9">Status</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Qtd. Análises</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analistas.map(a => (
                <TableRow key={a.id} className={`border-border ${a.status !== 'Ativo' ? 'opacity-50' : ''}`}>
                  <TableCell className="text-sm py-2 font-medium">{a.nome}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className={`text-[10px] ${a.funcao === 'Coordenação/Especialista' ? 'text-primary border-primary/30 bg-primary/10' : 'text-muted-foreground border-border bg-muted/30'}`}>
                      {a.funcao === 'Coordenação/Especialista' ? 'Coord./Espec.' : 'Analista'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className={`text-[10px] ${a.status === 'Ativo' ? 'text-status-success border-status-success/30 bg-status-success/10' : 'text-muted-foreground border-border bg-muted/30'}`}>
                      {a.status === 'Ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm py-2 text-right font-semibold">{getQtdAnalises(a.nome)}</TableCell>
                </TableRow>
              ))}
              {analistas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum analista cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
