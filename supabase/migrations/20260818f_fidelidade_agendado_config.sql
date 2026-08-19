-- Fidelidade — configuração de envio passa a ficar no nível da empresa (mensagem
-- + hora agendada), não mais uma linha por cliente gravada pelo clique do
-- atendente. O backend (n8n) decide sozinho pra quem enviar, revarrendo as
-- conversas via api_fidelidade_processar — o botão "Enviar" por linha deixa de
-- existir no frontend.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS fidelidade_agendado_para timestamptz;
