// Persiste informes selecionados (vindos do /cvm-fidc-import) em:
//  - fidc_monthly_reports
//  - fidc_monthly_quota_classes
//  - fidc_monthly_segments
// com source='cvm_open_data' e versionamento replace/new_version.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type Flows = {
  subscription_value?: number; subscription_quota_quantity?: number;
  redemption_value?: number; redemption_quota_quantity?: number;
  requested_redemption_value?: number; requested_redemption_quota_quantity?: number;
  amortization_value?: number; amortization_quota_quantity?: number;
};
type ClassItem = {
  name: string; type?: string;
  pl?: number | null; quotaValue?: number | null; numberOfQuotas?: number | null;
  monthlyYieldPct?: number | null;
  rawQuotaQuantity?: string; rawQuotaValue?: string; rawMonthlyReturn?: string;
  parseStatus?: string; idSubclasse?: string;
  investorsCount?: number | null;
  flows?: Flows; netFlow?: number; grossFlow?: number;
};
type SegmentItem = { code: string; name: string; level: number; parent?: string; value: number };
type FlowsTotal = {
  totalSubscriptionValue?: number; totalRedemptionValue?: number;
  totalRequestedRedemptionValue?: number; totalAmortizationValue?: number;
  netInvestorFlowValue?: number; grossInvestorFlowValue?: number;
};
type Item = {
  fidcId: string; cnpj: string; referenceMonth: string;
  mode: "replace" | "new_version";
  // Núcleo
  pl: number | null; avgNav?: number | null;
  totalAssets?: number | null; totalLiabilities?: number | null;
  creditRights: number | null; creditRightsGross?: number | null;
  caixaAmpliado: number | null; cashStrict?: number | null;
  pdd: number | null;
  // Atrasos
  overdueTotal: number | null;
  overdue30: number | null; overdue60: number | null; overdue90: number | null; overdue120: number | null;
  overdueExistingCreditRightsValue?: number | null;
  defaultedCreditRightsValue?: number | null;
  overdueInstallmentsValue?: number | null;
  overdueValueTabI?: number | null;
  overdueValueTabVVi?: number | null;
  overdueSource?: string | null;
  overdueBucketCoverageStatus?: string | null;
  delinquencyUnbucketedValue?: number | null;
  overdueToCreditRightsRatio?: number | null;
  pddToOverdueRatio?: number | null;
  // Prazo de vencimento (TAB V.a + VI.a) — K1/K2
  maturityTotal?: number | null;
  maturity30?: number | null; maturity60?: number | null; maturity90?: number | null;
  maturity120?: number | null; maturity150?: number | null; maturity180?: number | null;
  maturity360?: number | null; maturity720?: number | null;
  maturity1080?: number | null; maturity1080p?: number | null;
  // Garantias (TAB X.7) — K1/K2
  guarantees?: number | null;
  guaranteesPct?: number | null;
  // Aquisições / negócios
  repurchase: number | null;
  acquisitionWithRisk?: number | null; acquisitionWithoutRisk?: number | null;
  substitution?: number | null; prepaid?: number | null;
  // Cotistas
  investors: number | null;
  // Segmento principal
  mainSegment?: string | null; mainSegmentValue?: number | null; mainSegmentPct?: number | null;
  segmentTotal?: number | null; segmentValidationStatus?: string | null;
  // Validação
  classes: ClassItem[]; sumClassesPL: number;
  plDiff: number | null; plDiffPct: number | null;
  status: string;
  // Subordinação por senioridade + limites
  subordination?: {
    seniorNav: number; mezzNav: number; subNav: number; uniqueNav: number; unknownNav: number;
    seniorPct: number | null; mezzPct: number | null; subPct: number | null;
    seniorRatio: number | null; mezzRatio: number | null;
    seniorLimit: number | null; mezzLimit: number | null;
    seniorExcess: number | null; mezzExcess: number | null;
    seniorStatus: string; mezzStatus: string; qualityFlag: string | null;
    quotaSum: number; navDiff: number | null; navDiffPct: number | null;
    validation: "ok" | "alert" | "critical";
  } | null;
  // Coleções
  segments?: SegmentItem[];
  flows?: FlowsTotal;
};
type Body = { referenceMonth: string; sourceUrl: string; fileHash: string; items: Item[] };

