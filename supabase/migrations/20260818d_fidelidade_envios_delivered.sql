-- Fidelidade — distingue "pedido registrado" (sent_at, gravado pelo site na hora
-- do clique) de "mensagem realmente entregue" (delivered_at, gravado pelo n8n
-- depois do envio de verdade). Sem isso, um Schedule Trigger rodando de novo
-- reprocessaria e reenviaria a mesma linha pra sempre.

ALTER TABLE public.fidelidade_envios
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Índice parcial: acelera exatamente a query que o n8n roda a cada tick
-- ("me dá quem ainda não foi entregue").
CREATE INDEX IF NOT EXISTS idx_fidelidade_envios_pending
  ON public.fidelidade_envios (instancia)
  WHERE delivered_at IS NULL;
