import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnaliseEmissao } from '@/contexts/AnaliseEmissaoContext';
import { emissores, type Emissor } from '@/data/emissores';

export default function EmpresasPage() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [setorFilter, setSetorFilter] = useState('all');
  const { permissions } = useAuth();
  const { getAnalisesAtivas, temPrazoVencido } = useAnaliseEmissao();

  const tipos = [...new Set(emissores.map(e => e.tipo))];
  const setores = [...new Set(emissores.map(e => e.setorButia).filter(Boolean))].sort();

  const filtered = emissores.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = e.nomeAbreviado.toLowerCase().includes(q) || e.nomeCompleto.toLowerCase().includes(q) || e.cnpj.includes(search);
    const matchTipo = tipoFilter === 'all' || e.tipo === tipoFilter;
    const matchSetor = setorFilter === 'all' || e.setorButia === setorFilter;
    return matchSearch && matchTipo && matchSetor;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Empresas / Emissores</h2>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-surface-1 border-border" />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-40 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-48 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            <SelectItem value="all">Todos os setores</SelectItem>
            {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-[11px] h-9">Nome</TableHead>
                <TableHead className="text-[11px] h-9">CNPJ</TableHead>
                <TableHead className="text-[11px] h-9">Tipo</TableHead>
                <TableHead className="text-[11px] h-9">Setor</TableHead>
                <TableHead className="text-[11px] h-9">Rating</TableHead>
                <TableHead className="text-[11px] h-9">Análises Ativas</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 50).map(e => {
                const ativas = getAnalisesAtivas(e.cnpj);
                const vencido = temPrazoVencido(e.cnpj);
                return (
                  <TableRow key={e.cnpj} className="border-border">
                    <TableCell className="text-sm py-2 font-medium">{e.nomeAbreviado}</TableCell>
                    <TableCell className="text-xs py-2 text-muted-foreground font-mono">{e.cnpj}</TableCell>
                    <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{e.tipo}</Badge></TableCell>
                    <TableCell className="text-sm py-2 text-muted-foreground">{e.setorButia || '—'}</TableCell>
                    <TableCell className="text-sm py-2">{e.ratingAtual || '—'}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        {ativas > 0 && <Badge variant="outline" className="text-[10px] bg-status-info/15 text-status-info border-status-info/30">{ativas}</Badge>}
                        {vencido && <AlertTriangle className="h-3.5 w-3.5 text-status-danger" />}
                        {ativas === 0 && !vencido && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Link to={`/empresas/${encodeURIComponent(e.cnpj)}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1">
                          <ExternalLink className="h-3 w-3" /> Detalhe
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 50 de {filtered.length} resultados. Refine a busca.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
