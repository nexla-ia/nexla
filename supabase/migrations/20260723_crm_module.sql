-- Módulo CRM (Kanban de funil de vendas) — NEXLA Hub
-- Multi-tenant via `instancia`, mesmo padrão do resto do sistema (RLS permissivo,
-- segurança real feita no frontend via anon key).

CREATE TABLE IF NOT EXISTS public.crm_funnels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia   text NOT NULL,
  nome        text NOT NULL,
  posicao     integer NOT NULL DEFAULT 0,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Protege contra corrida: duas abas tentando criar o "Funil Principal" ao mesmo
-- tempo pra mesma instância — a segunda insert falha por violação de unicidade
-- e o frontend refaz o select em vez de duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_funnels_one_default_per_instancia
  ON public.crm_funnels (instancia)
  WHERE is_default;

CREATE TABLE IF NOT EXISTS public.crm_stages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funil_id     uuid NOT NULL REFERENCES public.crm_funnels(id) ON DELETE CASCADE,
  instancia    text NOT NULL, -- denormalizado pra filtro de Realtime sem join
  nome         text NOT NULL,
  cor          text NOT NULL DEFAULT '#6B7280',
  posicao      integer NOT NULL DEFAULT 0,
  alerta_dias  integer NOT NULL DEFAULT 3,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia           text NOT NULL,
  funil_id            uuid NOT NULL REFERENCES public.crm_funnels(id) ON DELETE CASCADE,
  stage_id            uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  contact_id          uuid REFERENCES public.saved_contacts(id) ON DELETE SET NULL,
  nome                text NOT NULL DEFAULT 'Novo lead',
  telefone            text,
  temperatura         text NOT NULL DEFAULT 'morno' CHECK (temperatura IN ('frio', 'morno', 'quente')),
  origem              text,
  tag                 text,
  responsavel_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  responsavel_nome    text,
  data_entrada_etapa  timestamptz NOT NULL DEFAULT now(),
  position            numeric NOT NULL DEFAULT 0,
  created_by_email    text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_interactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia       text NOT NULL,
  crm_contact_id  uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  telefone        text, -- denormalizado pra permitir timeline "por telefone" mesmo se o lead for removido
  tipo            text NOT NULL CHECK (tipo IN ('nota', 'etapa', 'tarefa', 'sistema')),
  descricao       text NOT NULL,
  de_stage_nome   text,
  para_stage_nome text,
  created_by_email text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia   text NOT NULL,
  funil_id    uuid NOT NULL REFERENCES public.crm_funnels(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  filtros     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_funnels_instancia      ON public.crm_funnels(instancia);
CREATE INDEX IF NOT EXISTS idx_crm_stages_instancia       ON public.crm_stages(instancia);
CREATE INDEX IF NOT EXISTS idx_crm_stages_funil           ON public.crm_stages(funil_id, posicao);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_instancia     ON public.crm_contacts(instancia);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_funil         ON public.crm_contacts(funil_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage         ON public.crm_contacts(stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_telefone      ON public.crm_contacts(telefone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_contact_id    ON public.crm_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact   ON public.crm_interactions(crm_contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_telefone  ON public.crm_interactions(telefone);
CREATE INDEX IF NOT EXISTS idx_crm_lists_funil            ON public.crm_lists(funil_id);

-- RLS permissivo (segurança feita no frontend via anon key, igual ao resto do sistema)
ALTER TABLE public.crm_funnels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lists        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_crm_funnels"      ON public.crm_funnels;
DROP POLICY IF EXISTS "allow_all_crm_stages"       ON public.crm_stages;
DROP POLICY IF EXISTS "allow_all_crm_contacts"     ON public.crm_contacts;
DROP POLICY IF EXISTS "allow_all_crm_interactions" ON public.crm_interactions;
DROP POLICY IF EXISTS "allow_all_crm_lists"        ON public.crm_lists;
CREATE POLICY "allow_all_crm_funnels"      ON public.crm_funnels      FOR ALL USING (true);
CREATE POLICY "allow_all_crm_stages"       ON public.crm_stages       FOR ALL USING (true);
CREATE POLICY "allow_all_crm_contacts"     ON public.crm_contacts     FOR ALL USING (true);
CREATE POLICY "allow_all_crm_interactions" ON public.crm_interactions FOR ALL USING (true);
CREATE POLICY "allow_all_crm_lists"        ON public.crm_lists        FOR ALL USING (true);

-- Realtime — habilita explicitamente via migration (não depende da RPC ensure_table_setup,
-- que não está versionada e não garante cobertura de tabelas novas).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_contacts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_stages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