const mapValidation = (s: string) =>
  s === "validacao_critica" ? "invalid"
  : s === "cotas_ausentes" ? "quota_data_missing"
  : "valid";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    const { data: canWrite, error: roleErr } = await userClient.rpc("fidc_can_write", { _user_id: userId });
    if (roleErr || !canWrite) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json()) as Body;
    const results: Array<{ fidcId: string; cnpj: string; ok: boolean; reportId?: string; error?: string }> = [];

    for (const it of body.items) {
      try {
        const { data: existing } = await admin
          .from("fidc_monthly_reports")
          .select("id, version, is_current_version")
          .eq("fidc_id", it.fidcId).eq("reference_month", it.referenceMonth);

        const flows = it.flows ?? {};
        const segBreakdown = (it.segments ?? []).map((s) => ({
          code: s.code, name: s.name, level: s.level, parent: s.parent ?? null,
          value: s.value, pct: it.segmentTotal && it.segmentTotal > 0 ? s.value / it.segmentTotal : null,
        }));

        const baseRow: Record<string, unknown> = {
          fidc_id: it.fidcId,
          reference_month: it.referenceMonth,
          nav_value: it.pl,
          avg_nav_value: it.avgNav ?? null,
          total_assets: it.totalAssets ?? null,
          total_liabilities: it.totalLiabilities ?? null,
          credit_rights_value: it.creditRights,
          credit_rights_gross_value: it.creditRightsGross ?? null,
          cash_value: it.caixaAmpliado,
          cash_strict_value: it.cashStrict ?? null,
          pdd_value: it.pdd,
          overdue_value: it.overdueTotal,
          overdue_30d_value: it.overdue30, overdue_60d_value: it.overdue60,
          overdue_90d_value: it.overdue90, overdue_120d_value: it.overdue120,
          delinquency_30_plus_value: it.overdue30,
          delinquency_60_plus_value: it.overdue60,
          delinquency_90_plus_value: it.overdue90,
          delinquency_120_plus_value: it.overdue120,
          overdue_existing_credit_rights_value: it.overdueExistingCreditRightsValue ?? null,
          defaulted_credit_rights_value: it.defaultedCreditRightsValue ?? null,
          overdue_installments_value: it.overdueInstallmentsValue ?? null,
          overdue_value_tab_i: it.overdueValueTabI ?? null,
          overdue_value_tab_v_vi: it.overdueValueTabVVi ?? null,
          overdue_source: it.overdueSource ?? null,
          overdue_bucket_coverage_status: it.overdueBucketCoverageStatus ?? null,
          delinquency_unbucketed_value: it.delinquencyUnbucketedValue ?? null,
          overdue_to_credit_rights_ratio: it.overdueToCreditRightsRatio ?? null,
          pdd_to_overdue_ratio: it.pddToOverdueRatio ?? null,
          // Prazo de vencimento (TAB V.a + VI.a) — K1/K2
          maturity_total_value: it.maturityTotal ?? null,
          maturity_30_value: it.maturity30 ?? null,
          maturity_60_value: it.maturity60 ?? null,
          maturity_90_value: it.maturity90 ?? null,
          maturity_120_value: it.maturity120 ?? null,
          maturity_150_value: it.maturity150 ?? null,
          maturity_180_value: it.maturity180 ?? null,
          maturity_360_value: it.maturity360 ?? null,
          maturity_720_value: it.maturity720 ?? null,
          maturity_1080_value: it.maturity1080 ?? null,
          maturity_over_1080_value: it.maturity1080p ?? null,
          // Garantias (TAB X.7) — K1/K2
          guarantees_value: it.guarantees ?? null,
          guarantees_pct: it.guaranteesPct ?? null,
          repurchase_value: it.repurchase,
          acquisition_with_risk_value: it.acquisitionWithRisk ?? null,
          acquisition_without_risk_value: it.acquisitionWithoutRisk ?? null,
          substitution_value: it.substitution ?? null,
          prepaid_value: it.prepaid ?? null,
          investors_count: it.investors,
          // Segmento principal
          main_segment: it.mainSegment ?? null,
          main_segment_value: it.mainSegmentValue ?? null,
          main_segment_pct: it.mainSegmentPct ?? null,
          segment_portfolio_value: it.segmentTotal ?? null,
          segment_validation_status: it.segmentValidationStatus ?? null,
          segment_breakdown: segBreakdown.length ? segBreakdown : null,
          // Fluxos consolidados
          total_subscription_value: flows.totalSubscriptionValue ?? null,
          total_redemption_value: flows.totalRedemptionValue ?? null,
          total_requested_redemption_value: flows.totalRequestedRedemptionValue ?? null,
          total_amortization_value: flows.totalAmortizationValue ?? null,
          net_investor_flow_value: flows.netInvestorFlowValue ?? null,
          gross_investor_flow_value: flows.grossInvestorFlowValue ?? null,
          // Validação
          quota_total_nav_value: it.sumClassesPL,
          quota_validation_difference: it.plDiff,
          quota_validation_difference_percentage: it.plDiffPct,
          quota_validation_status: mapValidation(it.status),
          quota_classes_found_count: it.classes.length,
          subordinated_calculation_status: it.subordination
            ? (it.subordination.validation === "critical" ? "inconsistent_quota_validation"
              : (it.subordination.mezzNav > 0 ? "calculated_with_mezzanine" : "calculated"))
            : (it.classes.length > 1 ? "calculated" : "single_class"),
          // Subordinação por senioridade
          senior_nav_value: it.subordination?.seniorNav ?? null,
          senior_nav_pct: it.subordination?.seniorPct ?? null,
          mezzanine_nav_value: it.subordination?.mezzNav ?? null,
          mezzanine_nav_pct: it.subordination?.mezzPct ?? null,
          subordinated_nav_value: it.subordination?.subNav ?? null,
          subordinated_nav_pct: it.subordination?.subPct ?? null,
          unique_nav_value: it.subordination?.uniqueNav ?? null,
          unknown_quota_nav_value: it.subordination?.unknownNav ?? null,
          senior_subordination_ratio: it.subordination?.seniorRatio ?? null,
          mezzanine_subordination_ratio: it.subordination?.mezzRatio ?? null,
          senior_subordination_limit: it.subordination?.seniorLimit ?? null,
          mezzanine_subordination_limit: it.subordination?.mezzLimit ?? null,
          senior_subordination_excess: it.subordination?.seniorExcess ?? null,
          mezzanine_subordination_excess: it.subordination?.mezzExcess ?? null,
          senior_subordination_status: it.subordination?.seniorStatus ?? null,
          mezzanine_subordination_status: it.subordination?.mezzStatus ?? null,
          senior_subordination_status_quality: it.subordination?.qualityFlag ?? null,
          quota_classes_nav_sum: it.subordination?.quotaSum ?? it.sumClassesPL,
          quota_classes_nav_diff: it.subordination?.navDiff ?? it.plDiff,
          quota_classes_nav_diff_pct: it.subordination?.navDiffPct ?? it.plDiffPct,
          raw_data: {
            source: "cvm_open_data", url: body.sourceUrl,
            classes: it.classes, segments: it.segments ?? [], flows, status: it.status,
          } as Record<string, unknown>,
          source: "cvm_open_data",
          source_url: body.sourceUrl,
          file_hash: body.fileHash,
          imported_at: new Date().toISOString(),
          imported_by: userId,
          is_current_version: true,
        };

        let reportId: string;
        if (existing && existing.length && it.mode === "replace") {
          const current = existing.find((e) => e.is_current_version) ?? existing[0];
          const { error } = await admin.from("fidc_monthly_reports").update(baseRow).eq("id", current.id);
          if (error) throw error;
          reportId = current.id;
          await admin.from("fidc_monthly_quota_classes").delete().eq("fidc_monthly_report_id", reportId);
          await admin.from("fidc_monthly_segments").delete()
            .eq("fidc_id", it.fidcId).eq("reference_month", it.referenceMonth);
        } else {
          if (existing && existing.length) {
            await admin.from("fidc_monthly_reports")
              .update({ is_current_version: false })
              .eq("fidc_id", it.fidcId).eq("reference_month", it.referenceMonth);
          }
          const nextVersion = (existing?.reduce((m, e) => Math.max(m, e.version ?? 1), 0) ?? 0) + 1;
          const { data: inserted, error } = await admin.from("fidc_monthly_reports")
            .insert({ ...baseRow, version: nextVersion }).select("id").single();
          if (error) throw error;
          reportId = inserted.id;
        }

        // Cotas
        if (it.classes.length) {
          const officialPL = it.pl && it.pl > 0 ? it.pl : null;
          const rows = it.classes.map((c) => {
            const f = c.flows ?? {};
            const yieldPct = c.monthlyYieldPct ?? null;
            const navQ = c.pl ?? null;
            return {
              fidc_monthly_report_id: reportId,
              cnpj_fundo_classe: it.cnpj,
              reference_month: it.referenceMonth,
              class_name: c.name,
              class_series_name: c.name,
              quota_type: c.type ?? null,
              id_subclasse: c.idSubclasse ?? null,
              nav_value: navQ,
              quota_nav_value: navQ,
              nav_pct: officialPL != null && navQ != null ? navQ / officialPL : null,
              quota_value: c.quotaValue ?? null,
              number_of_quotas: c.numberOfQuotas ?? null,
              raw_quota_quantity: c.rawQuotaQuantity ?? null,
              raw_quota_value: c.rawQuotaValue ?? null,
              parse_status: c.parseStatus ?? "ok",
              monthly_yield_pct: yieldPct,
              monthly_return_pct: yieldPct,
              monthly_return_decimal: yieldPct != null ? yieldPct / 100 : null,
              raw_monthly_return: c.rawMonthlyReturn ?? null,
              investors_count: c.investorsCount ?? null,
              subscription_value: f.subscription_value ?? null,
              subscription_quota_quantity: f.subscription_quota_quantity ?? null,
              redemption_value: f.redemption_value ?? null,
              redemption_quota_quantity: f.redemption_quota_quantity ?? null,
              requested_redemption_value: f.requested_redemption_value ?? null,
              requested_redemption_quota_quantity: f.requested_redemption_quota_quantity ?? null,
              amortization_value: f.amortization_value ?? null,
              amortization_quota_quantity: f.amortization_quota_quantity ?? null,
              net_quota_flow_value: c.netFlow ?? null,
              gross_quota_flow_value: c.grossFlow ?? null,
              matching_status: "cvm_import",
              source: "cvm_open_data",
            };
          });
          const { error } = await admin.from("fidc_monthly_quota_classes").insert(rows);
          if (error) throw error;
        }


        // Segmentos
        if (it.segments && it.segments.length) {
          const segRows = it.segments.map((s) => ({
            fidc_id: it.fidcId,
            cnpj_fundo_classe: it.cnpj,
            reference_month: it.referenceMonth,
            segment_group: s.level === 1 ? s.name : (s.parent ?? null),
            segment_name: s.name,
            segment_code: s.code,
            segment_level: s.level,
            parent_segment: s.parent ?? null,
            value: s.value,
            pct_of_segment_portfolio: it.segmentTotal && it.segmentTotal > 0 ? s.value / it.segmentTotal : null,
            source: "cvm_open_data",
            source_file: `inf_mensal_fidc_tab_II_${it.referenceMonth.slice(0, 7).replace("-", "")}.csv`,
          }));
          const { error } = await admin.from("fidc_monthly_segments").insert(segRows);
          if (error) throw error;
        }

        results.push({ fidcId: it.fidcId, cnpj: it.cnpj, ok: true, reportId });
      } catch (e) {
        results.push({ fidcId: it.fidcId, cnpj: it.cnpj, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ ok: true, total: results.length, success: okCount, failed: results.length - okCount, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
