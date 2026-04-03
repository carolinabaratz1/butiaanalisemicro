CREATE TABLE pipeline_eventos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  analise_id uuid NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  acao text NOT NULL,
  etapa_anterior text,
  etapa_nova text,
  comentario text,
  data_comite date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura autenticados" ON pipeline_eventos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inserção autenticados" ON pipeline_eventos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_pipeline_eventos_analise ON pipeline_eventos(analise_id);
CREATE INDEX idx_pipeline_eventos_created ON pipeline_eventos(created_at DESC);