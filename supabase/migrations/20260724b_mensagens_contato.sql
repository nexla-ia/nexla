-- Contato (vCard) compartilhado no chat pelo cliente ou pelo atendente. Sem essa coluna
-- a mensagem chega/fica salva normalmente, só sem o cartãozinho bonito com nome/telefone.
ALTER TABLE public.mensagens_geral ADD COLUMN IF NOT EXISTS contato jsonb;

COMMENT ON COLUMN public.mensagens_geral.contato IS 'Contato compartilhado no chat: { name, phone, wa_id?, vcard? }. Preenchido pelo n8n quando a mensagem recebida é do tipo "contacts" (API Oficial) ou "contact" (Evolution). Opcional.';
