-- Envio de localização no chat (WhatsApp). Sem essa coluna o envio já funciona
-- (mostra texto "📍 Localização"/"📍 Nome do local"); com ela o card fica bonito,
-- com nome/endereço e link "Abrir no mapa".
ALTER TABLE public.mensagens_geral ADD COLUMN IF NOT EXISTS location jsonb;

COMMENT ON COLUMN public.mensagens_geral.location IS 'Localização enviada/recebida no chat: { lat, lng, name?, address? }. Opcional.';
