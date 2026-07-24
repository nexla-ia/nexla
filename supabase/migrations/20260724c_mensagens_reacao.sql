-- Reação (emoji) do WhatsApp numa mensagem já enviada/recebida. A Cloud API manda a
-- reação como um evento próprio (type: reaction), separado da mensagem original — o n8n
-- não deve inserir uma linha nova, e sim atualizar a linha da mensagem original (casando
-- por id_mensagem) com o emoji recebido.
ALTER TABLE public.mensagens_geral ADD COLUMN IF NOT EXISTS reacao jsonb;

COMMENT ON COLUMN public.mensagens_geral.reacao IS 'Reação (emoji) na mensagem: { emoji, from }. Preenchido pelo n8n via UPDATE (casando reaction.message_id com id_mensagem) quando chega um evento type=reaction. emoji vazio ("") significa reação removida. Opcional.';
