
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_setor_fkey
  FOREIGN KEY (setor) REFERENCES public.setores(nome)
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_empresas_setor ON public.empresas(setor);
