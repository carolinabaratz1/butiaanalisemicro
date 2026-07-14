import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Play, Pencil, Trash2, Zap, TestTube } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/fidc/PageHeader";

type ConditionType = "rating_below" | "rating_downgrade" | "rating_change";

interface AlertRule {
  id: string;
  nome: string;
  descricao: string | null;
  isin: string | null;
  class_code: string | null;
  condition: any;
  action: any;
  active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

interface AlertEvent {
  id: string;
  rule_id: string | null;
  isin: string | null;
  class_code: string | null;
  triggered_at: string;
  message: string | null;
  severity: string;
  payload: any;
}

const RATING_ORDER = ["AAA","AA+","AA","AA-","A+","A","A-","BBB+","BBB","BBB-","BB+","BB","BB-","B+","B","B-","CCC+","CCC","CCC-","CC","C","D"];
const RATING_SCALE: Record<string, number> = Object.fromEntries(
  RATING_ORDER.map((r, i) => [r, RATING_ORDER.length - i]),
);

function rankRating(r: string | null | undefined): number | null {
  if (!r) return null;
  const clean = r.replace(/\(bra\)|\.br|br/gi, "").trim().toUpperCase();
  return RATING_SCALE[clean] ?? null;
}

function conditionLabel(c: any): string {
  const t = c?.type;
  if (t === "rating_below") return `Rating < ${c.threshold_rating ?? "?"}`;
  if (t === "rating_downgrade") return "Downgrade (rating piorou)";
  if (t === "rating_change") return "Qualquer alteração de rating";
  return "—";
}

function sevBadge(sev: string) {
  const color =
    sev === "critical" ? "destructive" :
    sev === "warning" ? "default" :
    "secondary";
  return <Badge variant={color as any}>{sev}</Badge>;
}

export default function AlertasEnginePage() {
  const { permissions } = useAuth();
  const canWrite = permissions.canWrite;

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);

