-- =====================================================================
-- Full schema replication for external Supabase project
-- Source: Lovable Cloud backend  |  Idempotent
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ENUMs
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='app_role') THEN CREATE TYPE public.app_role AS ENUM ('Gestor', 'Analista', 'Risco e Compliance', 'Consulta', 'Coordenação/Especialista'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='fidc_alert_severity') THEN CREATE TYPE public.fidc_alert_severity AS ENUM ('normal', 'warning', 'critical'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='fidc_alert_status') THEN CREATE TYPE public.fidc_alert_status AS ENUM ('new', 'in_analysis', 'resolved'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='fidc_recommendation') THEN CREATE TYPE public.fidc_recommendation AS ENUM ('manter', 'acompanhar', 'reduzir', 'zerar'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='fidc_threshold_direction') THEN CREATE TYPE public.fidc_threshold_direction AS ENUM ('above_is_worse', 'below_is_worse'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='fidc_threshold_scope') THEN CREATE TYPE public.fidc_threshold_scope AS ENUM ('global', 'per_fidc', 'per_portfolio'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='fidc_validation_status') THEN CREATE TYPE public.fidc_validation_status AS ENUM ('valid', 'warning', 'invalid', 'cotas_ausentes'); END IF; END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------------------------------------------------------------------
-- SEQUENCES (must come before tables that reference them)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.trade_ntnb_id_seq        AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.trade_taxas_id_seq       AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.trade_upload_log_id_seq  AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- ---------------------------------------------------------------------
-- TABLES (columns + PK)
-- ---------------------------------------------------------------------


CREATE TABLE IF NOT EXISTS public."alert_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "metric_name" text NOT NULL,
  "display_name" text NOT NULL,
  "warning_threshold" numeric(20,6),
  "critical_threshold" numeric(20,6),
  "direction" public.fidc_threshold_direction NOT NULL,
  "scope" public.fidc_threshold_scope DEFAULT 'global'::fidc_threshold_scope NOT NULL,
  "fidc_id" uuid,
  "portfolio_source" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_id" uuid NOT NULL,
  "portfolio_source" text,
  "reference_month" date,
  "metric_name" text NOT NULL,
  "current_value" numeric(20,6),
  "threshold_value" numeric(20,6),
  "severity" public.fidc_alert_severity NOT NULL,
  "status" public.fidc_alert_status DEFAULT 'new'::fidc_alert_status NOT NULL,
  "comment" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."allocation_limits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fundo" text NOT NULL,
  "categoria" text NOT NULL,
  "subcategoria" text NOT NULL,
  "limite_pct" numeric(6,2),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."allocation_target_periods" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fundo" text NOT NULL,
  "nome" text NOT NULL,
  "data_inicio" date DEFAULT CURRENT_DATE NOT NULL,
  "data_fim" date,
  "ativo" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."allocation_targets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fundo" text NOT NULL,
  "tipo_ativo" text NOT NULL,
  "target_pct" numeric(6,2),
  "updated_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "period_id" uuid,
  "limite_pct" numeric(6,2),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."allocation_targets_emissor" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "period_id" uuid NOT NULL,
  "fundo" text NOT NULL,
  "cnpj_emissor" text NOT NULL,
  "target_pct" numeric,
  "updated_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."allocation_targets_setor" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "period_id" uuid NOT NULL,
  "fundo" text NOT NULL,
  "setor" text NOT NULL,
  "target_pct" numeric(6,2),
  "limite_pct" numeric(6,2),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "updated_by" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."analises" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" text NOT NULL,
  "tipo" text DEFAULT 'Geral'::text,
  "analista_responsavel" text NOT NULL,
  "analista_secundario" text,
  "data_inicio" text NOT NULL,
  "data_conclusao" text,
  "status" text NOT NULL,
  "decisao" text,
  "conviccao" text,
  "riscos" text DEFAULT ''::text,
  "gatilhos" text DEFAULT ''::text,
  "justificativa" text DEFAULT ''::text,
  "versao" integer DEFAULT 1 NOT NULL,
  "aprovado_por" text,
  "data_aprovacao" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "isin" text DEFAULT ''::text,
  "prazo" text,
  "observacoes" text DEFAULT ''::text,
  "relatorio" text DEFAULT ''::text,
  "solicitante_id" text DEFAULT ''::text,
  "recomendacao" text,
  "preco_min" numeric,
  "preco_medio" numeric,
  "preco_maximo" numeric,
  "data_alvo" text,
  "justificativa_rejeicao" text,
  "data_comite" text,
  "link_analise" text,
  "recomendacao_rf" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."assembleia_participacoes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "assembleia_id" uuid NOT NULL,
  "isin" text,
  "fundo" text NOT NULL,
  "voto" text,
  "representante" text,
  "observacoes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."assembleia_upload_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "filename" text,
  "total_linhas" integer,
  "novas" integer,
  "duplicadas" integer,
  "com_posicao" integer,
  "sem_posicao" integer,
  "pendente_vinculo" integer,
  "uploaded_at" timestamptz DEFAULT now() NOT NULL,
  "uploaded_by" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."assembleias" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "cnpj_empresa" text,
  "isin" text,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "descricao" text,
  "data_evento" date NOT NULL,
  "hora_evento" time without time zone,
  "data_limite_voto" date,
  "modalidade" text,
  "local_link" text,
  "status" text DEFAULT 'Agendado'::text NOT NULL,
  "voto_butia" text,
  "justificativa_voto" text,
  "resultado" text,
  "quorum_atingido" boolean,
  "observacoes" text,
  "responsavel_id" text,
  "documentos" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ticker" text,
  "url_b3" text,
  "data_assembleia" date,
  "origem" text DEFAULT 'manual'::text,
  "cnpj_emissor" text,
  "triagem" text DEFAULT 'sem_posicao'::text,
  "isins_vinculados" text[] DEFAULT ARRAY[]::text[],
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."credit_opinions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_id" uuid NOT NULL,
  "reference_month" date NOT NULL,
  "recommendation" public.fidc_recommendation NOT NULL,
  "summary" text,
  "recommendation_reason" text,
  "positive_points" text,
  "attention_points" text,
  "main_risks" text,
  "recent_evolution" text,
  "author_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."cvm_data_dictionary" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "table_name" text NOT NULL,
  "column_name" text NOT NULL,
  "description" text,
  "expected_type" text,
  "source_meta_file" text,
  "loaded_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."cvm_fidc_field_mapping" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "metric_name" text NOT NULL,
  "source_file_pattern" text NOT NULL,
  "source_column" text,
  "transformation" text,
  "composite_rule" text,
  "is_required" boolean DEFAULT false NOT NULL,
  "fallback_rule" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."cvm_monthly_import_staging" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "reference_month" date NOT NULL,
  "cnpj" text NOT NULL,
  "fidc_id" uuid,
  "raw_rows_by_file" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "extracted_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "extraction_status" text DEFAULT 'pending'::text NOT NULL,
  "missing_metrics" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "validation_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_url" text,
  "imported_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."emissoes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "isin" text NOT NULL,
  "ticker" text,
  "cnpj_emissor" text NOT NULL,
  "val_date" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "fidc_classe" text,
  "fidc_tipo" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."empresas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  "cnpj" text NOT NULL,
  "setor" text,
  "rating" text,
  "status" text DEFAULT 'Ativo'::text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "tipo" text DEFAULT 'CORPORATIVO'::text,
  "grupo_economico" text,
  "codigo_emissor" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_alert_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" uuid,
  "isin" text,
  "class_code" text,
  "triggered_at" timestamptz DEFAULT now() NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "message" text,
  "severity" text DEFAULT 'info'::text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_alert_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  "descricao" text,
  "isin" text,
  "class_code" text,
  "condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "action" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "last_triggered_at" timestamptz,
  "criado_por" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_classes" (
  "isin" text NOT NULL,
  "classe" text NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("isin")
);

