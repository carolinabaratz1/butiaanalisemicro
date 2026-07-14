// Edge function: fidc-rating-alert-check
// Avalia todas as regras ativas em public.fidc_alert_rules contra o histórico mais
// recente de rating_fidc_class_history e grava eventos em fidc_alert_events.
// Pode ser invocada manualmente ou via cron (pg_cron + pg_net).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Rule {
  id: string;
  nome: string;
  isin: string | null;
  class_code: string | null;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  active: boolean;
  last_triggered_at: string | null;
}

interface RatingRow {
  id: string;
  isin: string;
  class_code: string;
  rating_value: string;
  rating_date: string | null;
  created_at: string;
}

// Escala de rating (maior = melhor)
const RATING_SCALE: Record<string, number> = {
  AAA: 22, "AA+": 21, AA: 20, "AA-": 19,
  "A+": 18, A: 17, "A-": 16,
  "BBB+": 15, BBB: 14, "BBB-": 13,
  "BB+": 12, BB: 11, "BB-": 10,
  "B+": 9, B: 8, "B-": 7,
  "CCC+": 6, CCC: 5, "CCC-": 4,
  CC: 3, C: 2, D: 1,
};

function rankRating(r: string | null | undefined): number | null {
  if (!r) return null;
  const clean = r.replace(/\(bra\)|\.br|br/gi, "").trim().toUpperCase();
  return RATING_SCALE[clean] ?? null;
}

function evalCondition(
  condition: Record<string, any>,
  latest: RatingRow,
  previous: RatingRow | null,
): { triggered: boolean; message: string } {
  const type = String(condition.type ?? "");
  if (type === "rating_below") {
    const thr = String(condition.threshold_rating ?? "");
    const rLatest = rankRating(latest.rating_value);
    const rThr = rankRating(thr);
    if (rLatest != null && rThr != null && rLatest < rThr) {
      return { triggered: true, message: `Rating atual ${latest.rating_value} abaixo do limite ${thr}` };
    }
  } else if (type === "rating_downgrade") {
    if (previous) {
      const a = rankRating(latest.rating_value);
      const b = rankRating(previous.rating_value);
      if (a != null && b != null && a < b) {
        return { triggered: true, message: `Downgrade: ${previous.rating_value} → ${latest.rating_value}` };
      }
    }
  } else if (type === "rating_change") {
    if (previous && previous.rating_value !== latest.rating_value) {
      return { triggered: true, message: `Alteração: ${previous.rating_value} → ${latest.rating_value}` };
    }
  }
  return { triggered: false, message: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rules, error: rErr } = await supabase
      .from("fidc_alert_rules")
      .select("*")
      .eq("active", true);
    if (rErr) throw rErr;

    let triggered = 0;
    let evaluated = 0;

    for (const rule of (rules ?? []) as Rule[]) {
      evaluated++;
      // Busca as duas últimas linhas de rating para o par (isin, class_code)
      let query = supabase
        .from("rating_fidc_class_history")
        .select("id, isin, class_code, rating_value, rating_date, created_at")
        .order("rating_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(2);
      if (rule.isin) query = query.eq("isin", rule.isin);
      if (rule.class_code) query = query.eq("class_code", rule.class_code);

      const { data: history, error: hErr } = await query;
      if (hErr || !history || history.length === 0) continue;

      const latest = history[0] as RatingRow;
      const previous = (history[1] ?? null) as RatingRow | null;

      // Deduplicação por rating_date
      if (rule.last_triggered_at && latest.rating_date && new Date(rule.last_triggered_at) >= new Date(latest.rating_date)) {
        continue;
      }

      const { triggered: t, message } = evalCondition(rule.condition, latest, previous);
      if (!t) continue;

      await supabase.from("fidc_alert_events").insert({
        rule_id: rule.id,
        isin: latest.isin,
        class_code: latest.class_code,
        message,
        severity: String((rule.action as any)?.severity ?? "warning"),
        payload: {
          rule_name: rule.nome,
          condition: rule.condition,
          latest: { rating: latest.rating_value, date: latest.rating_date },
          previous: previous ? { rating: previous.rating_value, date: previous.rating_date } : null,
        },
      });

      await supabase
        .from("fidc_alert_rules")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", rule.id);

      triggered++;
    }

    return new Response(JSON.stringify({ evaluated, triggered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
