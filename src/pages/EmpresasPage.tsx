import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search } from 'lucide-react';
import { empresas, getAnalistaNome, analistas, type Empresa } from '@/data/mockData';

export default function EmpresasPage() {
  const [search, setSearch] = useState('');
  const [setorFilter, setSetorFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [list, setList] = useState<Empresa[]>(empresas);

  const setores = [...new Set(empresas.map(e => e.setor))];

  const filtered = list.filter(e => {
    const matchSearch = e.nome.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search);
    const matchSetor = setorFilter === 'all' || e.setor === setorFilter;
    const matchTipo = tipoFilter === 'all' || e.tipo === tipoFilter;
    return matchSearch && matchSetor && matchTipo;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nova: Empresa = {
      id: `e${Date.now()}`,
      nome: fd.get('nome') as string,
      cnpj: fd.get('cnpj') as string,
      setor: fd.get('setor') as string,
      subsetor: fd.get('subsetor') as string,
      tipo: fd.get('tipo') as 'Aberta' | 'Fechada',
      pais: fd.get('pais') as string || 'Brasil',
      descricao: fd.get('descricao') as string,
      analistaPrincipal: fd.get('analistaPrincipal') as string,
      analistaBackup: fd.get('analistaBackup') as string,
    };
    setList([...list, nova]);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Empresas</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova Empresa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-card border-border">
            <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome</Label><Input name="nome" required className="mt-1 h-8 text-sm bg-surface-1 border-border" /></div>
                <div><Label className="text-xs">CNPJ</Label><Input name="cnpj" required className="mt-1 h-8 text-sm bg-surface-1 border-border" /></div>
                <div><Label className="text-xs">Setor</Label><Input name="setor" required className="mt-1 h-8 text-sm bg-surface-1 border-border" /></div>
                <div><Label className="text-xs">Subsetor</Label><Input name="subsetor" className="mt-1 h-8 text-sm bg-surface-1 border-border" /></div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select name="tipo" className="mt-1 w-full h-8 text-sm rounded-md bg-surface-1 border border-border px-2 text-foreground">
                    <option value="Aberta">Aberta</option>
                    <option value="Fechada">Fechada</option>
                  </select>
                </div>
                <div><Label className="text-xs">País</Label><Input name="pais" defaultValue="Brasil" className="mt-1 h-8 text-sm bg-surface-1 border-border" /></div>
                <div>
                  <Label className="text-xs">Analista Principal</Label>
                  <select name="analistaPrincipal" className="mt-1 w-full h-8 text-sm rounded-md bg-surface-1 border border-border px-2 text-foreground">
                    {analistas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Analista Backup</Label>
                  <select name="analistaBackup" className="mt-1 w-full h-8 text-sm rounded-md bg-surface-1 border border-border px-2 text-foreground">
                    {analistas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              </div>
              <div><Label className="text-xs">Descrição</Label><Textarea name="descricao" rows={2} className="mt-1 text-sm bg-surface-1 border-border" /></div>
              <Button type="submit" size="sm" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-surface-1 border-border" />
        </div>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-40 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos os setores</SelectItem>
            {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-32 h-8 text-sm bg-surface-1 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Aberta">Aberta</SelectItem>
            <SelectItem value="Fechada">Fechada</SelectItem>
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
                <TableHead className="text-[11px] h-9">Setor</TableHead>
                <TableHead className="text-[11px] h-9">Tipo</TableHead>
                <TableHead className="text-[11px] h-9">Analista Principal</TableHead>
                <TableHead className="text-[11px] h-9">Backup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id} className="border-border">
                  <TableCell className="text-sm py-2 font-medium">{e.nome}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground font-mono text-xs">{e.cnpj}</TableCell>
                  <TableCell className="text-sm py-2">{e.setor}</TableCell>
                  <TableCell className="text-sm py-2"><Badge variant="outline" className="text-[10px]">{e.tipo}</Badge></TableCell>
                  <TableCell className="text-sm py-2">{getAnalistaNome(e.analistaPrincipal)}</TableCell>
                  <TableCell className="text-sm py-2">{getAnalistaNome(e.analistaBackup)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
