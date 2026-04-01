CREATE TABLE emissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isin text NOT NULL UNIQUE,
  ticker text,
  cnpj_emissor text NOT NULL,
  val_date text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE emissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on emissoes" ON emissoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert on emissoes" ON emissoes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update on emissoes" ON emissoes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on emissoes" ON emissoes FOR DELETE TO anon, authenticated USING (true);