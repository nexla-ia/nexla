-- Conversas — persiste quando um atendente marca uma conversa como "não lida"
-- manualmente, pra sobreviver a um reload da página (antes era só estado local
-- em memória, resetava assim que a tela recarregava).
CREATE TABLE IF NOT EXISTS public.conversas_nao_lidas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia       text NOT NULL,
  numero          text NOT NULL,
  marked_at       timestamptz NOT NULL DEFAULT now(),
  marked_by_email text,
  UNIQUE (instancia, numero)
);

CREATE INDEX IF NOT EXISTS idx_conversas_nao_lidas_instancia ON public.conversas_nao_lidas(instancia);

ALTER TABLE public.conversas_nao_lidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_conversas_nao_lidas" ON public.conversas_nao_lidas;
CREATE POLICY "allow_all_conversas_nao_lidas" ON public.conversas_nao_lidas FOR ALL USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas_nao_lidas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
