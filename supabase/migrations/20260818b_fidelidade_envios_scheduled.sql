-- Fidelidade — permite agendar o envio pra uma data/hora futura em vez de imediato.
-- O n8n é quem segura a execução até esse horário (ex: node "Wait"); aqui só guardamos
-- pra que status "Agendado" apareça na tela pra qualquer atendente.

ALTER TABLE public.fidelidade_envios
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
