-- Tipo de API WhatsApp por empresa: 'evolution' (padrão) ou 'oficial' (Meta Business API)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS whatsapp_api_type text NOT NULL DEFAULT 'evolution'
    CHECK (whatsapp_api_type IN ('evolution', 'oficial'));
