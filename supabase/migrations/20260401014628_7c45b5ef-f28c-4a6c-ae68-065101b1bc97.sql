
-- Limpar espaços existentes
UPDATE profiles SET nome = TRIM(nome);

-- Adicionar trigger para prevenir espaços futuros
CREATE OR REPLACE FUNCTION trim_profile_nome()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.nome := TRIM(NEW.nome);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trim_profile_nome
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION trim_profile_nome();
