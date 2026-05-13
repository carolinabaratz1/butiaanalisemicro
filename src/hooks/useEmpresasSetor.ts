// Carrega o catálogo de empresas (cnpj → setor/nome/grupo) uma vez e cacheia.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmpresaInfo {
  cnpj: string;
  nome: string;
  setor: string | null;
  grupo_economico: string | null;
}

let cache: Map<string, EmpresaInfo> | null = null;
let inflight: Promise<Map<string, EmpresaInfo>> | null = null;

async function loadAll(): Promise<Map<string, EmpresaInfo>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const map = new Map<string, EmpresaInfo>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("empresas")
        .select("cnpj, nome, setor, grupo_economico")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const r of data ?? []) {
        map.set(r.cnpj, {
          cnpj: r.cnpj,
          nome: r.nome,
          setor: r.setor,
          grupo_economico: r.grupo_economico,
        });
      }
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    cache = map;
    inflight = null;
    return map;
  })();
  return inflight;
}

export function useEmpresasSetor() {
  const [byCnpj, setByCnpj] = useState<Map<string, EmpresaInfo>>(cache ?? new Map());
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadAll()
      .then((m) => {
        if (!cancelled) {
          setByCnpj(m);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { byCnpj, loading };
}