CREATE TABLE IF NOT EXISTS public."fidc_monthly_quota_classes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_monthly_report_id" uuid NOT NULL,
  "fidc_quota_class_id" uuid,
  "isin" text,
  "class_name" text,
  "quota_type" text,
  "nav_value" numeric(20,2),
  "quota_value" numeric(20,8),
  "number_of_quotas" numeric(20,4),
  "seniority_level" integer,
  "rating" text,
  "matching_status" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "monthly_yield_pct" numeric,
  "subscription_value" numeric,
  "redemption_value" numeric,
  "amortization_value" numeric,
  "source" text DEFAULT 'manual_upload'::text NOT NULL,
  "cnpj_fundo_classe" text,
  "reference_month" date,
  "id_subclasse" text,
  "monthly_return_pct" numeric,
  "monthly_return_decimal" numeric,
  "raw_monthly_return" text,
  "return_source_file" text,
  "raw_quota_quantity" text,
  "raw_quota_value" text,
  "parse_status" text,
  "subscription_quota_quantity" numeric,
  "redemption_quota_quantity" numeric,
  "requested_redemption_value" numeric,
  "requested_redemption_quota_quantity" numeric,
  "amortization_quota_quantity" numeric,
  "net_quota_flow_value" numeric,
  "gross_quota_flow_value" numeric,
  "quota_flow_source_file" text,
  "investors_count" integer,
  "investors_source_file" text,
  "class_series_name" text,
  "quota_nav_value" numeric,
  "nav_pct" numeric,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_monthly_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_id" uuid NOT NULL,
  "reference_month" date NOT NULL,
  "nav_value" numeric(20,2),
  "quota_total_nav_value" numeric(20,2),
  "quota_validation_status" public.fidc_validation_status,
  "quota_validation_difference" numeric(20,2),
  "quota_validation_difference_percentage" numeric(8,4),
  "quota_value" numeric(20,8),
  "credit_rights_value" numeric(20,2),
  "overdue_value" numeric(20,2),
  "pdd_value" numeric(20,2),
  "cash_value" numeric(20,2),
  "repurchase_value" numeric(20,2),
  "subordinated_value" numeric(20,2),
  "investors_count" integer,
  "raw_data" jsonb,
  "version" integer DEFAULT 1 NOT NULL,
  "is_current_version" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "quota_classes_found_count" integer,
  "subordinated_calculation_status" text,
  "subordinated_calculation_notes" text,
  "source_file_name" text,
  "imported_by" uuid,
  "overdue_30d_value" numeric,
  "overdue_60d_value" numeric,
  "overdue_90d_value" numeric,
  "overdue_120d_value" numeric,
  "acquisitions_value" numeric,
  "substitutions_value" numeric,
  "disposals_value" numeric,
  "guarantees_value" numeric,
  "guarantees_pct_dc" numeric,
  "scr_status" text,
  "scr_value" numeric,
  "segment_breakdown" jsonb,
  "maturity_breakdown" jsonb,
  "overdue_breakdown" jsonb,
  "assignors_breakdown" jsonb,
  "source" text DEFAULT 'manual_upload'::text NOT NULL,
  "source_url" text,
  "file_hash" text,
  "imported_at" timestamptz DEFAULT now() NOT NULL,
  "total_assets" numeric,
  "total_liabilities" numeric,
  "payables_value" numeric,
  "avg_nav_value" numeric,
  "cash_strict_value" numeric,
  "portfolio_book_value" numeric,
  "credit_rights_with_risk_transfer" numeric,
  "credit_rights_without_risk_transfer" numeric,
  "credit_rights_gross_value" numeric,
  "prepaid_value" numeric,
  "segment_portfolio_value" numeric,
  "main_segment" text,
  "main_segment_value" numeric,
  "main_segment_pct" numeric,
  "segment_validation_status" text,
  "maturity_0_30_value" numeric,
  "maturity_31_60_value" numeric,
  "maturity_61_90_value" numeric,
  "maturity_91_120_value" numeric,
  "maturity_121_150_value" numeric,
  "maturity_151_180_value" numeric,
  "maturity_181_360_value" numeric,
  "maturity_361_720_value" numeric,
  "maturity_721_1080_value" numeric,
  "maturity_over_1080_value" numeric,
  "delinquency_0_30_value" numeric,
  "delinquency_31_60_value" numeric,
  "delinquency_61_90_value" numeric,
  "delinquency_91_120_value" numeric,
  "delinquency_121_150_value" numeric,
  "delinquency_151_180_value" numeric,
  "delinquency_181_360_value" numeric,
  "delinquency_361_720_value" numeric,
  "delinquency_721_1080_value" numeric,
  "delinquency_over_1080_value" numeric,
  "delinquency_30_plus_value" numeric,
  "delinquency_60_plus_value" numeric,
  "delinquency_90_plus_value" numeric,
  "delinquency_120_plus_value" numeric,
  "acquisition_with_risk_value" numeric,
  "acquisition_without_risk_value" numeric,
  "acquisition_value" numeric,
  "sale_value" numeric,
  "substitution_value" numeric,
  "total_subscription_value" numeric,
  "total_redemption_value" numeric,
  "total_requested_redemption_value" numeric,
  "total_amortization_value" numeric,
  "net_investor_flow_value" numeric,
  "gross_investor_flow_value" numeric,
  "overdue_existing_credit_rights_value" numeric,
  "defaulted_credit_rights_value" numeric,
  "overdue_installments_value" numeric,
  "overdue_value_tab_i" numeric,
  "overdue_value_tab_v_vi" numeric,
  "overdue_source" text,
  "overdue_bucket_coverage_status" text,
  "delinquency_unbucketed_value" numeric,
  "overdue_to_credit_rights_ratio" numeric,
  "pdd_to_overdue_ratio" numeric,
  "senior_nav_value" numeric,
  "senior_nav_pct" numeric,
  "mezzanine_nav_value" numeric,
  "mezzanine_nav_pct" numeric,
  "subordinated_nav_value" numeric,
  "subordinated_nav_pct" numeric,
  "unique_nav_value" numeric,
  "unknown_quota_nav_value" numeric,
  "senior_subordination_ratio" numeric,
  "mezzanine_subordination_ratio" numeric,
  "senior_subordination_limit" numeric,
  "mezzanine_subordination_limit" numeric,
  "senior_subordination_excess" numeric,
  "mezzanine_subordination_excess" numeric,
  "senior_subordination_status" text,
  "mezzanine_subordination_status" text,
  "senior_subordination_status_quality" text,
  "quota_classes_nav_sum" numeric,
  "quota_classes_nav_diff" numeric,
  "quota_classes_nav_diff_pct" numeric,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_monthly_segments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_id" uuid,
  "cnpj_fundo_classe" text NOT NULL,
  "reference_month" date NOT NULL,
  "segment_group" text NOT NULL,
  "segment_name" text NOT NULL,
  "segment_code" text,
  "segment_level" integer DEFAULT 1 NOT NULL,
  "parent_segment" text,
  "value" numeric,
  "pct_of_segment_portfolio" numeric,
  "source" text DEFAULT 'cvm_open_data'::text NOT NULL,
  "source_file" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_quota_classes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_id" uuid NOT NULL,
  "isin" text NOT NULL,
  "internal_quota_name" text,
  "cvm_quota_name" text,
  "class_name" text,
  "series_name" text,
  "quota_type" text,
  "seniority_level" integer,
  "benchmark" text,
  "target_spread" text,
  "remuneration_description" text,
  "amortization_type" text,
  "current_rating" text,
  "current_rating_agency" text,
  "current_rating_date" date,
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_rating_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_id" uuid NOT NULL,
  "fidc_quota_class_id" uuid,
  "rating_agency" text,
  "rating" text,
  "rating_outlook" text,
  "rating_date" date,
  "report_date" date,
  "report_url" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidc_subordination_limits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fidc_id" uuid NOT NULL,
  "cnpj_fundo_classe" text,
  "senior_min_subordination_pct" numeric,
  "mezzanine_min_subordination_pct" numeric,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "source" text DEFAULT 'manual'::text NOT NULL,
  "regulation_reference" text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fidcs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "legal_name" text,
  "cnpj" text NOT NULL,
  "administrator" text,
  "manager" text,
  "custodian" text,
  "specialized_consultant" text,
  "auditor" text,
  "collection_agent" text,
  "main_originator" text,
  "main_assignor" text,
  "sector" text,
  "strategy" text,
  "fidc_type" text,
  "condominium_type" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "start_date" date,
  "maturity_date" date,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."issuer_limits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cnpj_emissor" text NOT NULL,
  "grupo_economico" text,
  "limit_value" numeric,
  "limit_pct_nav" numeric,
  "limit_type" text DEFAULT 'valor'::text NOT NULL,
  "effective_from" date,
  "effective_to" date,
  "approved_by" text,
  "committee_date" date,
  "source" text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."issuer_ratings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cnpj" text NOT NULL,
  "rating" text NOT NULL,
  "agencia" text,
  "data_rating" date,
  "outlook" text,
  "observacao" text,
  "report_url" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."mfa_reset_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "target_user_id" uuid NOT NULL,
  "target_user_email" text,
  "target_user_nome" text,
  "performed_by" uuid NOT NULL,
  "performed_by_email" text,
  "performed_by_nome" text,
  "factors_removed" integer DEFAULT 0 NOT NULL,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."pipeline_eventos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "analise_id" uuid NOT NULL,
  "user_id" uuid,
  "acao" text NOT NULL,
  "etapa_anterior" text,
  "etapa_nova" text,
  "comentario" text,
  "data_comite" date,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."posicoes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "trading_desk_share_source" text NOT NULL,
  "val_date" text NOT NULL,
  "product_class" text NOT NULL,
  "product" text NOT NULL,
  "amount" numeric DEFAULT 0 NOT NULL,
  "isin" text,
  "financial_price" numeric,
  "duration_du" numeric,
  "yield" numeric,
  "implied_spread" numeric,
  "dv01" numeric,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."profiles" (
  "id" uuid NOT NULL,
  "nome" text NOT NULL,
  "email" text NOT NULL,
  "funcao" text DEFAULT 'Consulta'::text NOT NULL,
  "status" text DEFAULT 'Ativo'::text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "must_change_password" boolean DEFAULT true NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."rating_emission_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "isin" text NOT NULL,
  "cnpj_emissor" text,
  "rating_value" text NOT NULL,
  "rating_date" date,
  "source" text,
  "outlook" text,
  "observacao" text,
  "report_url" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."rating_fidc_class_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "isin" text NOT NULL,
  "class_code" text NOT NULL,
  "rating_value" text NOT NULL,
  "rating_date" date,
  "source" text,
  "outlook" text,
  "observacao" text,
  "report_url" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."rating_issuer_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cnpj" text NOT NULL,
  "rating_value" text NOT NULL,
  "rating_date" date,
  "source" text,
  "outlook" text,
  "observacao" text,
  "report_url" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."setores" (
  "nome" text NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("nome")
);

CREATE TABLE IF NOT EXISTS public."trade_ativos" (
  "ticker" text NOT NULL,
  "nome_completo" text,
  "emissor_nome" text,
  "emissor_cnpj" text,
  "venc_date" date,
  "anos_venc" numeric(6,2),
  "indexador" text,
  "taxa_emissao" text,
  "spread_emissao" numeric(8,4),
  "rating" text,
  "data_rating" date,
  "updated_at" timestamptz DEFAULT now(),
  "sub_indexador" text,
  PRIMARY KEY ("ticker")
);

CREATE TABLE IF NOT EXISTS public."trade_ipca_ref" (
  "ticker" text NOT NULL,
  "emissao" text,
  "ntnb_ref" text NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("ticker")
);

CREATE TABLE IF NOT EXISTS public."trade_metricas" (
  "ticker" text NOT NULL,
  "indexador" text,
  "last_date" date,
  "last_val" numeric(12,6),
  "last_qtd" numeric(18,4),
  "last_vol_fin" numeric(20,4),
  "pu_curva" numeric(14,6),
  "pu_indicativo" numeric(14,6),
  "pu_ratio" numeric(10,6),
  "avg_5d" numeric(12,6),
  "avg_10d" numeric(12,6),
  "avg_21d" numeric(12,6),
  "avg_30d" numeric(12,6),
  "avg_90d" numeric(12,6),
  "std_90d" numeric(12,6),
  "z_score" numeric(10,4),
  "z_score_5d" numeric(10,4),
  "z_score_10d" numeric(10,4),
  "z_score_21d" numeric(10,4),
  "change_bps" numeric(10,2),
  "total_qtd" numeric(20,4),
  "total_vol_fin" numeric(20,4),
  "ntnb_ref" text,
  "ntnb_taxa" numeric(12,6),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("ticker")
);

CREATE TABLE IF NOT EXISTS public."trade_ntnb" (
  "id" bigint DEFAULT nextval('trade_ntnb_id_seq'::regclass) NOT NULL,
  "bond_name" text NOT NULL,
  "data" date NOT NULL,
  "taxa_indicativa" numeric(12,8),
  "pu_indicativo" numeric(14,6),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."trade_spread_agg_diario" (
  "data" date NOT NULL,
  "grupo" text NOT NULL,
  "spread_mediano" numeric,
  "spread_p25" numeric,
  "spread_p75" numeric,
  "n_ativos" integer,
  PRIMARY KEY ("data", "grupo")
);

CREATE TABLE IF NOT EXISTS public."trade_spread_historico" (
  "ticker" text NOT NULL,
  "data" date NOT NULL,
  "spread" numeric,
  "pu_curva" numeric,
  "pu_indicativo" numeric,
  "indexador" text,
  "rating" text,
  PRIMARY KEY ("ticker", "data")
);

CREATE TABLE IF NOT EXISTS public."trade_taxas" (
  "id" bigint DEFAULT nextval('trade_taxas_id_seq'::regclass) NOT NULL,
  "ticker" text NOT NULL,
  "data" date NOT NULL,
  "taxa_indicativa" numeric(12,8),
  "qtd_negociada" numeric(18,4),
  "pu_curva" numeric(14,6),
  "pu_indicativo" numeric(14,6),
  "vol_financeiro" numeric(20,4),
  "created_at" timestamptz DEFAULT now(),
  "duration_du" numeric,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."trade_ticker_snapshot" (
  "ticker" text NOT NULL,
  "payload" jsonb NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("ticker")
);

CREATE TABLE IF NOT EXISTS public."trade_upload_log" (
  "id" bigint DEFAULT nextval('trade_upload_log_id_seq'::regclass) NOT NULL,
  "filename" text NOT NULL,
  "uploaded_by" uuid,
  "data_inicio" date,
  "data_fim" date,
  "ativos_di" integer,
  "ativos_ipca" integer,
  "linhas_inseridas" integer,
  "linhas_atualizadas" integer,
  "status" text DEFAULT 'processing'::text,
  "erro_msg" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."user_roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" public.app_role NOT NULL,
  PRIMARY KEY ("id")
);

-- CONSTRAINTS (unique, fk, check)
ALTER TABLE public."allocation_limits" DROP CONSTRAINT IF EXISTS "allocation_limits_fundo_categoria_subcategoria_key" CASCADE;
ALTER TABLE public."allocation_limits" ADD CONSTRAINT "allocation_limits_fundo_categoria_subcategoria_key" UNIQUE (fundo, categoria, subcategoria);
ALTER TABLE public."allocation_targets" DROP CONSTRAINT IF EXISTS "allocation_targets_period_fundo_tipo_key" CASCADE;
ALTER TABLE public."allocation_targets" ADD CONSTRAINT "allocation_targets_period_fundo_tipo_key" UNIQUE (period_id, fundo, tipo_ativo);
ALTER TABLE public."allocation_targets_emissor" DROP CONSTRAINT IF EXISTS "allocation_targets_emissor_period_id_fundo_cnpj_emissor_key" CASCADE;
ALTER TABLE public."allocation_targets_emissor" ADD CONSTRAINT "allocation_targets_emissor_period_id_fundo_cnpj_emissor_key" UNIQUE (period_id, fundo, cnpj_emissor);
ALTER TABLE public."allocation_targets_setor" DROP CONSTRAINT IF EXISTS "allocation_targets_setor_period_id_fundo_setor_key" CASCADE;
ALTER TABLE public."allocation_targets_setor" ADD CONSTRAINT "allocation_targets_setor_period_id_fundo_setor_key" UNIQUE (period_id, fundo, setor);
ALTER TABLE public."credit_opinions" DROP CONSTRAINT IF EXISTS "credit_opinions_fidc_month_uniq" CASCADE;
ALTER TABLE public."credit_opinions" ADD CONSTRAINT "credit_opinions_fidc_month_uniq" UNIQUE (fidc_id, reference_month);
ALTER TABLE public."cvm_data_dictionary" DROP CONSTRAINT IF EXISTS "cvm_data_dictionary_table_name_column_name_key" CASCADE;
ALTER TABLE public."cvm_data_dictionary" ADD CONSTRAINT "cvm_data_dictionary_table_name_column_name_key" UNIQUE (table_name, column_name);
ALTER TABLE public."cvm_fidc_field_mapping" DROP CONSTRAINT IF EXISTS "cvm_fidc_field_mapping_metric_name_key" CASCADE;
ALTER TABLE public."cvm_fidc_field_mapping" ADD CONSTRAINT "cvm_fidc_field_mapping_metric_name_key" UNIQUE (metric_name);
ALTER TABLE public."cvm_monthly_import_staging" DROP CONSTRAINT IF EXISTS "cvm_monthly_import_staging_reference_month_cnpj_key" CASCADE;
ALTER TABLE public."cvm_monthly_import_staging" ADD CONSTRAINT "cvm_monthly_import_staging_reference_month_cnpj_key" UNIQUE (reference_month, cnpj);
ALTER TABLE public."emissoes" DROP CONSTRAINT IF EXISTS "emissoes_isin_key" CASCADE;
ALTER TABLE public."emissoes" ADD CONSTRAINT "emissoes_isin_key" UNIQUE (isin);
ALTER TABLE public."empresas" DROP CONSTRAINT IF EXISTS "empresas_cnpj_key" CASCADE;
ALTER TABLE public."empresas" ADD CONSTRAINT "empresas_cnpj_key" UNIQUE (cnpj);
ALTER TABLE public."fidc_quota_classes" DROP CONSTRAINT IF EXISTS "fidc_quota_classes_isin_key" CASCADE;
ALTER TABLE public."fidc_quota_classes" ADD CONSTRAINT "fidc_quota_classes_isin_key" UNIQUE (isin);
ALTER TABLE public."fidcs" DROP CONSTRAINT IF EXISTS "fidcs_cnpj_key" CASCADE;
ALTER TABLE public."fidcs" ADD CONSTRAINT "fidcs_cnpj_key" UNIQUE (cnpj);
ALTER TABLE public."issuer_ratings" DROP CONSTRAINT IF EXISTS "issuer_ratings_unique" CASCADE;
ALTER TABLE public."issuer_ratings" ADD CONSTRAINT "issuer_ratings_unique" UNIQUE NULLS NOT DISTINCT (cnpj, agencia, data_rating);
ALTER TABLE public."trade_ntnb" DROP CONSTRAINT IF EXISTS "trade_ntnb_bond_name_data_key" CASCADE;
ALTER TABLE public."trade_ntnb" ADD CONSTRAINT "trade_ntnb_bond_name_data_key" UNIQUE (bond_name, data);
ALTER TABLE public."trade_taxas" DROP CONSTRAINT IF EXISTS "trade_taxas_ticker_data_key" CASCADE;
ALTER TABLE public."trade_taxas" ADD CONSTRAINT "trade_taxas_ticker_data_key" UNIQUE (ticker, data);
ALTER TABLE public."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_user_id_role_key" CASCADE;
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE (user_id, role);
ALTER TABLE public."alert_rules" DROP CONSTRAINT IF EXISTS "alert_rules_created_by_fkey" CASCADE;
ALTER TABLE public."alert_rules" ADD CONSTRAINT "alert_rules_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."alert_rules" DROP CONSTRAINT IF EXISTS "alert_rules_fidc_id_fkey" CASCADE;
ALTER TABLE public."alert_rules" ADD CONSTRAINT "alert_rules_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."alerts" DROP CONSTRAINT IF EXISTS "alerts_fidc_id_fkey" CASCADE;
ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."allocation_targets" DROP CONSTRAINT IF EXISTS "allocation_targets_period_id_fkey" CASCADE;
ALTER TABLE public."allocation_targets" ADD CONSTRAINT "allocation_targets_period_id_fkey" FOREIGN KEY (period_id) REFERENCES allocation_target_periods(id) ON DELETE CASCADE;
ALTER TABLE public."allocation_targets_emissor" DROP CONSTRAINT IF EXISTS "allocation_targets_emissor_period_id_fkey" CASCADE;
ALTER TABLE public."allocation_targets_emissor" ADD CONSTRAINT "allocation_targets_emissor_period_id_fkey" FOREIGN KEY (period_id) REFERENCES allocation_target_periods(id) ON DELETE CASCADE;
ALTER TABLE public."allocation_targets_setor" DROP CONSTRAINT IF EXISTS "allocation_targets_setor_period_id_fkey" CASCADE;
ALTER TABLE public."allocation_targets_setor" ADD CONSTRAINT "allocation_targets_setor_period_id_fkey" FOREIGN KEY (period_id) REFERENCES allocation_target_periods(id) ON DELETE CASCADE;
ALTER TABLE public."assembleia_participacoes" DROP CONSTRAINT IF EXISTS "assembleia_participacoes_assembleia_id_fkey" CASCADE;
ALTER TABLE public."assembleia_participacoes" ADD CONSTRAINT "assembleia_participacoes_assembleia_id_fkey" FOREIGN KEY (assembleia_id) REFERENCES assembleias(id) ON DELETE CASCADE;
ALTER TABLE public."assembleias" DROP CONSTRAINT IF EXISTS "assembleias_cnpj_empresa_fkey" CASCADE;
ALTER TABLE public."assembleias" ADD CONSTRAINT "assembleias_cnpj_empresa_fkey" FOREIGN KEY (cnpj_empresa) REFERENCES empresas(cnpj) ON DELETE CASCADE;
ALTER TABLE public."assembleias" DROP CONSTRAINT IF EXISTS "assembleias_isin_fkey" CASCADE;
ALTER TABLE public."assembleias" ADD CONSTRAINT "assembleias_isin_fkey" FOREIGN KEY (isin) REFERENCES emissoes(isin) ON DELETE CASCADE;
ALTER TABLE public."credit_opinions" DROP CONSTRAINT IF EXISTS "credit_opinions_author_id_fkey" CASCADE;
ALTER TABLE public."credit_opinions" ADD CONSTRAINT "credit_opinions_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."credit_opinions" DROP CONSTRAINT IF EXISTS "credit_opinions_fidc_id_fkey" CASCADE;
ALTER TABLE public."credit_opinions" ADD CONSTRAINT "credit_opinions_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."cvm_monthly_import_staging" DROP CONSTRAINT IF EXISTS "cvm_monthly_import_staging_fidc_id_fkey" CASCADE;
ALTER TABLE public."cvm_monthly_import_staging" ADD CONSTRAINT "cvm_monthly_import_staging_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE SET NULL;
ALTER TABLE public."empresas" DROP CONSTRAINT IF EXISTS "empresas_setor_fkey" CASCADE;
ALTER TABLE public."empresas" ADD CONSTRAINT "empresas_setor_fkey" FOREIGN KEY (setor) REFERENCES setores(nome) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."fidc_alert_events" DROP CONSTRAINT IF EXISTS "fidc_alert_events_rule_id_fkey" CASCADE;
ALTER TABLE public."fidc_alert_events" ADD CONSTRAINT "fidc_alert_events_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES fidc_alert_rules(id) ON DELETE CASCADE;
ALTER TABLE public."fidc_alert_rules" DROP CONSTRAINT IF EXISTS "fidc_alert_rules_criado_por_fkey" CASCADE;
ALTER TABLE public."fidc_alert_rules" ADD CONSTRAINT "fidc_alert_rules_criado_por_fkey" FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."fidc_monthly_quota_classes" DROP CONSTRAINT IF EXISTS "fidc_monthly_quota_classes_fidc_monthly_report_id_fkey" CASCADE;
ALTER TABLE public."fidc_monthly_quota_classes" ADD CONSTRAINT "fidc_monthly_quota_classes_fidc_monthly_report_id_fkey" FOREIGN KEY (fidc_monthly_report_id) REFERENCES fidc_monthly_reports(id) ON DELETE CASCADE;
ALTER TABLE public."fidc_monthly_quota_classes" DROP CONSTRAINT IF EXISTS "fidc_monthly_quota_classes_fidc_quota_class_id_fkey" CASCADE;
ALTER TABLE public."fidc_monthly_quota_classes" ADD CONSTRAINT "fidc_monthly_quota_classes_fidc_quota_class_id_fkey" FOREIGN KEY (fidc_quota_class_id) REFERENCES fidc_quota_classes(id) ON DELETE SET NULL;
ALTER TABLE public."fidc_monthly_reports" DROP CONSTRAINT IF EXISTS "fidc_monthly_reports_fidc_id_fkey" CASCADE;
ALTER TABLE public."fidc_monthly_reports" ADD CONSTRAINT "fidc_monthly_reports_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."fidc_monthly_reports" DROP CONSTRAINT IF EXISTS "fidc_monthly_reports_imported_by_fkey" CASCADE;
ALTER TABLE public."fidc_monthly_reports" ADD CONSTRAINT "fidc_monthly_reports_imported_by_fkey" FOREIGN KEY (imported_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."fidc_monthly_segments" DROP CONSTRAINT IF EXISTS "fidc_monthly_segments_fidc_id_fkey" CASCADE;
ALTER TABLE public."fidc_monthly_segments" ADD CONSTRAINT "fidc_monthly_segments_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."fidc_quota_classes" DROP CONSTRAINT IF EXISTS "fidc_quota_classes_fidc_id_fkey" CASCADE;
ALTER TABLE public."fidc_quota_classes" ADD CONSTRAINT "fidc_quota_classes_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."fidc_rating_history" DROP CONSTRAINT IF EXISTS "fidc_rating_history_fidc_id_fkey" CASCADE;
ALTER TABLE public."fidc_rating_history" ADD CONSTRAINT "fidc_rating_history_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."fidc_rating_history" DROP CONSTRAINT IF EXISTS "fidc_rating_history_fidc_quota_class_id_fkey" CASCADE;
ALTER TABLE public."fidc_rating_history" ADD CONSTRAINT "fidc_rating_history_fidc_quota_class_id_fkey" FOREIGN KEY (fidc_quota_class_id) REFERENCES fidc_quota_classes(id) ON DELETE SET NULL;
ALTER TABLE public."fidc_subordination_limits" DROP CONSTRAINT IF EXISTS "fidc_subordination_limits_fidc_id_fkey" CASCADE;
ALTER TABLE public."fidc_subordination_limits" ADD CONSTRAINT "fidc_subordination_limits_fidc_id_fkey" FOREIGN KEY (fidc_id) REFERENCES fidcs(id) ON DELETE CASCADE;
ALTER TABLE public."pipeline_eventos" DROP CONSTRAINT IF EXISTS "pipeline_eventos_user_id_fkey" CASCADE;
ALTER TABLE public."pipeline_eventos" ADD CONSTRAINT "pipeline_eventos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."profiles" DROP CONSTRAINT IF EXISTS "profiles_id_fkey" CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."trade_upload_log" DROP CONSTRAINT IF EXISTS "trade_upload_log_uploaded_by_fkey" CASCADE;
ALTER TABLE public."trade_upload_log" ADD CONSTRAINT "trade_upload_log_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
ALTER TABLE public."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_user_id_fkey" CASCADE;
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."analises" DROP CONSTRAINT IF EXISTS "analises_conviccao_check" CASCADE;
ALTER TABLE public."analises" ADD CONSTRAINT "analises_conviccao_check" CHECK ((conviccao = ANY (ARRAY['Alta'::text, 'Média'::text, 'Baixa'::text])));
ALTER TABLE public."analises" DROP CONSTRAINT IF EXISTS "analises_decisao_check" CASCADE;
ALTER TABLE public."analises" ADD CONSTRAINT "analises_decisao_check" CHECK ((decisao = ANY (ARRAY['Investir'::text, 'Não investir'::text, 'Monitorar'::text])));
ALTER TABLE public."analises" DROP CONSTRAINT IF EXISTS "analises_recomendacao_rf_check" CASCADE;
ALTER TABLE public."analises" ADD CONSTRAINT "analises_recomendacao_rf_check" CHECK (((recomendacao_rf IS NULL) OR (recomendacao_rf = ANY (ARRAY['Buy'::text, 'Hold'::text, 'Sell'::text]))));
ALTER TABLE public."analises" DROP CONSTRAINT IF EXISTS "analises_status_check" CASCADE;
ALTER TABLE public."analises" ADD CONSTRAINT "analises_status_check" CHECK ((status = ANY (ARRAY['Pendente'::text, 'Em Análise'::text, 'Concluída'::text, 'Aprovada'::text, 'Reprovada'::text, 'Buy'::text, 'Hold'::text, 'Sell'::text, 'Vencida c/ Alocação'::text, 'Vencida s/ Alocação'::text])));
ALTER TABLE public."analises" DROP CONSTRAINT IF EXISTS "analises_tipo_check" CASCADE;
ALTER TABLE public."analises" ADD CONSTRAINT "analises_tipo_check" CHECK ((tipo = ANY (ARRAY['Crédito Privado'::text, 'Ações'::text])));
ALTER TABLE public."assembleia_participacoes" DROP CONSTRAINT IF EXISTS "assembleia_participacoes_voto_check" CASCADE;
ALTER TABLE public."assembleia_participacoes" ADD CONSTRAINT "assembleia_participacoes_voto_check" CHECK ((voto = ANY (ARRAY['A favor'::text, 'Contra'::text, 'Abstenção'::text, 'Não votou'::text])));
ALTER TABLE public."assembleias" DROP CONSTRAINT IF EXISTS "assembleias_modalidade_check" CASCADE;
ALTER TABLE public."assembleias" ADD CONSTRAINT "assembleias_modalidade_check" CHECK ((modalidade = ANY (ARRAY['Presencial'::text, 'Híbrida'::text, 'Digital'::text])));
ALTER TABLE public."assembleias" DROP CONSTRAINT IF EXISTS "assembleias_status_check" CASCADE;
ALTER TABLE public."assembleias" ADD CONSTRAINT "assembleias_status_check" CHECK ((status = ANY (ARRAY['Agendado'::text, 'Realizado'::text, 'Cancelado'::text, 'Adiado'::text])));
ALTER TABLE public."assembleias" DROP CONSTRAINT IF EXISTS "assembleias_tipo_check" CASCADE;
ALTER TABLE public."assembleias" ADD CONSTRAINT "assembleias_tipo_check" CHECK ((tipo = ANY (ARRAY['AGO'::text, 'AGE'::text, 'AGO/E'::text, 'AGDEB'::text, 'Reunião de Debenturistas'::text, 'Assembleia de Cotistas'::text, 'Fato Relevante'::text])));
ALTER TABLE public."assembleias" DROP CONSTRAINT IF EXISTS "assembleias_voto_butia_check" CASCADE;
ALTER TABLE public."assembleias" ADD CONSTRAINT "assembleias_voto_butia_check" CHECK ((voto_butia = ANY (ARRAY['A favor'::text, 'Contra'::text, 'Abstenção'::text, 'Não votou'::text])));
ALTER TABLE public."emissoes" DROP CONSTRAINT IF EXISTS "emissoes_fidc_classe_chk" CASCADE;
ALTER TABLE public."emissoes" ADD CONSTRAINT "emissoes_fidc_classe_chk" CHECK (((fidc_classe IS NULL) OR (fidc_classe = ANY (ARRAY['Sênior'::text, 'Mezanino'::text]))));
ALTER TABLE public."emissoes" DROP CONSTRAINT IF EXISTS "emissoes_fidc_tipo_chk" CASCADE;
ALTER TABLE public."emissoes" ADD CONSTRAINT "emissoes_fidc_tipo_chk" CHECK (((fidc_tipo IS NULL) OR (fidc_tipo = ANY (ARRAY['Padronizado'::text, 'Não Padronizado'::text]))));
ALTER TABLE public."fidc_classes" DROP CONSTRAINT IF EXISTS "fidc_classes_classe_chk" CASCADE;
ALTER TABLE public."fidc_classes" ADD CONSTRAINT "fidc_classes_classe_chk" CHECK ((classe = ANY (ARRAY['Sênior'::text, 'Mezanino'::text, 'NP'::text])));
ALTER TABLE public."trade_ativos" DROP CONSTRAINT IF EXISTS "trade_ativos_indexador_check" CASCADE;
ALTER TABLE public."trade_ativos" ADD CONSTRAINT "trade_ativos_indexador_check" CHECK ((indexador = ANY (ARRAY['DI'::text, 'IPCA'::text, 'PRE'::text, 'OUTRO'::text])));
ALTER TABLE public."trade_upload_log" DROP CONSTRAINT IF EXISTS "trade_upload_log_status_check" CASCADE;
ALTER TABLE public."trade_upload_log" ADD CONSTRAINT "trade_upload_log_status_check" CHECK ((status = ANY (ARRAY['processing'::text, 'success'::text, 'error'::text])));

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_alerts_fidc_month ON public.alerts USING btree (fidc_id, reference_month);
CREATE UNIQUE INDEX IF NOT EXISTS allocation_limits_fundo_categoria_subcategoria_key ON public.allocation_limits USING btree (fundo, categoria, subcategoria);
CREATE UNIQUE INDEX IF NOT EXISTS uq_target_period_active ON public.allocation_target_periods USING btree (fundo) WHERE ativo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_alloc_targets_period_fundo_tipo ON public.allocation_targets USING btree (period_id, fundo, tipo_ativo);
CREATE UNIQUE INDEX IF NOT EXISTS allocation_targets_period_fundo_tipo_key ON public.allocation_targets USING btree (period_id, fundo, tipo_ativo);
CREATE UNIQUE INDEX IF NOT EXISTS allocation_targets_emissor_period_id_fundo_cnpj_emissor_key ON public.allocation_targets_emissor USING btree (period_id, fundo, cnpj_emissor);
CREATE UNIQUE INDEX IF NOT EXISTS allocation_targets_setor_period_id_fundo_setor_key ON public.allocation_targets_setor USING btree (period_id, fundo, setor);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_analises_empresa_tipo_versao ON public.analises USING btree (empresa_id, tipo, versao);
CREATE INDEX IF NOT EXISTS idx_part_assembleia ON public.assembleia_participacoes USING btree (assembleia_id);
CREATE INDEX IF NOT EXISTS idx_assembleias_cnpj ON public.assembleias USING btree (cnpj_empresa);
CREATE INDEX IF NOT EXISTS idx_assembleias_isin ON public.assembleias USING btree (isin);
CREATE INDEX IF NOT EXISTS idx_assembleias_data ON public.assembleias USING btree (data_evento);
CREATE INDEX IF NOT EXISTS idx_assembleias_status ON public.assembleias USING btree (status);
CREATE INDEX IF NOT EXISTS idx_assembleias_tipo ON public.assembleias USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_assembleias_dedupe ON public.assembleias USING btree (ticker, data_assembleia, tipo, url_b3);
CREATE INDEX IF NOT EXISTS idx_credit_opinions_fidc_month ON public.credit_opinions USING btree (fidc_id, reference_month);
CREATE UNIQUE INDEX IF NOT EXISTS credit_opinions_fidc_month_uniq ON public.credit_opinions USING btree (fidc_id, reference_month);
CREATE UNIQUE INDEX IF NOT EXISTS cvm_data_dictionary_table_name_column_name_key ON public.cvm_data_dictionary USING btree (table_name, column_name);
CREATE UNIQUE INDEX IF NOT EXISTS cvm_fidc_field_mapping_metric_name_key ON public.cvm_fidc_field_mapping USING btree (metric_name);
CREATE UNIQUE INDEX IF NOT EXISTS cvm_monthly_import_staging_reference_month_cnpj_key ON public.cvm_monthly_import_staging USING btree (reference_month, cnpj);
CREATE INDEX IF NOT EXISTS idx_cvm_stg_month ON public.cvm_monthly_import_staging USING btree (reference_month);
CREATE INDEX IF NOT EXISTS idx_cvm_stg_cnpj ON public.cvm_monthly_import_staging USING btree (cnpj);
CREATE INDEX IF NOT EXISTS idx_cvm_stg_status ON public.cvm_monthly_import_staging USING btree (extraction_status);
CREATE UNIQUE INDEX IF NOT EXISTS emissoes_isin_key ON public.emissoes USING btree (isin);
CREATE INDEX IF NOT EXISTS idx_empresas_codigo_emissor ON public.empresas USING btree (codigo_emissor);
CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_key ON public.empresas USING btree (cnpj);
CREATE INDEX IF NOT EXISTS idx_empresas_setor ON public.empresas USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_events_rule ON public.fidc_alert_events USING btree (rule_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_events_triggered ON public.fidc_alert_events USING btree (triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_rules_isin_class ON public.fidc_alert_rules USING btree (isin, class_code);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_rules_active ON public.fidc_alert_rules USING btree (active);
CREATE INDEX IF NOT EXISTS idx_fidc_monthly_quota_classes_cnpj ON public.fidc_monthly_quota_classes USING btree (cnpj_fundo_classe, reference_month);
CREATE INDEX IF NOT EXISTS idx_fidc_reports_fidc_month ON public.fidc_monthly_reports USING btree (fidc_id, reference_month);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fidc_report_current ON public.fidc_monthly_reports USING btree (fidc_id, reference_month) WHERE (is_current_version = true);
CREATE INDEX IF NOT EXISTS fidc_monthly_reports_current_idx ON public.fidc_monthly_reports USING btree (fidc_id, reference_month) WHERE (is_current_version = true);
CREATE INDEX IF NOT EXISTS idx_fidc_monthly_segments_lookup ON public.fidc_monthly_segments USING btree (cnpj_fundo_classe, reference_month, segment_group);
CREATE INDEX IF NOT EXISTS idx_fidc_monthly_segments_fidc ON public.fidc_monthly_segments USING btree (fidc_id, reference_month);
CREATE UNIQUE INDEX IF NOT EXISTS fidc_quota_classes_isin_key ON public.fidc_quota_classes USING btree (isin);
CREATE INDEX IF NOT EXISTS idx_fidc_quota_classes_fidc ON public.fidc_quota_classes USING btree (fidc_id);
CREATE INDEX IF NOT EXISTS idx_fidc_ratings_fidc ON public.fidc_rating_history USING btree (fidc_id);
CREATE INDEX IF NOT EXISTS idx_fidc_sublim_fidc ON public.fidc_subordination_limits USING btree (fidc_id);
CREATE INDEX IF NOT EXISTS idx_fidc_sublim_eff ON public.fidc_subordination_limits USING btree (fidc_id, effective_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fidcs_cnpj_key ON public.fidcs USING btree (cnpj);
CREATE INDEX IF NOT EXISTS idx_issuer_limits_cnpj ON public.issuer_limits USING btree (cnpj_emissor);
CREATE INDEX IF NOT EXISTS idx_issuer_limits_grupo ON public.issuer_limits USING btree (grupo_economico);
CREATE UNIQUE INDEX IF NOT EXISTS issuer_ratings_unique ON public.issuer_ratings USING btree (cnpj, agencia, data_rating) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS issuer_ratings_cnpj_date_idx ON public.issuer_ratings USING btree (cnpj, data_rating DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_eventos_analise ON public.pipeline_eventos USING btree (analise_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_eventos_created ON public.pipeline_eventos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_emission_history_isin_date ON public.rating_emission_history USING btree (isin, rating_date DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_emission_history_cnpj ON public.rating_emission_history USING btree (cnpj_emissor);
CREATE INDEX IF NOT EXISTS idx_rating_fidc_class_history_key_date ON public.rating_fidc_class_history USING btree (isin, class_code, rating_date DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_issuer_history_cnpj_date ON public.rating_issuer_history USING btree (cnpj, rating_date DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_ativos_indexador ON public.trade_ativos USING btree (indexador);
CREATE INDEX IF NOT EXISTS idx_trade_ativos_emissor ON public.trade_ativos USING btree (emissor_cnpj);
CREATE INDEX IF NOT EXISTS idx_trade_metricas_indexador ON public.trade_metricas USING btree (indexador);
CREATE INDEX IF NOT EXISTS idx_trade_metricas_zscore ON public.trade_metricas USING btree (z_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS trade_ntnb_bond_name_data_key ON public.trade_ntnb USING btree (bond_name, data);
CREATE INDEX IF NOT EXISTS idx_trade_ntnb_bond ON public.trade_ntnb USING btree (bond_name, data DESC);
CREATE INDEX IF NOT EXISTS idx_trade_spread_agg_data ON public.trade_spread_agg_diario USING btree (data);
CREATE INDEX IF NOT EXISTS idx_trade_spread_hist_data ON public.trade_spread_historico USING btree (data);
CREATE INDEX IF NOT EXISTS idx_trade_spread_hist_rating ON public.trade_spread_historico USING btree (rating);
CREATE UNIQUE INDEX IF NOT EXISTS trade_taxas_ticker_data_key ON public.trade_taxas USING btree (ticker, data);
CREATE INDEX IF NOT EXISTS idx_trade_taxas_ticker ON public.trade_taxas USING btree (ticker);
CREATE INDEX IF NOT EXISTS idx_trade_taxas_data ON public.trade_taxas USING btree (data DESC);
CREATE INDEX IF NOT EXISTS idx_trade_taxas_ticker_data ON public.trade_taxas USING btree (ticker, data DESC);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);

-- ---------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public."trade_monitor_view" CASCADE;
DROP TABLE IF EXISTS public."trade_monitor_view" CASCADE;
CREATE VIEW public."trade_monitor_view" AS
 SELECT m.ticker,
    m.indexador,
    m.last_date,
    m.last_val,
    m.last_qtd,
    m.last_vol_fin,
    m.pu_curva,
    m.pu_indicativo,
    m.pu_ratio,
    m.avg_5d,
    m.avg_10d,
    m.avg_21d,
    m.avg_30d,
    m.avg_90d,
    m.std_90d,
    m.z_score,
    m.z_score_5d,
    m.z_score_10d,
    m.z_score_21d,
    m.change_bps,
    m.total_qtd,
    m.total_vol_fin,
    m.ntnb_ref,
    m.ntnb_taxa,
    m.updated_at,
    a.nome_completo,
    a.emissor_nome,
    a.emissor_cnpj,
    a.venc_date,
    a.anos_venc,
    a.indexador AS indexador_ativo,
    a.sub_indexador,
    a.taxa_emissao,
    a.spread_emissao,
    a.rating,
    a.data_rating
   FROM trade_metricas m
     LEFT JOIN trade_ativos a ON a.ticker = m.ticker;
GRANT SELECT ON public."trade_monitor_view" TO authenticated;

DROP VIEW IF EXISTS public."profiles_public" CASCADE;
DROP TABLE IF EXISTS public."profiles_public" CASCADE;
CREATE VIEW public."profiles_public" AS
 SELECT id,
    nome,
    funcao,
    status
   FROM profiles;
GRANT SELECT ON public."profiles_public" TO authenticated;

DROP VIEW IF EXISTS public."v_issuer_rating_current" CASCADE;
DROP TABLE IF EXISTS public."v_issuer_rating_current" CASCADE;
CREATE VIEW public."v_issuer_rating_current" AS
 SELECT DISTINCT ON (cnpj) cnpj,
    rating,
    agencia,
    data_rating,
    outlook,
    id AS source_id
   FROM issuer_ratings
  ORDER BY cnpj, data_rating DESC NULLS LAST, created_at DESC;
GRANT SELECT ON public."v_issuer_rating_current" TO authenticated;

-- ---------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------
-- has_role(uuid,app_role)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$
;
-- fidc_can_write(uuid)
CREATE OR REPLACE FUNCTION public.fidc_can_write(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'Gestor'::public.app_role)
      OR public.has_role(_user_id, 'Coordenação/Especialista'::public.app_role)
$function$
;

-- prevent_self_role_escalation()
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If funcao or status is being changed, only allow if caller is Gestor
  IF (NEW.funcao IS DISTINCT FROM OLD.funcao OR NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NOT has_role(auth.uid(), 'Gestor'::app_role) THEN
      NEW.funcao := OLD.funcao;
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

-- fidc_can_write_opinion(uuid)
CREATE OR REPLACE FUNCTION public.fidc_can_write_opinion(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'Gestor'::public.app_role)
      OR public.has_role(_user_id, 'Coordenação/Especialista'::public.app_role)
      OR public.has_role(_user_id, 'Analista'::public.app_role)
$function$
;

-- set_updated_at()
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;


-- handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email, funcao, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'funcao', 'Consulta'),
    true
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'funcao')::app_role, 'Consulta')
  );
  RETURN NEW;
END;
$function$
;

-- get_trade_summary(text,text)
CREATE OR REPLACE FUNCTION public.get_trade_summary(p_indexador text, p_sub_indexador text DEFAULT NULL::text)
 RETURNS TABLE(total_count integer, hot_count integer, median_last_val numeric, median_avg_5d numeric, median_avg_10d numeric, median_avg_21d numeric, median_avg_30d numeric, median_avg_90d numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE v.z_score IS NOT NULL AND ABS(v.z_score) > 2)::INT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.last_val) FILTER (WHERE v.last_val IS NOT NULL AND v.last_val > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_5d)   FILTER (WHERE v.avg_5d   IS NOT NULL AND v.avg_5d   > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_10d)  FILTER (WHERE v.avg_10d  IS NOT NULL AND v.avg_10d  > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_21d)  FILTER (WHERE v.avg_21d  IS NOT NULL AND v.avg_21d  > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_30d)  FILTER (WHERE v.avg_30d  IS NOT NULL AND v.avg_30d  > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_90d)  FILTER (WHERE v.avg_90d  IS NOT NULL AND v.avg_90d  > 0)
  FROM public.trade_monitor_view v
  WHERE v.indexador = p_indexador
    AND (p_sub_indexador IS NULL OR v.sub_indexador = p_sub_indexador);
$function$
;

-- trim_profile_nome()
CREATE OR REPLACE FUNCTION public.trim_profile_nome()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.nome := TRIM(NEW.nome);
  RETURN NEW;
END;
$function$
;

-- recalc_trade_metricas()
CREATE OR REPLACE FUNCTION public.recalc_trade_metricas()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.recalc_trade_metricas_di();
  PERFORM public.recalc_trade_metricas_ipca();
END;
$function$
;

-- refresh_ticker_snapshots()
CREATE OR REPLACE FUNCTION public.refresh_ticker_snapshots()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SET LOCAL statement_timeout = '300s';

  TRUNCATE TABLE trade_ticker_snapshot;

  INSERT INTO trade_ticker_snapshot (ticker, payload, updated_at)
  SELECT
    h.ticker,
    jsonb_build_object(
      'ticker', h.ticker,
      'serie', jsonb_agg(
        jsonb_build_object(
          'data', h.data,
          'spread', h.spread,
          'pu_curva', h.pu_curva,
          'pu_indicativo', h.pu_indicativo
        ) ORDER BY h.data
      ),
      'n_pontos', COUNT(*)::int,
      'rating', MAX(h.rating)
    ),
    NOW()
  FROM trade_spread_historico h
  GROUP BY h.ticker;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

-- get_posicoes_val_dates()
CREATE OR REPLACE FUNCTION public.get_posicoes_val_dates()
 RETURNS TABLE(val_date_text text, val_date_parsed date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    val_date,
    CASE
      WHEN val_date ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(val_date, 'MM/DD/YYYY')
      WHEN val_date ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(val_date, 'YYYY-MM-DD')
      ELSE NULL
    END AS parsed
  FROM posicoes
  WHERE val_date IS NOT NULL AND val_date <> ''
  ORDER BY parsed DESC NULLS LAST;
$function$
;

-- recalc_trade_metricas_ipca()
CREATE OR REPLACE FUNCTION public.recalc_trade_metricas_ipca()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_after_ticker TEXT := NULL;
  v_result RECORD;
BEGIN
  SET LOCAL statement_timeout = '300s';

  LOOP
    SELECT * INTO v_result
    FROM public.recalc_trade_metricas_ipca_batch(v_after_ticker, 100);

    EXIT WHEN COALESCE(v_result.processed_count, 0) = 0
      OR COALESCE(v_result.has_more, FALSE) = FALSE
      OR v_result.next_after_ticker IS NULL;

    v_after_ticker := v_result.next_after_ticker;
  END LOOP;
END;
$function$
;

-- get_active_analysts()
CREATE OR REPLACE FUNCTION public.get_active_analysts()
 RETURNS TABLE(id uuid, nome text, funcao text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, nome, funcao, status
  FROM public.profiles
  WHERE status = 'Ativo'
    AND funcao IN ('Analista', 'Coordenação/Especialista');
$function$
;

-- recalc_trade_metricas_ipca_batch(text,integer)
CREATE OR REPLACE FUNCTION public.recalc_trade_metricas_ipca_batch(p_after_ticker text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(processed_count integer, next_after_ticker text, has_more boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_date DATE;
  v_d5  DATE; v_d10 DATE; v_d21 DATE; v_d30 DATE; v_d90 DATE;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
  v_processed INTEGER := 0;
  v_next_after TEXT := p_after_ticker;
  v_has_more BOOLEAN := FALSE;
BEGIN
  SET LOCAL statement_timeout = '300s';

  SELECT MAX(data) INTO v_last_date FROM trade_taxas;

  IF v_last_date IS NULL THEN
    RETURN QUERY SELECT 0, p_after_ticker, FALSE;
    RETURN;
  END IF;

  SELECT data INTO v_d5  FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 5)  t ORDER BY data LIMIT 1;
  SELECT data INTO v_d10 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 10) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d21 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 21) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d30 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 30) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d90 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 90) t ORDER BY data LIMIT 1;

  DROP TABLE IF EXISTS pg_temp.tmp_ipca_batch;
  CREATE TEMP TABLE tmp_ipca_batch (ticker text PRIMARY KEY) ON COMMIT DROP;

  INSERT INTO tmp_ipca_batch (ticker)
  SELECT DISTINCT ref.ticker
  FROM trade_ipca_ref ref
  JOIN trade_taxas tx ON tx.ticker = ref.ticker
  WHERE p_after_ticker IS NULL OR ref.ticker > p_after_ticker
  ORDER BY ref.ticker
  LIMIT v_limit;

  SELECT COUNT(*), MAX(ticker) INTO v_processed, v_next_after FROM tmp_ipca_batch;

  IF v_processed = 0 THEN
    RETURN QUERY SELECT 0, p_after_ticker, FALSE;
    RETURN;
  END IF;

  INSERT INTO trade_metricas (
    ticker, indexador, last_date, last_val,
    last_qtd, last_vol_fin, pu_curva, pu_indicativo, pu_ratio,
    avg_5d, avg_10d, avg_21d, avg_30d, avg_90d, std_90d,
    z_score, z_score_5d, z_score_10d, z_score_21d,
    change_bps, total_qtd, total_vol_fin,
    ntnb_ref, ntnb_taxa, updated_at
  )
  WITH ipca_spreads AS (
    SELECT tx.ticker, tx.data,
      ((1 + tx.taxa_indicativa) / (1 + nb.taxa_indicativa) - 1) * 100 AS spread,
      tx.qtd_negociada, tx.vol_financeiro, tx.pu_curva, tx.pu_indicativo
    FROM tmp_ipca_batch b
    JOIN trade_taxas tx ON tx.ticker = b.ticker
    JOIN trade_ipca_ref ref ON ref.ticker = tx.ticker
    JOIN trade_ntnb nb ON nb.bond_name = ref.ntnb_ref AND nb.data = tx.data
    WHERE tx.data >= v_d90
  )
  SELECT
    t.ticker, 'IPCA', t.last_date, t.last_val,
    t.last_qtd, t.last_vol_fin, t.pu_curva, t.pu_indicativo,
    CASE WHEN t.pu_curva > 0 THEN t.pu_indicativo / t.pu_curva END,
    w.avg_5d, w.avg_10d, w.avg_21d, w.avg_30d, w.avg_90d, w.std_90d,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_90d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_5d)  / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_10d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_21d) / w.std_90d END,
    (t.last_val - w.first_val) * 100,
    v.total_qtd, v.total_vol_fin,
    ref.ntnb_ref,
    (SELECT taxa_indicativa * 100 FROM trade_ntnb
     WHERE bond_name = ref.ntnb_ref ORDER BY data DESC LIMIT 1),
    NOW()
  FROM (
    SELECT DISTINCT ON (ticker) ticker, data AS last_date,
      spread AS last_val, qtd_negociada AS last_qtd,
      vol_financeiro AS last_vol_fin, pu_curva, pu_indicativo
    FROM ipca_spreads
    WHERE data >= v_last_date - INTERVAL '7 days'
    ORDER BY ticker, data DESC
  ) t
  JOIN trade_ipca_ref ref ON ref.ticker = t.ticker
  JOIN LATERAL (
    SELECT
      AVG(CASE WHEN data >= v_d5  THEN spread END) AS avg_5d,
      AVG(CASE WHEN data >= v_d10 THEN spread END) AS avg_10d,
      AVG(CASE WHEN data >= v_d21 THEN spread END) AS avg_21d,
      AVG(CASE WHEN data >= v_d30 THEN spread END) AS avg_30d,
      AVG(CASE WHEN data >= v_d90 THEN spread END) AS avg_90d,
      STDDEV(CASE WHEN data >= v_d90 THEN spread END) AS std_90d,
      MIN(spread) AS first_val
    FROM ipca_spreads s WHERE s.ticker = t.ticker
  ) w ON true
  JOIN LATERAL (
    SELECT SUM(qtd_negociada) AS total_qtd, SUM(vol_financeiro) AS total_vol_fin
    FROM ipca_spreads s WHERE s.ticker = t.ticker
  ) v ON true
  ON CONFLICT (ticker) DO UPDATE SET
    indexador = EXCLUDED.indexador, last_date = EXCLUDED.last_date,
    last_val = EXCLUDED.last_val, last_qtd = EXCLUDED.last_qtd,
    last_vol_fin = EXCLUDED.last_vol_fin, pu_curva = EXCLUDED.pu_curva,
    pu_indicativo = EXCLUDED.pu_indicativo, pu_ratio = EXCLUDED.pu_ratio,
    avg_5d = EXCLUDED.avg_5d, avg_10d = EXCLUDED.avg_10d,
    avg_21d = EXCLUDED.avg_21d, avg_30d = EXCLUDED.avg_30d,
    avg_90d = EXCLUDED.avg_90d, std_90d = EXCLUDED.std_90d,
    z_score = EXCLUDED.z_score, z_score_5d = EXCLUDED.z_score_5d,
    z_score_10d = EXCLUDED.z_score_10d, z_score_21d = EXCLUDED.z_score_21d,
    change_bps = EXCLUDED.change_bps, total_qtd = EXCLUDED.total_qtd,
    total_vol_fin = EXCLUDED.total_vol_fin, ntnb_ref = EXCLUDED.ntnb_ref,
    ntnb_taxa = EXCLUDED.ntnb_taxa, updated_at = NOW();

  SELECT EXISTS (
    SELECT 1
    FROM trade_ipca_ref ref
    JOIN trade_taxas tx ON tx.ticker = ref.ticker
    WHERE ref.ticker > v_next_after
    LIMIT 1
  ) INTO v_has_more;

  RETURN QUERY SELECT v_processed, v_next_after, v_has_more;
END;
$function$
;

-- get_profile_names()
CREATE OR REPLACE FUNCTION public.get_profile_names()
 RETURNS TABLE(id uuid, nome text, funcao text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, nome, funcao, status FROM public.profiles;
$function$
;

-- tg_set_sub_indexador()
CREATE OR REPLACE FUNCTION public.tg_set_sub_indexador()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.sub_indexador := public.derive_sub_indexador(NEW.indexador, NEW.taxa_emissao);
  RETURN NEW;
END;
$function$
;

-- tg_issuer_ratings_mirror_empresas()
CREATE OR REPLACE FUNCTION public.tg_issuer_ratings_mirror_empresas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_id uuid;
BEGIN
  SELECT source_id INTO v_current_id
  FROM public.v_issuer_rating_current
  WHERE cnpj = NEW.cnpj;

  IF v_current_id = NEW.id THEN
    UPDATE public.empresas SET rating = NEW.rating WHERE cnpj = NEW.cnpj;
  END IF;
  RETURN NEW;
END;
$function$
;

-- tg_issuer_ratings_normalize()
CREATE OR REPLACE FUNCTION public.tg_issuer_ratings_normalize()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cnpj IS NOT NULL THEN
    NEW.cnpj := regexp_replace(NEW.cnpj, '[^0-9]', '', 'g');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

-- get_resolved_rating(text,text)
CREATE OR REPLACE FUNCTION public.get_resolved_rating(p_cnpj text, p_ticker text DEFAULT NULL::text)
 RETURNS TABLE(rating text, source text, agencia text, data_rating date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cnpj text;
  v_rating text;
  v_agencia text;
  v_data date;
  v_grupo text;
BEGIN
  v_cnpj := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');

  IF p_ticker IS NOT NULL AND TRIM(p_ticker) <> '' THEN
    SELECT ta.rating, ta.data_rating INTO v_rating, v_data
    FROM public.trade_ativos ta
    WHERE ta.ticker = p_ticker
      AND ta.rating IS NOT NULL AND ta.rating <> ''
    LIMIT 1;
    IF v_rating IS NOT NULL THEN
      RETURN QUERY SELECT v_rating, 'ticker'::text, NULL::text, v_data;
      RETURN;
    END IF;
  END IF;

  IF v_cnpj <> '' THEN
    SELECT v.rating, v.agencia, v.data_rating
      INTO v_rating, v_agencia, v_data
    FROM public.v_issuer_rating_current v
    WHERE v.cnpj = v_cnpj
    LIMIT 1;
    IF v_rating IS NOT NULL THEN
      RETURN QUERY SELECT v_rating, 'emissor'::text, v_agencia, v_data;
      RETURN;
    END IF;

    SELECT grupo_economico INTO v_grupo
    FROM public.empresas
    WHERE regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g') = v_cnpj
      AND grupo_economico IS NOT NULL AND grupo_economico <> ''
    LIMIT 1;

    IF v_grupo IS NOT NULL THEN
      SELECT vi.rating INTO v_rating
      FROM public.empresas e
      JOIN public.v_issuer_rating_current vi
        ON vi.cnpj = regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g')
      WHERE e.grupo_economico = v_grupo
        AND regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g') <> v_cnpj
      GROUP BY vi.rating
      ORDER BY COUNT(*) DESC, vi.rating ASC
      LIMIT 1;

      IF v_rating IS NOT NULL THEN
        RETURN QUERY SELECT v_rating, 'grupo'::text, NULL::text, NULL::date;
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT NULL::text, 'nr'::text, NULL::text, NULL::date;
END;
$function$
;

-- refresh_spread_agg_diario()
CREATE OR REPLACE FUNCTION public.refresh_spread_agg_diario()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SET LOCAL statement_timeout = '300s';

  TRUNCATE TABLE trade_spread_agg_diario;

  -- Universo (todos os tickers IPCA com spread)
  INSERT INTO trade_spread_agg_diario (data, grupo, spread_mediano, spread_p25, spread_p75, n_ativos)
  SELECT
    data,
    'UNIVERSO',
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY spread),
    COUNT(*)::int
  FROM trade_spread_historico
  WHERE spread IS NOT NULL
  GROUP BY data;

  -- AAA (rating começa com 'AAA' / 'brAAA' / 'AAA(bra)' etc.)
  INSERT INTO trade_spread_agg_diario (data, grupo, spread_mediano, spread_p25, spread_p75, n_ativos)
  SELECT
    data,
    'AAA',
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY spread),
    COUNT(*)::int
  FROM trade_spread_historico
  WHERE spread IS NOT NULL
    AND rating IS NOT NULL
    AND UPPER(rating) ~ 'AAA'
  GROUP BY data;

  SELECT COUNT(*) INTO v_count FROM trade_spread_agg_diario;
  RETURN v_count;
END;
$function$
;

-- apply_forward_fill()
CREATE OR REPLACE FUNCTION public.apply_forward_fill()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  SET LOCAL statement_timeout = '300s';

  -- Identifica tickers elegíveis (>= 90% de preenchimento) em uma temp table
  DROP TABLE IF EXISTS pg_temp.tmp_ff_eligible;
  CREATE TEMP TABLE tmp_ff_eligible (ticker text PRIMARY KEY) ON COMMIT DROP;

  INSERT INTO tmp_ff_eligible (ticker)
  SELECT ticker
  FROM trade_taxas
  GROUP BY ticker
  HAVING COUNT(*) > 0
     AND COUNT(taxa_indicativa)::float / COUNT(*)::float >= 0.9;

  -- Forward fill usando window function (last value not null por ticker, ordenado por data)
  WITH filled AS (
    SELECT
      tx.id,
      tx.ticker,
      tx.data,
      tx.taxa_indicativa,
      (
        SELECT t2.taxa_indicativa
        FROM trade_taxas t2
        WHERE t2.ticker = tx.ticker
          AND t2.data < tx.data
          AND t2.taxa_indicativa IS NOT NULL
        ORDER BY t2.data DESC
        LIMIT 1
      ) AS prev_val
    FROM trade_taxas tx
    JOIN tmp_ff_eligible e ON e.ticker = tx.ticker
    WHERE tx.taxa_indicativa IS NULL
  )
  UPDATE trade_taxas t
  SET taxa_indicativa = f.prev_val
  FROM filled f
  WHERE t.id = f.id
    AND f.prev_val IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$
;

-- get_posicoes_dashboard_fundo(text)
CREATE OR REPLACE FUNCTION public.get_posicoes_dashboard_fundo(p_fundo text)
 RETURNS TABLE(ticker text, isin text, product_class text, financial_price numeric, amount numeric, duration_du numeric, vencimento date, fundo text, rating text, indexador text, sub_indexador text, setor text, grupo_economico text, nome_emissor text, codigo_emissor text, cnpj_emissor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH last_dt AS (
    SELECT MAX(val_date) AS v FROM public.posicoes WHERE trading_desk_share_source = p_fundo
  )
  SELECT
    em.ticker, p.isin, p.product_class,
    p.financial_price, p.amount, p.duration_du,
    ta.venc_date AS vencimento,
    p.trading_desk_share_source AS fundo,
    emp.rating AS rating,
    COALESCE(ta.indexador, 'Outros') AS indexador,
    COALESCE(ta.sub_indexador, 'Outros') AS sub_indexador,
    emp.setor, emp.grupo_economico,
    emp.nome AS nome_emissor, emp.codigo_emissor,
    regexp_replace(COALESCE(em.cnpj_emissor, ''), '[^0-9]', '', 'g') AS cnpj_emissor
  FROM public.posicoes p
  LEFT JOIN public.emissoes em      ON em.isin = p.isin
  LEFT JOIN public.trade_ativos ta  ON ta.ticker = em.ticker
  LEFT JOIN public.empresas emp     ON regexp_replace(COALESCE(emp.cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(em.cnpj_emissor, ''), '[^0-9]', '', 'g')
  WHERE p.trading_desk_share_source = p_fundo
    AND p.financial_price > 0
    AND p.val_date = (SELECT v FROM last_dt);
$function$
;

-- get_ipca_history(date,text,integer,integer)
CREATE OR REPLACE FUNCTION public.get_ipca_history(p_cutoff date DEFAULT (CURRENT_DATE - '90 days'::interval), p_ticker text DEFAULT NULL::text, p_limit integer DEFAULT NULL::integer, p_offset integer DEFAULT 0)
 RETURNS TABLE(ticker text, data date, spread numeric, pu_curva numeric, pu_indicativo numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    tx.ticker,
    tx.data,
    ROUND(((1 + tx.taxa_indicativa) / (1 + nb.taxa_indicativa) - 1) * 100, 6) AS spread,
    tx.pu_curva,
    tx.pu_indicativo
  FROM trade_taxas tx
  JOIN trade_ipca_ref ref ON ref.ticker = tx.ticker
  JOIN trade_ntnb nb      ON nb.bond_name = ref.ntnb_ref AND nb.data = tx.data
  WHERE tx.data >= p_cutoff
    AND (p_ticker IS NULL OR tx.ticker = p_ticker)
  ORDER BY tx.ticker, tx.data
  LIMIT p_limit
  OFFSET p_offset;
$function$
;

-- get_emissores_gestao()
CREATE OR REPLACE FUNCTION public.get_emissores_gestao()
 RETURNS TABLE(cnpj text, cnpj_norm text, nome text, grupo_economico text, setor text, tipo text, rating text, rating_source text, rating_agencia text, rating_data date, analise_id uuid, analise_status text, analise_recomendacao text, analise_data_conclusao date, analise_data_validade date, analise_vencida boolean, analista_id text, exposure_total numeric, funds_count integer, funds_list jsonb, largest_fund text, largest_fund_value numeric, largest_fund_pct numeric, consolidated_pct numeric, limit_value numeric, limit_pct_nav numeric, limit_type text, usage_ratio numeric, limit_status text, alerts jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH pos_parsed AS (
    SELECT
      p.trading_desk_share_source AS fundo,
      p.isin,
      (COALESCE(p.amount,0) * COALESCE(p.financial_price,0))::numeric AS valor,
      CASE
        WHEN p.val_date ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(p.val_date, 'MM/DD/YYYY')
        WHEN p.val_date ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(p.val_date, 'YYYY-MM-DD')
        ELSE NULL
      END AS d
    FROM posicoes p
    WHERE p.financial_price IS NOT NULL AND p.financial_price > 0
      AND p.amount IS NOT NULL AND p.amount > 0
      AND p.trading_desk_share_source IS NOT NULL
      AND p.trading_desk_share_source <> ''
  ),
  last_by_fund AS (
    SELECT fundo, MAX(d) AS last_d
    FROM pos_parsed
    WHERE d IS NOT NULL
    GROUP BY fundo
  ),
  pos_last AS (
    SELECT pp.fundo, pp.isin, pp.valor
    FROM pos_parsed pp
    JOIN last_by_fund lf ON lf.fundo = pp.fundo AND lf.last_d = pp.d
  ),
  fund_pl AS (
    SELECT fundo, SUM(valor) AS pl
    FROM pos_last
    GROUP BY fundo
  ),
  pos_issuer AS (
    SELECT
      regexp_replace(COALESCE(em.cnpj_emissor,''), '[^0-9]', '', 'g') AS cnpj_norm,
      pl.fundo,
      SUM(pl.valor) AS valor
    FROM pos_last pl
    JOIN emissoes em ON em.isin = pl.isin
    WHERE em.cnpj_emissor IS NOT NULL AND em.cnpj_emissor <> ''
    GROUP BY 1, 2
  ),
  issuer_agg AS (
    SELECT
      pi.cnpj_norm,
      SUM(pi.valor) AS exposure_total,
      COUNT(DISTINCT pi.fundo)::int AS funds_count,
      jsonb_agg(jsonb_build_object(
        'fundo', pi.fundo,
        'valor', pi.valor,
        'pct_fund', CASE WHEN fp.pl > 0 THEN pi.valor / fp.pl ELSE NULL END
      ) ORDER BY pi.valor DESC) AS funds_list,
      SUM(fp.pl) AS pl_denominador
    FROM pos_issuer pi
    LEFT JOIN fund_pl fp ON fp.fundo = pi.fundo
    GROUP BY pi.cnpj_norm
  ),
  issuer_top AS (
    SELECT DISTINCT ON (pi.cnpj_norm)
      pi.cnpj_norm,
      pi.fundo AS largest_fund,
      pi.valor AS largest_value,
      CASE WHEN fp.pl > 0 THEN pi.valor / fp.pl ELSE NULL END AS largest_pct
    FROM pos_issuer pi
    LEFT JOIN fund_pl fp ON fp.fundo = pi.fundo
    ORDER BY pi.cnpj_norm, pi.valor DESC
  ),
  isin_sem_emissor AS (
    SELECT COUNT(DISTINCT pl.isin) AS n
    FROM pos_last pl
    LEFT JOIN emissoes em ON em.isin = pl.isin
    WHERE em.cnpj_emissor IS NULL OR em.cnpj_emissor = ''
  ),
  latest_analise AS (
    SELECT DISTINCT ON (regexp_replace(COALESCE(a.empresa_id,''), '[^0-9]', '', 'g'))
      regexp_replace(COALESCE(a.empresa_id,''), '[^0-9]', '', 'g') AS cnpj_norm,
      a.id AS analise_id,
      a.status AS analise_status,
      a.recomendacao AS analise_recomendacao,
      CASE
        WHEN a.data_conclusao ~ '^\d{4}-\d{2}-\d{2}' THEN a.data_conclusao::date
        ELSE NULL
      END AS analise_data_conclusao,
      a.analista_responsavel AS analista_id,
      a.versao
    FROM analises a
    ORDER BY regexp_replace(COALESCE(a.empresa_id,''), '[^0-9]', '', 'g'), a.versao DESC, a.created_at DESC
  ),
  active_limit AS (
    SELECT DISTINCT ON (l.cnpj_emissor)
      l.cnpj_emissor AS cnpj_norm,
      l.limit_value,
      l.limit_pct_nav,
      l.limit_type
    FROM issuer_limits l
    WHERE (l.effective_from IS NULL OR l.effective_from <= CURRENT_DATE)
      AND (l.effective_to IS NULL OR l.effective_to >= CURRENT_DATE)
    ORDER BY l.cnpj_emissor, l.created_at DESC
  ),
  -- Universo = empresas cadastradas UNION CNPJs com exposição mas sem cadastro
  emissores_universo AS (
    SELECT
      e.cnpj,
      regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g') AS cnpj_norm,
      e.nome,
      e.grupo_economico,
      e.setor,
      e.tipo,
      FALSE AS ghost
    FROM empresas e
    UNION
    SELECT
      pi.cnpj_norm AS cnpj,
      pi.cnpj_norm,
      '(Não cadastrado)'::text AS nome,
      NULL::text AS grupo_economico,
      NULL::text AS setor,
      NULL::text AS tipo,
      TRUE AS ghost
    FROM pos_issuer pi
    WHERE NOT EXISTS (
      SELECT 1 FROM empresas e2
      WHERE regexp_replace(COALESCE(e2.cnpj,''), '[^0-9]', '', 'g') = pi.cnpj_norm
    )
  )
  SELECT
    u.cnpj,
    u.cnpj_norm,
    u.nome,
    u.grupo_economico,
    u.setor,
    u.tipo,
    r.rating,
    r.source AS rating_source,
    r.agencia AS rating_agencia,
    r.data_rating AS rating_data,
    la.analise_id,
    la.analise_status,
    la.analise_recomendacao,
    la.analise_data_conclusao,
    CASE
      WHEN la.analise_data_conclusao IS NOT NULL
      THEN (la.analise_data_conclusao + INTERVAL '1 year')::date
      ELSE NULL
    END AS analise_data_validade,
    CASE
      WHEN la.analise_status = 'Vencida c/ Alocação' THEN TRUE
      WHEN la.analise_data_conclusao IS NOT NULL
        AND (la.analise_data_conclusao + INTERVAL '1 year')::date < CURRENT_DATE
        AND la.analise_status NOT IN ('Pendente','Em Análise') THEN TRUE
      ELSE FALSE
    END AS analise_vencida,
    la.analista_id,
    COALESCE(ia.exposure_total, 0) AS exposure_total,
    COALESCE(ia.funds_count, 0) AS funds_count,
    COALESCE(ia.funds_list, '[]'::jsonb) AS funds_list,
    it.largest_fund,
    it.largest_value AS largest_fund_value,
    it.largest_pct AS largest_fund_pct,
    CASE
      WHEN COALESCE(ia.pl_denominador, 0) > 0
      THEN ia.exposure_total / ia.pl_denominador
      ELSE NULL
    END AS consolidated_pct,
    al.limit_value,
    al.limit_pct_nav,
    al.limit_type,
    CASE
      WHEN al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total IS NOT NULL
        THEN ia.exposure_total / al.limit_value
      WHEN al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
        AND COALESCE(ia.pl_denominador,0) > 0 AND ia.exposure_total IS NOT NULL
        THEN (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav
      ELSE NULL
    END AS usage_ratio,
    CASE
      WHEN al.limit_value IS NULL AND al.limit_pct_nav IS NULL THEN 'nao_cadastrado'
      WHEN (
        CASE
          WHEN al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total IS NOT NULL
            THEN ia.exposure_total / al.limit_value
          WHEN al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
            AND COALESCE(ia.pl_denominador,0) > 0 AND ia.exposure_total IS NOT NULL
            THEN (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav
          ELSE 0
        END
      ) > 1 THEN 'acima'
      WHEN (
        CASE
          WHEN al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total IS NOT NULL
            THEN ia.exposure_total / al.limit_value
          WHEN al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
            AND COALESCE(ia.pl_denominador,0) > 0 AND ia.exposure_total IS NOT NULL
            THEN (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav
          ELSE 0
        END
      ) >= 0.8 THEN 'proximo'
      ELSE 'dentro'
    END AS limit_status,
    (
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('type','emissor_nao_cadastrado','severity','high','label','Emissor sem cadastro') AS x
          WHERE u.ghost = TRUE
        UNION ALL
        SELECT jsonb_build_object('type','analise_vencida_posicao','severity','high','label','Análise vencida com posição')
          WHERE COALESCE(ia.exposure_total,0) > 0 AND (
            la.analise_status = 'Vencida c/ Alocação'
            OR (la.analise_data_conclusao IS NOT NULL
                AND (la.analise_data_conclusao + INTERVAL '1 year')::date < CURRENT_DATE
                AND la.analise_status NOT IN ('Pendente','Em Análise'))
          )
        UNION ALL
        SELECT jsonb_build_object('type','sem_analise_posicao','severity','high','label','Sem análise com posição')
          WHERE COALESCE(ia.exposure_total,0) > 0 AND la.analise_id IS NULL
        UNION ALL
        SELECT jsonb_build_object('type','acima_limite','severity','high','label','Acima do limite')
          WHERE (al.limit_value IS NOT NULL OR al.limit_pct_nav IS NOT NULL)
            AND COALESCE(ia.exposure_total,0) > 0
            AND (
              (al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total / al.limit_value > 1)
              OR (al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
                  AND COALESCE(ia.pl_denominador,0) > 0
                  AND (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav > 1)
            )
        UNION ALL
        SELECT jsonb_build_object('type','proximo_limite','severity','medium','label','Próximo do limite')
          WHERE (al.limit_value IS NOT NULL OR al.limit_pct_nav IS NOT NULL)
            AND COALESCE(ia.exposure_total,0) > 0
            AND (
              (al.limit_value IS NOT NULL AND al.limit_value > 0
                AND ia.exposure_total / al.limit_value BETWEEN 0.8 AND 1)
              OR (al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
                  AND COALESCE(ia.pl_denominador,0) > 0
                  AND (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav BETWEEN 0.8 AND 1)
            )
        UNION ALL
        SELECT jsonb_build_object('type','sem_limite','severity','medium','label','Limite não cadastrado')
          WHERE COALESCE(ia.exposure_total,0) > 0
            AND al.limit_value IS NULL AND al.limit_pct_nav IS NULL
        UNION ALL
        SELECT jsonb_build_object('type','sem_rating','severity','medium','label','Rating ausente')
          WHERE r.rating IS NULL AND u.ghost = FALSE
        UNION ALL
        SELECT jsonb_build_object('type','cadastro_incompleto','severity','low','label','Cadastro incompleto')
          WHERE u.ghost = FALSE AND (u.setor IS NULL OR u.grupo_economico IS NULL)
      ) s
    ) AS alerts
  FROM emissores_universo u
  LEFT JOIN LATERAL public.get_resolved_rating(u.cnpj, NULL) r ON TRUE
  LEFT JOIN latest_analise la ON la.cnpj_norm = u.cnpj_norm
  LEFT JOIN issuer_agg ia ON ia.cnpj_norm = u.cnpj_norm
  LEFT JOIN issuer_top it ON it.cnpj_norm = u.cnpj_norm
  LEFT JOIN active_limit al ON al.cnpj_norm = u.cnpj_norm;
END;
$function$
;

-- tg_issuer_limits_normalize()
CREATE OR REPLACE FUNCTION public.tg_issuer_limits_normalize()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cnpj_emissor IS NOT NULL THEN
    NEW.cnpj_emissor := regexp_replace(NEW.cnpj_emissor, '[^0-9]', '', 'g');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

-- refresh_spread_historico()
CREATE OR REPLACE FUNCTION public.refresh_spread_historico()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff date;
  v_count integer;
BEGIN
  SET LOCAL statement_timeout = '300s';

  v_cutoff := CURRENT_DATE - INTERVAL '90 days';

  -- Trunca tudo (recalculado a cada upload)
  TRUNCATE TABLE trade_spread_historico;

  INSERT INTO trade_spread_historico (ticker, data, spread, pu_curva, pu_indicativo, indexador, rating)
  SELECT
    tx.ticker,
    tx.data,
    ROUND(((1 + tx.taxa_indicativa) / (1 + nb.taxa_indicativa) - 1) * 100, 6) AS spread,
    tx.pu_curva,
    tx.pu_indicativo,
    'IPCA' AS indexador,
    a.rating
  FROM trade_taxas tx
  JOIN trade_ipca_ref ref ON ref.ticker = tx.ticker
  JOIN trade_ntnb nb      ON nb.bond_name = ref.ntnb_ref AND nb.data = tx.data
  LEFT JOIN trade_ativos a ON a.ticker = tx.ticker
  WHERE tx.data >= v_cutoff
    AND tx.taxa_indicativa IS NOT NULL
    AND nb.taxa_indicativa IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

-- derive_sub_indexador(text,text)
CREATE OR REPLACE FUNCTION public.derive_sub_indexador(p_indexador text, p_taxa_emissao text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_taxa_emissao IS NULL OR TRIM(p_taxa_emissao) = '' THEN
    -- fallback: use indexador
    IF p_indexador = 'IPCA' THEN RETURN 'IPCA';
    ELSIF p_indexador = 'PRE' THEN RETURN 'PRE';
    ELSE RETURN 'OUTRO';
    END IF;
  END IF;

  -- IPCA + spread (e.g. "IPCA + 5.6%")
  IF p_taxa_emissao ~* 'IPCA\s*\+' THEN RETURN 'IPCA'; END IF;

  -- % do CDI / % do DI / % CDI / %CDI  → percent of CDI
  IF p_taxa_emissao ~* '^\s*[0-9]+([.,][0-9]+)?\s*%\s*(do\s+)?(CDI|DI)\s*$' THEN
    RETURN 'CDI_PCT';
  END IF;

  -- DI + spread (e.g. "DI + 1.5%")
  IF p_taxa_emissao ~* '^\s*(DI|CDI)\s*\+' THEN RETURN 'DI_SPREAD'; END IF;

  -- Pure pre-fixed (e.g. "12.5%")
  IF p_indexador = 'PRE' THEN RETURN 'PRE'; END IF;

  -- Fallback to indexador
  IF p_indexador = 'IPCA' THEN RETURN 'IPCA'; END IF;
  IF p_indexador = 'DI' THEN RETURN 'DI_SPREAD'; END IF;
  RETURN 'OUTRO';
END;
$function$
;

-- get_posicoes_val_dates_by_source(text)
CREATE OR REPLACE FUNCTION public.get_posicoes_val_dates_by_source(p_source text)
 RETURNS TABLE(val_date_text text, val_date_parsed date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    p.val_date AS val_date_text,
    CASE
      WHEN p.val_date ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(p.val_date, 'MM/DD/YYYY')
      WHEN p.val_date ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(p.val_date, 'YYYY-MM-DD')
      ELSE NULL
    END AS val_date_parsed
  FROM public.posicoes p
  WHERE p.trading_desk_share_source = p_source
    AND p.val_date IS NOT NULL
    AND p.val_date <> ''
  ORDER BY val_date_parsed DESC NULLS LAST;
$function$
;

-- get_resolved_rating_v2(text,text,text)
CREATE OR REPLACE FUNCTION public.get_resolved_rating_v2(p_cnpj text, p_isin text DEFAULT NULL::text, p_class_code text DEFAULT NULL::text)
 RETURNS TABLE(rating_value text, source_level text, rating_date date, rating_id uuid, source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cnpj text;
BEGIN
  v_cnpj := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');

  -- Nível 1: FIDC class
  IF p_isin IS NOT NULL AND TRIM(p_isin) <> '' AND p_class_code IS NOT NULL AND TRIM(p_class_code) <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'fidc_class'::text, r.rating_date, r.id, r.source
    FROM public.rating_fidc_class_history r
    WHERE r.isin = p_isin AND r.class_code = p_class_code
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Nível 2: emissão
  IF p_isin IS NOT NULL AND TRIM(p_isin) <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'emission'::text, r.rating_date, r.id, r.source
    FROM public.rating_emission_history r
    WHERE r.isin = p_isin
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Nível 3: emissor
  IF v_cnpj <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'issuer'::text, r.rating_date, r.id, r.source
    FROM public.rating_issuer_history r
    WHERE r.cnpj = v_cnpj
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN QUERY SELECT NULL::text, 'nr'::text, NULL::date, NULL::uuid, NULL::text;
END;
$function$
;

-- recalc_trade_metricas_di()
CREATE OR REPLACE FUNCTION public.recalc_trade_metricas_di()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_date DATE;
  v_d5  DATE; v_d10 DATE; v_d21 DATE; v_d30 DATE; v_d90 DATE;
BEGIN
  SET LOCAL statement_timeout = '120s';

  SELECT MAX(data) INTO v_last_date FROM trade_taxas;

  SELECT data INTO v_d5  FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 5)  t ORDER BY data LIMIT 1;
  SELECT data INTO v_d10 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 10) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d21 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 21) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d30 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 30) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d90 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 90) t ORDER BY data LIMIT 1;

  INSERT INTO trade_metricas (
    ticker, indexador, last_date, last_val,
    last_qtd, last_vol_fin, pu_curva, pu_indicativo, pu_ratio,
    avg_5d, avg_10d, avg_21d, avg_30d, avg_90d, std_90d,
    z_score, z_score_5d, z_score_10d, z_score_21d,
    change_bps, total_qtd, total_vol_fin,
    updated_at
  )
  SELECT
    t.ticker, a.indexador, t.last_date, t.last_val,
    t.last_qtd, t.last_vol_fin, t.pu_curva, t.pu_indicativo,
    CASE WHEN t.pu_curva > 0 THEN t.pu_indicativo / t.pu_curva END,
    w.avg_5d, w.avg_10d, w.avg_21d, w.avg_30d, w.avg_90d, w.std_90d,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_90d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_5d)  / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_10d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_21d) / w.std_90d END,
    (t.last_val - w.first_val) * 100,
    v.total_qtd, v.total_vol_fin, NOW()
  FROM (
    SELECT DISTINCT ON (ticker) ticker,
      data AS last_date, taxa_indicativa * 100 AS last_val,
      qtd_negociada AS last_qtd, vol_financeiro AS last_vol_fin,
      pu_curva, pu_indicativo
    FROM trade_taxas
    WHERE data >= v_last_date - INTERVAL '7 days'
      AND taxa_indicativa IS NOT NULL
      AND taxa_indicativa <> 0
    ORDER BY ticker, data DESC
  ) t
  JOIN trade_ativos a ON a.ticker = t.ticker AND a.indexador IN ('DI','PRE','OUTRO')
  JOIN LATERAL (
    SELECT
      AVG(CASE WHEN data >= v_d5  THEN taxa_indicativa * 100 END) AS avg_5d,
      AVG(CASE WHEN data >= v_d10 THEN taxa_indicativa * 100 END) AS avg_10d,
      AVG(CASE WHEN data >= v_d21 THEN taxa_indicativa * 100 END) AS avg_21d,
      AVG(CASE WHEN data >= v_d30 THEN taxa_indicativa * 100 END) AS avg_30d,
      AVG(CASE WHEN data >= v_d90 THEN taxa_indicativa * 100 END) AS avg_90d,
      STDDEV(CASE WHEN data >= v_d90 THEN taxa_indicativa * 100 END) AS std_90d,
      MIN(CASE WHEN data = (SELECT MIN(data) FROM trade_taxas tt2 WHERE tt2.ticker = t.ticker)
            THEN taxa_indicativa * 100 END) AS first_val
    FROM trade_taxas tt WHERE tt.ticker = t.ticker
  ) w ON true
  JOIN LATERAL (
    SELECT SUM(qtd_negociada) AS total_qtd, SUM(vol_financeiro) AS total_vol_fin
    FROM trade_taxas tv WHERE tv.ticker = t.ticker AND tv.data >= v_d90
  ) v ON true
  WHERE t.last_val IS NOT NULL AND t.last_val <> 0
  ON CONFLICT (ticker) DO UPDATE SET
    indexador = EXCLUDED.indexador, last_date = EXCLUDED.last_date,
    last_val = EXCLUDED.last_val, last_qtd = EXCLUDED.last_qtd,
    last_vol_fin = EXCLUDED.last_vol_fin, pu_curva = EXCLUDED.pu_curva,
    pu_indicativo = EXCLUDED.pu_indicativo, pu_ratio = EXCLUDED.pu_ratio,
    avg_5d = EXCLUDED.avg_5d, avg_10d = EXCLUDED.avg_10d,
    avg_21d = EXCLUDED.avg_21d, avg_30d = EXCLUDED.avg_30d,
    avg_90d = EXCLUDED.avg_90d, std_90d = EXCLUDED.std_90d,
    z_score = EXCLUDED.z_score, z_score_5d = EXCLUDED.z_score_5d,
    z_score_10d = EXCLUDED.z_score_10d, z_score_21d = EXCLUDED.z_score_21d,
    change_bps = EXCLUDED.change_bps, total_qtd = EXCLUDED.total_qtd,
    total_vol_fin = EXCLUDED.total_vol_fin, updated_at = NOW();

  -- Limpa registros existentes com last_val zerado/nulo (DI/PRE/OUTRO)
  DELETE FROM trade_metricas
  WHERE indexador IN ('DI','PRE','OUTRO')
    AND (last_val IS NULL OR last_val = 0);
END;
$function$
;

-- get_ipca_history(date,text)
CREATE OR REPLACE FUNCTION public.get_ipca_history(p_cutoff date DEFAULT (CURRENT_DATE - '90 days'::interval), p_ticker text DEFAULT NULL::text)
 RETURNS TABLE(ticker text, data date, spread numeric, pu_curva numeric, pu_indicativo numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    tx.ticker,
    tx.data,
    ROUND(((1 + tx.taxa_indicativa) / (1 + nb.taxa_indicativa) - 1) * 100, 6) AS spread,
    tx.pu_curva,
    tx.pu_indicativo
  FROM trade_taxas tx
  JOIN trade_ipca_ref ref ON ref.ticker = tx.ticker
  JOIN trade_ntnb nb      ON nb.bond_name = ref.ntnb_ref AND nb.data = tx.data
  WHERE tx.data >= p_cutoff
    AND (p_ticker IS NULL OR tx.ticker = p_ticker)
  ORDER BY tx.ticker, tx.data;
$function$
;

-- GRANTS + RLS + POLICIES
GRANT SELECT, INSERT, UPDATE, DELETE ON public."alert_rules" TO authenticated;
GRANT ALL ON public."alert_rules" TO service_role;
ALTER TABLE public."alert_rules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_ar read" ON public."alert_rules";
CREATE POLICY "fidc_ar read" ON public."alert_rules" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_ar write" ON public."alert_rules";
CREATE POLICY "fidc_ar write" ON public."alert_rules" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."alerts" TO authenticated;
GRANT ALL ON public."alerts" TO service_role;
ALTER TABLE public."alerts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_al read" ON public."alerts";
CREATE POLICY "fidc_al read" ON public."alerts" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_al write" ON public."alerts";
CREATE POLICY "fidc_al write" ON public."alerts" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."allocation_limits" TO authenticated;
GRANT ALL ON public."allocation_limits" TO service_role;
ALTER TABLE public."allocation_limits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read allocation_limits" ON public."allocation_limits";
CREATE POLICY "Authenticated read allocation_limits" ON public."allocation_limits" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor delete allocation_limits" ON public."allocation_limits";
CREATE POLICY "Gestor delete allocation_limits" ON public."allocation_limits" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor insert allocation_limits" ON public."allocation_limits";
CREATE POLICY "Gestor insert allocation_limits" ON public."allocation_limits" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor update allocation_limits" ON public."allocation_limits";
CREATE POLICY "Gestor update allocation_limits" ON public."allocation_limits" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."allocation_target_periods" TO authenticated;
GRANT ALL ON public."allocation_target_periods" TO service_role;
ALTER TABLE public."allocation_target_periods" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read target_periods" ON public."allocation_target_periods";
CREATE POLICY "Authenticated read target_periods" ON public."allocation_target_periods" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor delete target_periods" ON public."allocation_target_periods";
CREATE POLICY "Gestor delete target_periods" ON public."allocation_target_periods" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Writers insert target_periods" ON public."allocation_target_periods";
CREATE POLICY "Writers insert target_periods" ON public."allocation_target_periods" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "Writers update target_periods" ON public."allocation_target_periods";
CREATE POLICY "Writers update target_periods" ON public."allocation_target_periods" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."allocation_targets" TO authenticated;
GRANT ALL ON public."allocation_targets" TO service_role;
ALTER TABLE public."allocation_targets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read allocation_targets" ON public."allocation_targets";
CREATE POLICY "Authenticated read allocation_targets" ON public."allocation_targets" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor delete allocation_targets" ON public."allocation_targets";
CREATE POLICY "Gestor delete allocation_targets" ON public."allocation_targets" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Writers insert allocation_targets" ON public."allocation_targets";
CREATE POLICY "Writers insert allocation_targets" ON public."allocation_targets" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "Writers update allocation_targets" ON public."allocation_targets";
CREATE POLICY "Writers update allocation_targets" ON public."allocation_targets" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."allocation_targets_emissor" TO authenticated;
GRANT ALL ON public."allocation_targets_emissor" TO service_role;
ALTER TABLE public."allocation_targets_emissor" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read targets_emissor" ON public."allocation_targets_emissor";
CREATE POLICY "Authenticated read targets_emissor" ON public."allocation_targets_emissor" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor delete targets_emissor" ON public."allocation_targets_emissor";
CREATE POLICY "Gestor delete targets_emissor" ON public."allocation_targets_emissor" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Writers insert targets_emissor" ON public."allocation_targets_emissor";
CREATE POLICY "Writers insert targets_emissor" ON public."allocation_targets_emissor" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "Writers update targets_emissor" ON public."allocation_targets_emissor";
CREATE POLICY "Writers update targets_emissor" ON public."allocation_targets_emissor" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."allocation_targets_setor" TO authenticated;
GRANT ALL ON public."allocation_targets_setor" TO service_role;
ALTER TABLE public."allocation_targets_setor" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read allocation_targets_setor" ON public."allocation_targets_setor";
CREATE POLICY "Authenticated read allocation_targets_setor" ON public."allocation_targets_setor" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor delete allocation_targets_setor" ON public."allocation_targets_setor";
CREATE POLICY "Gestor delete allocation_targets_setor" ON public."allocation_targets_setor" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor insert allocation_targets_setor" ON public."allocation_targets_setor";
CREATE POLICY "Gestor insert allocation_targets_setor" ON public."allocation_targets_setor" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor update allocation_targets_setor" ON public."allocation_targets_setor";
CREATE POLICY "Gestor update allocation_targets_setor" ON public."allocation_targets_setor" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."analises" TO authenticated;
GRANT ALL ON public."analises" TO service_role;
ALTER TABLE public."analises" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read analises" ON public."analises";
CREATE POLICY "Authenticated users can read analises" ON public."analises" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Only Gestor can delete analises" ON public."analises";
CREATE POLICY "Only Gestor can delete analises" ON public."analises" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Writers can insert analises" ON public."analises";
CREATE POLICY "Writers can insert analises" ON public."analises" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers can update analises" ON public."analises";
CREATE POLICY "Writers can update analises" ON public."analises" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."assembleia_participacoes" TO authenticated;
GRANT ALL ON public."assembleia_participacoes" TO service_role;
ALTER TABLE public."assembleia_participacoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read participacoes" ON public."assembleia_participacoes";
CREATE POLICY "Authenticated read participacoes" ON public."assembleia_participacoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Writers delete participacoes" ON public."assembleia_participacoes";
CREATE POLICY "Writers delete participacoes" ON public."assembleia_participacoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers insert participacoes" ON public."assembleia_participacoes";
CREATE POLICY "Writers insert participacoes" ON public."assembleia_participacoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers update participacoes" ON public."assembleia_participacoes";
CREATE POLICY "Writers update participacoes" ON public."assembleia_participacoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."assembleia_upload_log" TO authenticated;
GRANT ALL ON public."assembleia_upload_log" TO service_role;
ALTER TABLE public."assembleia_upload_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read upload log" ON public."assembleia_upload_log";
CREATE POLICY "Authenticated read upload log" ON public."assembleia_upload_log" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Writers insert upload log" ON public."assembleia_upload_log";
CREATE POLICY "Writers insert upload log" ON public."assembleia_upload_log" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."assembleias" TO authenticated;
GRANT ALL ON public."assembleias" TO service_role;
ALTER TABLE public."assembleias" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read assembleias" ON public."assembleias";
CREATE POLICY "Authenticated can read assembleias" ON public."assembleias" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor can delete assembleias" ON public."assembleias";
CREATE POLICY "Gestor can delete assembleias" ON public."assembleias" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Writers can insert assembleias" ON public."assembleias";
CREATE POLICY "Writers can insert assembleias" ON public."assembleias" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers can update assembleias" ON public."assembleias";
CREATE POLICY "Writers can update assembleias" ON public."assembleias" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."credit_opinions" TO authenticated;
GRANT ALL ON public."credit_opinions" TO service_role;
ALTER TABLE public."credit_opinions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_op read" ON public."credit_opinions";
CREATE POLICY "fidc_op read" ON public."credit_opinions" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_op write" ON public."credit_opinions";
CREATE POLICY "fidc_op write" ON public."credit_opinions" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write_opinion(auth.uid()))
  WITH CHECK (fidc_can_write_opinion(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cvm_data_dictionary" TO authenticated;
GRANT ALL ON public."cvm_data_dictionary" TO service_role;
ALTER TABLE public."cvm_data_dictionary" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cvm_dict_read_auth" ON public."cvm_data_dictionary";
CREATE POLICY "cvm_dict_read_auth" ON public."cvm_data_dictionary" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "cvm_dict_write_admin" ON public."cvm_data_dictionary";
CREATE POLICY "cvm_dict_write_admin" ON public."cvm_data_dictionary" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cvm_fidc_field_mapping" TO authenticated;
GRANT ALL ON public."cvm_fidc_field_mapping" TO service_role;
ALTER TABLE public."cvm_fidc_field_mapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cvm_map_read_auth" ON public."cvm_fidc_field_mapping";
CREATE POLICY "cvm_map_read_auth" ON public."cvm_fidc_field_mapping" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "cvm_map_write_admin" ON public."cvm_fidc_field_mapping";
CREATE POLICY "cvm_map_write_admin" ON public."cvm_fidc_field_mapping" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cvm_monthly_import_staging" TO authenticated;
GRANT ALL ON public."cvm_monthly_import_staging" TO service_role;
ALTER TABLE public."cvm_monthly_import_staging" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cvm_stg_read_auth" ON public."cvm_monthly_import_staging";
CREATE POLICY "cvm_stg_read_auth" ON public."cvm_monthly_import_staging" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "cvm_stg_write_admin" ON public."cvm_monthly_import_staging";
CREATE POLICY "cvm_stg_write_admin" ON public."cvm_monthly_import_staging" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."emissoes" TO authenticated;
GRANT ALL ON public."emissoes" TO service_role;
ALTER TABLE public."emissoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read emissoes" ON public."emissoes";
CREATE POLICY "Authenticated users can read emissoes" ON public."emissoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Writers can delete emissoes" ON public."emissoes";
CREATE POLICY "Writers can delete emissoes" ON public."emissoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers can insert emissoes" ON public."emissoes";
CREATE POLICY "Writers can insert emissoes" ON public."emissoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers can update emissoes" ON public."emissoes";
CREATE POLICY "Writers can update emissoes" ON public."emissoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."empresas" TO authenticated;
GRANT ALL ON public."empresas" TO service_role;
ALTER TABLE public."empresas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read empresas" ON public."empresas";
CREATE POLICY "Authenticated users can read empresas" ON public."empresas" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Writers can insert empresas" ON public."empresas";
CREATE POLICY "Writers can insert empresas" ON public."empresas" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers can update empresas" ON public."empresas";
CREATE POLICY "Writers can update empresas" ON public."empresas" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_alert_events" TO authenticated;
GRANT ALL ON public."fidc_alert_events" TO service_role;
ALTER TABLE public."fidc_alert_events" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados leem eventos de alerta" ON public."fidc_alert_events";
CREATE POLICY "Autenticados leem eventos de alerta" ON public."fidc_alert_events" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_alert_rules" TO authenticated;
GRANT ALL ON public."fidc_alert_rules" TO service_role;
ALTER TABLE public."fidc_alert_rules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados leem regras de alerta" ON public."fidc_alert_rules";
CREATE POLICY "Autenticados leem regras de alerta" ON public."fidc_alert_rules" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor/Coordenação apagam regras" ON public."fidc_alert_rules";
CREATE POLICY "Gestor/Coordenação apagam regras" ON public."fidc_alert_rules" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "Gestor/Coordenação atualizam regras" ON public."fidc_alert_rules";
CREATE POLICY "Gestor/Coordenação atualizam regras" ON public."fidc_alert_rules" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "Gestor/Coordenação criam regras" ON public."fidc_alert_rules";
CREATE POLICY "Gestor/Coordenação criam regras" ON public."fidc_alert_rules" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_classes" TO authenticated;
GRANT ALL ON public."fidc_classes" TO service_role;
ALTER TABLE public."fidc_classes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read fidc_classes" ON public."fidc_classes";
CREATE POLICY "Authenticated read fidc_classes" ON public."fidc_classes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor delete fidc_classes" ON public."fidc_classes";
CREATE POLICY "Gestor delete fidc_classes" ON public."fidc_classes" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Writers insert fidc_classes" ON public."fidc_classes";
CREATE POLICY "Writers insert fidc_classes" ON public."fidc_classes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers update fidc_classes" ON public."fidc_classes";
CREATE POLICY "Writers update fidc_classes" ON public."fidc_classes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_monthly_quota_classes" TO authenticated;
GRANT ALL ON public."fidc_monthly_quota_classes" TO service_role;
ALTER TABLE public."fidc_monthly_quota_classes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_mqc read" ON public."fidc_monthly_quota_classes";
CREATE POLICY "fidc_mqc read" ON public."fidc_monthly_quota_classes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_mqc write" ON public."fidc_monthly_quota_classes";
CREATE POLICY "fidc_mqc write" ON public."fidc_monthly_quota_classes" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_monthly_reports" TO authenticated;
GRANT ALL ON public."fidc_monthly_reports" TO service_role;
ALTER TABLE public."fidc_monthly_reports" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_rep read" ON public."fidc_monthly_reports";
CREATE POLICY "fidc_rep read" ON public."fidc_monthly_reports" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_rep write" ON public."fidc_monthly_reports";
CREATE POLICY "fidc_rep write" ON public."fidc_monthly_reports" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_monthly_segments" TO authenticated;
GRANT ALL ON public."fidc_monthly_segments" TO service_role;
ALTER TABLE public."fidc_monthly_segments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_monthly_segments_select" ON public."fidc_monthly_segments";
CREATE POLICY "fidc_monthly_segments_select" ON public."fidc_monthly_segments" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_monthly_segments_write" ON public."fidc_monthly_segments";
CREATE POLICY "fidc_monthly_segments_write" ON public."fidc_monthly_segments" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_quota_classes" TO authenticated;
GRANT ALL ON public."fidc_quota_classes" TO service_role;
ALTER TABLE public."fidc_quota_classes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_qc read" ON public."fidc_quota_classes";
CREATE POLICY "fidc_qc read" ON public."fidc_quota_classes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_qc write" ON public."fidc_quota_classes";
CREATE POLICY "fidc_qc write" ON public."fidc_quota_classes" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_rating_history" TO authenticated;
GRANT ALL ON public."fidc_rating_history" TO service_role;
ALTER TABLE public."fidc_rating_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_rat read" ON public."fidc_rating_history";
CREATE POLICY "fidc_rat read" ON public."fidc_rating_history" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_rat write" ON public."fidc_rating_history";
CREATE POLICY "fidc_rat write" ON public."fidc_rating_history" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidc_subordination_limits" TO authenticated;
GRANT ALL ON public."fidc_subordination_limits" TO service_role;
ALTER TABLE public."fidc_subordination_limits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc_sublim_select_auth" ON public."fidc_subordination_limits";
CREATE POLICY "fidc_sublim_select_auth" ON public."fidc_subordination_limits" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc_sublim_write_roles" ON public."fidc_subordination_limits";
CREATE POLICY "fidc_sublim_write_roles" ON public."fidc_subordination_limits" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."fidcs" TO authenticated;
GRANT ALL ON public."fidcs" TO service_role;
ALTER TABLE public."fidcs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fidc read" ON public."fidcs";
CREATE POLICY "fidc read" ON public."fidcs" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "fidc write" ON public."fidcs";
CREATE POLICY "fidc write" ON public."fidcs" AS PERMISSIVE FOR ALL TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."issuer_limits" TO authenticated;
GRANT ALL ON public."issuer_limits" TO service_role;
ALTER TABLE public."issuer_limits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read issuer_limits" ON public."issuer_limits";
CREATE POLICY "Authenticated read issuer_limits" ON public."issuer_limits" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor/Risco delete issuer_limits" ON public."issuer_limits";
CREATE POLICY "Gestor/Risco delete issuer_limits" ON public."issuer_limits" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Risco e Compliance'::app_role)));
DROP POLICY IF EXISTS "Gestor/Risco insert issuer_limits" ON public."issuer_limits";
CREATE POLICY "Gestor/Risco insert issuer_limits" ON public."issuer_limits" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Risco e Compliance'::app_role)));
DROP POLICY IF EXISTS "Gestor/Risco update issuer_limits" ON public."issuer_limits";
CREATE POLICY "Gestor/Risco update issuer_limits" ON public."issuer_limits" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Risco e Compliance'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."issuer_ratings" TO authenticated;
GRANT ALL ON public."issuer_ratings" TO service_role;
ALTER TABLE public."issuer_ratings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "issuer_ratings_delete_writers" ON public."issuer_ratings";
CREATE POLICY "issuer_ratings_delete_writers" ON public."issuer_ratings" AS PERMISSIVE FOR DELETE TO authenticated
  USING (fidc_can_write(auth.uid()));
DROP POLICY IF EXISTS "issuer_ratings_insert_writers" ON public."issuer_ratings";
CREATE POLICY "issuer_ratings_insert_writers" ON public."issuer_ratings" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (fidc_can_write(auth.uid()));
DROP POLICY IF EXISTS "issuer_ratings_select_authenticated" ON public."issuer_ratings";
CREATE POLICY "issuer_ratings_select_authenticated" ON public."issuer_ratings" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "issuer_ratings_update_writers" ON public."issuer_ratings";
CREATE POLICY "issuer_ratings_update_writers" ON public."issuer_ratings" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (fidc_can_write(auth.uid()))
  WITH CHECK (fidc_can_write(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."mfa_reset_log" TO authenticated;
GRANT ALL ON public."mfa_reset_log" TO service_role;
ALTER TABLE public."mfa_reset_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestor e Risco veem logs de MFA" ON public."mfa_reset_log";
CREATE POLICY "Gestor e Risco veem logs de MFA" ON public."mfa_reset_log" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Risco e Compliance'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."pipeline_eventos" TO authenticated;
GRANT ALL ON public."pipeline_eventos" TO service_role;
ALTER TABLE public."pipeline_eventos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura autenticados" ON public."pipeline_eventos";
CREATE POLICY "Leitura autenticados" ON public."pipeline_eventos" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Writers can insert pipeline_eventos" ON public."pipeline_eventos";
CREATE POLICY "Writers can insert pipeline_eventos" ON public."pipeline_eventos" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."posicoes" TO authenticated;
GRANT ALL ON public."posicoes" TO service_role;
ALTER TABLE public."posicoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read posicoes" ON public."posicoes";
CREATE POLICY "Authenticated users can read posicoes" ON public."posicoes" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Writers can delete posicoes" ON public."posicoes";
CREATE POLICY "Writers can delete posicoes" ON public."posicoes" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers can insert posicoes" ON public."posicoes";
CREATE POLICY "Writers can insert posicoes" ON public."posicoes" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
DROP POLICY IF EXISTS "Writers can update posicoes" ON public."posicoes";
CREATE POLICY "Writers can update posicoes" ON public."posicoes" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."profiles" TO authenticated;
GRANT ALL ON public."profiles" TO service_role;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestor can insert profiles" ON public."profiles";
CREATE POLICY "Gestor can insert profiles" ON public."profiles" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor can read all profiles" ON public."profiles";
CREATE POLICY "Gestor can read all profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor can update any profile" ON public."profiles";
CREATE POLICY "Gestor can update any profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Users can read own profile" ON public."profiles";
CREATE POLICY "Users can read own profile" ON public."profiles" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can update own safe fields" ON public."profiles";
CREATE POLICY "Users can update own safe fields" ON public."profiles" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK (((auth.uid() = id)
    AND (funcao = (SELECT p.funcao FROM public.profiles p WHERE p.id = auth.uid()))
    AND (status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()))));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."rating_emission_history" TO authenticated;
GRANT ALL ON public."rating_emission_history" TO service_role;
ALTER TABLE public."rating_emission_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rating_emission_history_delete_managers" ON public."rating_emission_history";
CREATE POLICY "rating_emission_history_delete_managers" ON public."rating_emission_history" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "rating_emission_history_read_authenticated" ON public."rating_emission_history";
CREATE POLICY "rating_emission_history_read_authenticated" ON public."rating_emission_history" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "rating_emission_history_update_managers" ON public."rating_emission_history";
CREATE POLICY "rating_emission_history_update_managers" ON public."rating_emission_history" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "rating_emission_history_write_managers" ON public."rating_emission_history";
CREATE POLICY "rating_emission_history_write_managers" ON public."rating_emission_history" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."rating_fidc_class_history" TO authenticated;
GRANT ALL ON public."rating_fidc_class_history" TO service_role;
ALTER TABLE public."rating_fidc_class_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rating_fidc_class_history_delete_managers" ON public."rating_fidc_class_history";
CREATE POLICY "rating_fidc_class_history_delete_managers" ON public."rating_fidc_class_history" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "rating_fidc_class_history_read_authenticated" ON public."rating_fidc_class_history";
CREATE POLICY "rating_fidc_class_history_read_authenticated" ON public."rating_fidc_class_history" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "rating_fidc_class_history_update_managers" ON public."rating_fidc_class_history";
CREATE POLICY "rating_fidc_class_history_update_managers" ON public."rating_fidc_class_history" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "rating_fidc_class_history_write_managers" ON public."rating_fidc_class_history";
CREATE POLICY "rating_fidc_class_history_write_managers" ON public."rating_fidc_class_history" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."rating_issuer_history" TO authenticated;
GRANT ALL ON public."rating_issuer_history" TO service_role;
ALTER TABLE public."rating_issuer_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rating_issuer_history_delete_managers" ON public."rating_issuer_history";
CREATE POLICY "rating_issuer_history_delete_managers" ON public."rating_issuer_history" AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "rating_issuer_history_read_authenticated" ON public."rating_issuer_history";
CREATE POLICY "rating_issuer_history_read_authenticated" ON public."rating_issuer_history" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "rating_issuer_history_update_managers" ON public."rating_issuer_history";
CREATE POLICY "rating_issuer_history_update_managers" ON public."rating_issuer_history" AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
DROP POLICY IF EXISTS "rating_issuer_history_write_managers" ON public."rating_issuer_history";
CREATE POLICY "rating_issuer_history_write_managers" ON public."rating_issuer_history" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."setores" TO authenticated;
GRANT ALL ON public."setores" TO service_role;
ALTER TABLE public."setores" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read setores" ON public."setores";
CREATE POLICY "Authenticated read setores" ON public."setores" AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Gestor delete setores" ON public."setores";
CREATE POLICY "Gestor delete setores" ON public."setores" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor insert setores" ON public."setores";
CREATE POLICY "Gestor insert setores" ON public."setores" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Gestor update setores" ON public."setores";
CREATE POLICY "Gestor update setores" ON public."setores" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_ativos" TO authenticated;
GRANT ALL ON public."trade_ativos" TO service_role;
ALTER TABLE public."trade_ativos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_ativos";
CREATE POLICY "read_authenticated" ON public."trade_ativos" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_ativos";
CREATE POLICY "write_service_role" ON public."trade_ativos" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_ipca_ref" TO authenticated;
GRANT ALL ON public."trade_ipca_ref" TO service_role;
ALTER TABLE public."trade_ipca_ref" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_ipca_ref";
CREATE POLICY "read_authenticated" ON public."trade_ipca_ref" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_ipca_ref";
CREATE POLICY "write_service_role" ON public."trade_ipca_ref" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_metricas" TO authenticated;
GRANT ALL ON public."trade_metricas" TO service_role;
ALTER TABLE public."trade_metricas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_metricas";
CREATE POLICY "read_authenticated" ON public."trade_metricas" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_metricas";
CREATE POLICY "write_service_role" ON public."trade_metricas" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_ntnb" TO authenticated;
GRANT ALL ON public."trade_ntnb" TO service_role;
ALTER TABLE public."trade_ntnb" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_ntnb";
CREATE POLICY "read_authenticated" ON public."trade_ntnb" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_ntnb";
CREATE POLICY "write_service_role" ON public."trade_ntnb" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_spread_agg_diario" TO authenticated;
GRANT ALL ON public."trade_spread_agg_diario" TO service_role;
ALTER TABLE public."trade_spread_agg_diario" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_spread_agg_diario";
CREATE POLICY "read_authenticated" ON public."trade_spread_agg_diario" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_spread_agg_diario";
CREATE POLICY "write_service_role" ON public."trade_spread_agg_diario" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_spread_historico" TO authenticated;
GRANT ALL ON public."trade_spread_historico" TO service_role;
ALTER TABLE public."trade_spread_historico" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_spread_historico";
CREATE POLICY "read_authenticated" ON public."trade_spread_historico" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_spread_historico";
CREATE POLICY "write_service_role" ON public."trade_spread_historico" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_taxas" TO authenticated;
GRANT ALL ON public."trade_taxas" TO service_role;
ALTER TABLE public."trade_taxas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_taxas";
CREATE POLICY "read_authenticated" ON public."trade_taxas" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_taxas";
CREATE POLICY "write_service_role" ON public."trade_taxas" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_ticker_snapshot" TO authenticated;
GRANT ALL ON public."trade_ticker_snapshot" TO service_role;
ALTER TABLE public."trade_ticker_snapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_ticker_snapshot";
CREATE POLICY "read_authenticated" ON public."trade_ticker_snapshot" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_ticker_snapshot";
CREATE POLICY "write_service_role" ON public."trade_ticker_snapshot" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_upload_log" TO authenticated;
GRANT ALL ON public."trade_upload_log" TO service_role;
ALTER TABLE public."trade_upload_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_upload_log";
CREATE POLICY "read_authenticated" ON public."trade_upload_log" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_upload_log";
CREATE POLICY "write_service_role" ON public."trade_upload_log" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."user_roles" TO authenticated;
GRANT ALL ON public."user_roles" TO service_role;
ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestor can read all roles" ON public."user_roles";
CREATE POLICY "Gestor can read all roles" ON public."user_roles" AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Only Gestor can delete roles" ON public."user_roles";
CREATE POLICY "Only Gestor can delete roles" ON public."user_roles" AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Only Gestor can insert roles" ON public."user_roles";
CREATE POLICY "Only Gestor can insert roles" ON public."user_roles" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Only Gestor can update roles" ON public."user_roles";
CREATE POLICY "Only Gestor can update roles" ON public."user_roles" AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
DROP POLICY IF EXISTS "Users can read own roles" ON public."user_roles";
CREATE POLICY "Users can read own roles" ON public."user_roles" AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

-- TRIGGERS
DROP TRIGGER IF EXISTS "t_fidc_ar_updated" ON public."alert_rules";
CREATE TRIGGER t_fidc_ar_updated BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "t_fidc_al_updated" ON public."alerts";
CREATE TRIGGER t_fidc_al_updated BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_allocation_limits_updated_at" ON public."allocation_limits";
CREATE TRIGGER trg_allocation_limits_updated_at BEFORE UPDATE ON public.allocation_limits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_target_periods_updated" ON public."allocation_target_periods";
CREATE TRIGGER trg_target_periods_updated BEFORE UPDATE ON public.allocation_target_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_allocation_targets_updated_at" ON public."allocation_targets";
CREATE TRIGGER trg_allocation_targets_updated_at BEFORE UPDATE ON public.allocation_targets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_targets_emissor_updated" ON public."allocation_targets_emissor";
CREATE TRIGGER trg_targets_emissor_updated BEFORE UPDATE ON public.allocation_targets_emissor FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_allocation_targets_setor_updated_at" ON public."allocation_targets_setor";
CREATE TRIGGER trg_allocation_targets_setor_updated_at BEFORE UPDATE ON public.allocation_targets_setor FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_assembleias_updated_at" ON public."assembleias";
CREATE TRIGGER trg_assembleias_updated_at BEFORE UPDATE ON public.assembleias FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "t_fidc_op_updated" ON public."credit_opinions";
CREATE TRIGGER t_fidc_op_updated BEFORE UPDATE ON public.credit_opinions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_cvm_dict_updated" ON public."cvm_data_dictionary";
CREATE TRIGGER trg_cvm_dict_updated BEFORE UPDATE ON public.cvm_data_dictionary FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_cvm_map_updated" ON public."cvm_fidc_field_mapping";
CREATE TRIGGER trg_cvm_map_updated BEFORE UPDATE ON public.cvm_fidc_field_mapping FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_cvm_stg_updated" ON public."cvm_monthly_import_staging";
CREATE TRIGGER trg_cvm_stg_updated BEFORE UPDATE ON public.cvm_monthly_import_staging FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_fidc_alert_rules_updated_at" ON public."fidc_alert_rules";
CREATE TRIGGER trg_fidc_alert_rules_updated_at BEFORE UPDATE ON public.fidc_alert_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_fidc_classes_updated" ON public."fidc_classes";
CREATE TRIGGER trg_fidc_classes_updated BEFORE UPDATE ON public.fidc_classes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "t_fidc_rep_updated" ON public."fidc_monthly_reports";
CREATE TRIGGER t_fidc_rep_updated BEFORE UPDATE ON public.fidc_monthly_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "t_fidc_qc_updated" ON public."fidc_quota_classes";
CREATE TRIGGER t_fidc_qc_updated BEFORE UPDATE ON public.fidc_quota_classes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "fidc_sublim_set_updated_at" ON public."fidc_subordination_limits";
CREATE TRIGGER fidc_sublim_set_updated_at BEFORE UPDATE ON public.fidc_subordination_limits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "t_fidcs_updated" ON public."fidcs";
CREATE TRIGGER t_fidcs_updated BEFORE UPDATE ON public.fidcs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_issuer_limits_normalize" ON public."issuer_limits";
CREATE TRIGGER trg_issuer_limits_normalize BEFORE INSERT OR UPDATE ON public.issuer_limits FOR EACH ROW EXECUTE FUNCTION tg_issuer_limits_normalize();
DROP TRIGGER IF EXISTS "issuer_ratings_normalize" ON public."issuer_ratings";
CREATE TRIGGER issuer_ratings_normalize BEFORE INSERT OR UPDATE ON public.issuer_ratings FOR EACH ROW EXECUTE FUNCTION tg_issuer_ratings_normalize();
DROP TRIGGER IF EXISTS "issuer_ratings_mirror_empresas" ON public."issuer_ratings";
CREATE TRIGGER issuer_ratings_mirror_empresas AFTER INSERT OR UPDATE ON public.issuer_ratings FOR EACH ROW EXECUTE FUNCTION tg_issuer_ratings_mirror_empresas();
DROP TRIGGER IF EXISTS "enforce_profile_field_protection" ON public."profiles";
CREATE TRIGGER enforce_profile_field_protection BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_self_role_escalation();
DROP TRIGGER IF EXISTS "trg_trim_profile_nome" ON public."profiles";
CREATE TRIGGER trg_trim_profile_nome BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION trim_profile_nome();
DROP TRIGGER IF EXISTS "trg_rating_emission_history_updated_at" ON public."rating_emission_history";
CREATE TRIGGER trg_rating_emission_history_updated_at BEFORE UPDATE ON public.rating_emission_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_rating_fidc_class_history_updated_at" ON public."rating_fidc_class_history";
CREATE TRIGGER trg_rating_fidc_class_history_updated_at BEFORE UPDATE ON public.rating_fidc_class_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_rating_issuer_history_updated_at" ON public."rating_issuer_history";
CREATE TRIGGER trg_rating_issuer_history_updated_at BEFORE UPDATE ON public.rating_issuer_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_setores_updated_at" ON public."setores";
CREATE TRIGGER trg_setores_updated_at BEFORE UPDATE ON public.setores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_trade_ativos_sub_indexador" ON public."trade_ativos";
CREATE TRIGGER trg_trade_ativos_sub_indexador BEFORE INSERT OR UPDATE OF indexador, taxa_emissao ON public.trade_ativos FOR EACH ROW EXECUTE FUNCTION tg_set_sub_indexador();

-- ---------------------------------------------------------------------
-- SEQUENCE OWNERSHIP (attach sequences to their table columns)
-- ---------------------------------------------------------------------
ALTER SEQUENCE public.trade_ntnb_id_seq       OWNED BY public.trade_ntnb.id;
ALTER SEQUENCE public.trade_taxas_id_seq      OWNED BY public.trade_taxas.id;
ALTER SEQUENCE public.trade_upload_log_id_seq OWNED BY public.trade_upload_log.id;
