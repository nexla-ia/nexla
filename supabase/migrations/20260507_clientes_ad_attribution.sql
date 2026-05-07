-- Atribuição de anúncios (Meta Ads / Click-to-WhatsApp).
-- Os campos vêm do contextInfo da Evolution API quando o lead clica em
-- anúncio do Meta com botão WhatsApp. Capturados na primeira mensagem
-- do contato e gravados pelo n8n no insert/update de clientes.
--
-- Campos correspondem ao objeto data.contextInfo do payload Evolution:
--   externalAdReply.title        → ad_title
--   externalAdReply.body         → ad_body
--   externalAdReply.thumbnailUrl → ad_thumbnail_url
--   externalAdReply.mediaUrl     → ad_media_url
--   externalAdReply.sourceUrl    → ad_source_url    (link do post)
--   externalAdReply.sourceType   → ad_source_type   ('ad', 'post', etc.)
--   externalAdReply.ctwaClid     → ad_click_id      (Click-to-WhatsApp Click ID)
--   entryPointConversionExternalSource → ad_platform ('FB_Ads', 'IG_Ads', etc.)
--   entryPointConversionSource   → ad_entry_point   ('ctwa_ad', etc.)

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS ad_platform        TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_type     TEXT,
  ADD COLUMN IF NOT EXISTS ad_entry_point     TEXT,
  ADD COLUMN IF NOT EXISTS ad_title           TEXT,
  ADD COLUMN IF NOT EXISTS ad_body            TEXT,
  ADD COLUMN IF NOT EXISTS ad_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS ad_media_url       TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_url      TEXT,
  ADD COLUMN IF NOT EXISTS ad_click_id        TEXT,
  ADD COLUMN IF NOT EXISTS ad_captured_at     TIMESTAMPTZ;

-- Mesma coisa em saved_contacts (a outra tabela de contatos do painel).
ALTER TABLE public.saved_contacts
  ADD COLUMN IF NOT EXISTS ad_platform        TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_type     TEXT,
  ADD COLUMN IF NOT EXISTS ad_entry_point     TEXT,
  ADD COLUMN IF NOT EXISTS ad_title           TEXT,
  ADD COLUMN IF NOT EXISTS ad_body            TEXT,
  ADD COLUMN IF NOT EXISTS ad_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS ad_media_url       TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_url      TEXT,
  ADD COLUMN IF NOT EXISTS ad_click_id        TEXT,
  ADD COLUMN IF NOT EXISTS ad_captured_at     TIMESTAMPTZ;

-- Índice pra agrupar por anúncio nas Métricas (top campanhas).
CREATE INDEX IF NOT EXISTS idx_clientes_ad_title       ON public.clientes(ad_title)        WHERE ad_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_ad_click_id    ON public.clientes(ad_click_id)     WHERE ad_click_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_contacts_ad_title ON public.saved_contacts(ad_title)  WHERE ad_title IS NOT NULL;
