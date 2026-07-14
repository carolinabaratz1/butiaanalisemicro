-- Corrige ordem de criação: sequences antes das tabelas trade_
CREATE SEQUENCE IF NOT EXISTS public.trade_ntnb_id_seq AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.trade_taxas_id_seq AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.trade_upload_log_id_seq AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE IF NOT EXISTS public."trade_ntnb" (
  "id" bigint DEFAULT nextval('trade_ntnb_id_seq'::regclass) NOT NULL,
  "bond_name" text NOT NULL,
  "data" date NOT NULL,
  "taxa_indicativa" numeric(12,8),
  "pu_indicativo" numeric(14,6),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_ntnb" TO authenticated;
GRANT ALL ON public."trade_ntnb" TO service_role;
ALTER TABLE public."trade_ntnb" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_ntnb";
CREATE POLICY "read_authenticated" ON public."trade_ntnb" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_ntnb";
CREATE POLICY "write_service_role" ON public."trade_ntnb" AS PERMISSIVE FOR ALL TO public
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public."trade_upload_log" TO authenticated;
GRANT ALL ON public."trade_upload_log" TO service_role;
ALTER TABLE public."trade_upload_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_authenticated" ON public."trade_upload_log";
CREATE POLICY "read_authenticated" ON public."trade_upload_log" AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "write_service_role" ON public."trade_upload_log";
CREATE POLICY "write_service_role" ON public."trade_upload_log" AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));