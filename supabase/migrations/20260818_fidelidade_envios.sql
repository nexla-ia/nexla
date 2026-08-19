-- Fidelidade — mensagem configurável e controle de envio pra cliente novo
-- Multi-tenant via `instancia`, mesmo padrão do resto do sistema (RLS permissivo,
-- segurança real feita no frontend via anon key).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS fidelidade_mensagem text;

CREATE TABLE IF NOT EXISTS public.fidelidade_envios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia      text NOT NULL,
  numero         text NOT NULL,
  nome           text,
  mensagem       text,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  sent_by_email  text,
  UNIQUE (instancia, numero)
);

CREATE INDEX IF NOT EXISTS idx_fidelidade_envios_instancia ON public.fidelidade_envios(instancia);

ALTER TABLE public.fidelidade_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_fidelidade_envios" ON public.fidelidade_envios;
CREATE POLICY "allow_all_fidelidade_envios" ON public.fidelidade_envios FOR ALL USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.fidelidade_envios;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