  async function load() {
    setLoading(true);
    const [rulesRes, evRes] = await Promise.all([
      (supabase.from as any)("fidc_alert_rules").select("*").order("created_at", { ascending: false }),
      (supabase.from as any)("fidc_alert_events").select("*").order("triggered_at", { ascending: false }).limit(200),
    ]);
    setRules(rulesRes.data ?? []);
    setEvents(evRes.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runEngine() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("fidc-rating-alert-check", { body: {} });
      if (error) throw error;
      toast({ title: "Engine executado", description: `Regras avaliadas: ${data?.evaluated ?? 0} • Disparos: ${data?.triggered ?? 0}` });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao executar engine", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  async function toggleActive(rule: AlertRule) {
    if (!canWrite) return;
    await (supabase.from as any)("fidc_alert_rules").update({ active: !rule.active }).eq("id", rule.id);
    load();
  }
  async function removeRule(rule: AlertRule) {
    if (!canWrite) return;
    if (!confirm(`Excluir a regra "${rule.nome}"?`)) return;
    await (supabase.from as any)("fidc_alert_rules").delete().eq("id", rule.id);
    load();
  }

  const chart30d = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      buckets.set(d, 0);
    }
    for (const e of events) {
      const d = e.triggered_at.slice(0, 10);
      if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
    }
    return Array.from(buckets, ([data, count]) => ({ data: data.slice(5), count }));
  }, [events]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Alertas Engine"
        subtitle="Regras automáticas sobre ratings de FIDC (rating_fidc_class_history)."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSimOpen(true)}>
              <TestTube className="h-4 w-4 mr-1" /> Simular
            </Button>
            <Button size="sm" onClick={runEngine} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Rodar engine agora
            </Button>
            {canWrite && (
              <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova regra
              </Button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Regras ativas</div>
          <div className="text-2xl font-semibold">{rules.filter(r => r.active).length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Regras totais</div>
          <div className="text-2xl font-semibold">{rules.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Eventos 30d</div>
          <div className="text-2xl font-semibold">{chart30d.reduce((a, b) => a + b.count, 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Último disparo</div>
          <div className="text-sm font-medium">
            {events[0]?.triggered_at ? new Date(events[0].triggered_at).toLocaleString("pt-BR") : "—"}
          </div>
        </Card>
      </div>

      {/* Gráfico */}
      <Card className="p-4">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" /> Frequência de eventos (30 dias)
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={chart30d}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="data" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Regras */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium">Regras</div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma regra cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Escopo</th>
                <th className="px-4 py-2 text-left">Condição</th>
                <th className="px-4 py-2 text-left">Sev.</th>
                <th className="px-4 py-2 text-left">Ativa</th>
                <th className="px-4 py-2 text-left">Último disparo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{r.nome}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.isin ? <div>ISIN: <code>{r.isin}</code></div> : <div className="text-muted-foreground">Todos ISINs</div>}
                    {r.class_code && <div>Classe: <code>{r.class_code}</code></div>}
                  </td>
                  <td className="px-4 py-2 text-xs">{conditionLabel(r.condition)}</td>
                  <td className="px-4 py-2">{sevBadge(String(r.action?.severity ?? "warning"))}</td>
                  <td className="px-4 py-2">
                    <Switch checked={r.active} disabled={!canWrite} onCheckedChange={() => toggleActive(r)} />
                  </td>
                  <td className="px-4 py-2 text-xs">{r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {canWrite && (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeRule(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Eventos */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium">Histórico de eventos (últimos 200)</div>
        {events.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum evento ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Regra</th>
                <th className="px-4 py-2 text-left">ISIN / Classe</th>
                <th className="px-4 py-2 text-left">Mensagem</th>
                <th className="px-4 py-2 text-left">Sev.</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => {
                const rule = rules.find(r => r.id === e.rule_id);
                return (
                  <tr key={e.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(e.triggered_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2">{rule?.nome ?? <span className="text-muted-foreground">— removida —</span>}</td>
                    <td className="px-4 py-2 text-xs">
                      <div><code>{e.isin ?? "—"}</code></div>
                      {e.class_code && <div className="text-muted-foreground">{e.class_code}</div>}
                    </td>
                    <td className="px-4 py-2 text-xs">{e.message ?? "—"}</td>
                    <td className="px-4 py-2">{sevBadge(e.severity)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editing}
        onSaved={load}
      />
      <SimulatorDialog open={simOpen} onOpenChange={setSimOpen} />
    </div>
  );
}

function RuleDialog({
  open, onOpenChange, rule, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; rule: AlertRule | null; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isin, setIsin] = useState("");
  const [classCode, setClassCode] = useState("");
  const [type, setType] = useState<ConditionType>("rating_below");
  const [thr, setThr] = useState("BBB");
  const [severity, setSeverity] = useState("warning");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(rule?.nome ?? "");
      setDescricao(rule?.descricao ?? "");
      setIsin(rule?.isin ?? "");
      setClassCode(rule?.class_code ?? "");
      setType((rule?.condition?.type as ConditionType) ?? "rating_below");
      setThr(rule?.condition?.threshold_rating ?? "BBB");
      setSeverity(String(rule?.action?.severity ?? "warning"));
      setActive(rule?.active ?? true);
    }
  }, [open, rule]);

  async function save() {
    if (!nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const condition: any = { type };
    if (type === "rating_below") condition.threshold_rating = thr;
    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      isin: isin.trim() || null,
      class_code: classCode.trim() || null,
      condition,
      action: { severity },
      active,
    };
    const q = rule
      ? (supabase.from as any)("fidc_alert_rules").update(payload).eq("id", rule.id)
      : (supabase.from as any)("fidc_alert_rules").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: rule ? "Regra atualizada" : "Regra criada" });
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{rule ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ISIN (opcional)</Label>
              <Input value={isin} onChange={e => setIsin(e.target.value)} placeholder="qualquer" />
            </div>
            <div>
              <Label>Class code (opcional)</Label>
              <Input value={classCode} onChange={e => setClassCode(e.target.value)} placeholder="qualquer" />
            </div>
          </div>
          <div>
            <Label>Condição</Label>
            <Select value={type} onValueChange={v => setType(v as ConditionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rating_below">Rating abaixo de X</SelectItem>
                <SelectItem value="rating_downgrade">Downgrade</SelectItem>
                <SelectItem value="rating_change">Qualquer alteração</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "rating_below" && (
            <div>
              <Label>Rating mínimo</Label>
              <Select value={thr} onValueChange={setThr}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RATING_ORDER.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Severidade</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">info</SelectItem>
                <SelectItem value="warning">warning</SelectItem>
                <SelectItem value="critical">critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Regra ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SimulatorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [type, setType] = useState<ConditionType>("rating_below");
  const [thr, setThr] = useState("BBB");
  const [ratingAtual, setRatingAtual] = useState("BB");
  const [ratingAnterior, setRatingAnterior] = useState("AAA");
  const [result, setResult] = useState<{ triggered: boolean; message: string } | null>(null);

  function simulate() {
    let r: { triggered: boolean; message: string } = { triggered: false, message: "Não dispara" };
    if (type === "rating_below") {
      const a = rankRating(ratingAtual), b = rankRating(thr);
      if (a != null && b != null && a < b) r = { triggered: true, message: `${ratingAtual} < ${thr}` };
    } else if (type === "rating_downgrade") {
      const a = rankRating(ratingAtual), b = rankRating(ratingAnterior);
      if (a != null && b != null && a < b) r = { triggered: true, message: `Downgrade ${ratingAnterior} → ${ratingAtual}` };
    } else if (type === "rating_change") {
      if (ratingAtual !== ratingAnterior) r = { triggered: true, message: `Mudou ${ratingAnterior} → ${ratingAtual}` };
    }
    setResult(r);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Simulador de regra</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Condição</Label>
            <Select value={type} onValueChange={v => setType(v as ConditionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rating_below">Rating abaixo de X</SelectItem>
                <SelectItem value="rating_downgrade">Downgrade</SelectItem>
                <SelectItem value="rating_change">Qualquer alteração</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "rating_below" && (
            <div>
              <Label>Rating mínimo</Label>
              <Select value={thr} onValueChange={setThr}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RATING_ORDER.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rating atual</Label>
              <Select value={ratingAtual} onValueChange={setRatingAtual}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RATING_ORDER.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating anterior</Label>
              <Select value={ratingAnterior} onValueChange={setRatingAnterior}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RATING_ORDER.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={simulate} className="w-full">Simular</Button>
          {result && (
            <div className={`p-3 rounded-md text-sm ${result.triggered ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
              {result.triggered ? "🚨 " : "✅ "}{result.message}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
