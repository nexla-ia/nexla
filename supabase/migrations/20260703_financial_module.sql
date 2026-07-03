-- Módulo Financeiro — NEXLA Hub
-- Compatível com o schema do ClinicSac (mesma estrutura, mesmo multi-tenant via instancia)

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia   text NOT NULL,
  nome        text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('receita', 'despesa', 'ambos')),
  cor         text DEFAULT '#6B7280',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia         text NOT NULL,
  tipo              text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  descricao         text NOT NULL,
  valor             numeric(12,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  categoria_id      uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  vencimento        date,
  pagamento_at      date,
  parcela_atual     integer,
  total_parcelas    integer,
  grupo_parcelas    uuid,
  grupo_recorrencia uuid,
  recorrente        boolean DEFAULT false,
  recorrencia_tipo  text,
  forma_pagamento   text,
  contact_id        uuid REFERENCES public.saved_contacts(id) ON DELETE SET NULL,
  contact_nome      text,
  appointment_id    uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  centro_custo      text,
  observacoes       text,
  created_by        text,
  created_at        timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fin_tx_instancia     ON public.financial_transactions(instancia);
CREATE INDEX IF NOT EXISTS idx_fin_tx_vencimento    ON public.financial_transactions(instancia, vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_tx_status        ON public.financial_transactions(instancia, status);
CREATE INDEX IF NOT EXISTS idx_fin_tx_tipo          ON public.financial_transactions(instancia, tipo);
CREATE INDEX IF NOT EXISTS idx_fin_cat_instancia    ON public.financial_categories(instancia);

-- RLS permissivo (segurança feita no frontend via anon key, igual ao resto do sistema)
ALTER TABLE public.financial_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_categories"    ON public.financial_categories;
DROP POLICY IF EXISTS "allow_all_transactions"  ON public.financial_transactions;
CREATE POLICY "allow_all_categories"    ON public.financial_categories    FOR ALL USING (true);
CREATE POLICY "allow_all_transactions"  ON public.financial_transactions  FOR ALL USING (true);

-- Categorias padrão (instancia = '_default_', copiadas para cada empresa no primeiro acesso via frontend)
INSERT INTO public.financial_categories (instancia, nome, tipo, cor) VALUES
  ('_default_', 'Consulta',             'receita', '#16A34A'),
  ('_default_', 'Procedimento',          'receita', '#0891B2'),
  ('_default_', 'Exame',                 'receita', '#7C3AED'),
  ('_default_', 'Produto/Material',      'receita', '#D97706'),
  ('_default_', 'Outro (receita)',        'receita', '#64748B'),
  ('_default_', 'Aluguel',               'despesa', '#DC2626'),
  ('_default_', 'Material clínico',      'despesa', '#EA580C'),
  ('_default_', 'Salário/Pró-labore',    'despesa', '#9333EA'),
  ('_default_', 'Serviços (água/luz/internet)', 'despesa', '#0369A1'),
  ('_default_', 'Marketing',             'despesa', '#DB2777'),
  ('_default_', 'Equipamento',           'despesa', '#475569'),
  ('_default_', 'Imposto/Taxa',          'despesa', '#92400E'),
  ('_default_', 'Outro (despesa)',        'despesa', '#64748B')
ON CONFLICT DO NOTHING;
