
CREATE TABLE public.posicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_desk_share_source text NOT NULL,
  val_date text NOT NULL,
  product_class text NOT NULL,
  product text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  isin text,
  financial_price numeric,
  duration_du numeric,
  yield numeric,
  implied_spread numeric,
  dv01 numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.posicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on posicoes" ON public.posicoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert on posicoes" ON public.posicoes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update on posicoes" ON public.posicoes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on posicoes" ON public.posicoes FOR DELETE TO anon, authenticated USING (true);
