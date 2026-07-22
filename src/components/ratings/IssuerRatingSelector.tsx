import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface IssuerOption {
  cnpj: string;
  nome: string;
  grupo_economico: string | null;
}

interface Props {
  value: string | null;
  onChange: (opt: IssuerOption | null) => void;
}

export function IssuerRatingSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["issuerSelector"],
    queryFn: async (): Promise<IssuerOption[]> => {
      const { data, error } = await supabase
        .from("empresas")
        .select("cnpj, nome, grupo_economico")
        .not("cnpj", "is", null)
        .order("nome")
        .range(0, 4999);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        cnpj: (e.cnpj ?? "").replace(/[^0-9]/g, ""),
        nome: e.nome ?? "",
        grupo_economico: e.grupo_economico ?? null,
      })).filter((e) => e.cnpj.length === 14);
    },
    staleTime: 5 * 60 * 1000,
  });

  const selected = useMemo(() => options.find((o) => o.cnpj === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options.slice(0, 100);
    return options
      .filter((o) => o.nome.toLowerCase().includes(needle) || o.cnpj.includes(needle.replace(/[^0-9]/g, "")))
      .slice(0, 100);
  }, [options, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-9">
          <span className="flex items-center gap-2 min-w-0 truncate">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            {selected ? (
              <span className="truncate">{selected.nome}</span>
            ) : (
              <span className="text-muted-foreground">Selecione um emissor…</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome ou CNPJ…" value={q} onValueChange={setQ} />
          <CommandList>
            {isLoading && <CommandEmpty>Carregando…</CommandEmpty>}
            {!isLoading && filtered.length === 0 && <CommandEmpty>Nenhum emissor encontrado.</CommandEmpty>}
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem
                  key={o.cnpj}
                  value={o.cnpj}
                  onSelect={() => {
                    onChange(o.cnpj === value ? null : o);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn("h-4 w-4", value === o.cnpj ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{o.nome}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {o.cnpj}
                      {o.grupo_economico ? ` · ${o.grupo_economico}` : ""}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
