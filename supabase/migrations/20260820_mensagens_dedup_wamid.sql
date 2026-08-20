-- Remove duplicatas de mensagens com mesmo id_mensagem+instancia, mantendo
-- apenas a linha de menor id (a primeira inserida).
DELETE FROM public.mensagens_geral a
USING public.mensagens_geral b
WHERE a.id_mensagem IS NOT NULL
  AND a.id_mensagem = b.id_mensagem
  AND a.instancia   = b.instancia
  AND a.id          > b.id;

-- Bloqueia inserções futuras com o mesmo wamid na mesma instância.
-- Índice parcial (WHERE NOT NULL) para não conflitar com mensagens sem ID
-- (sistema, atendente, etc.) que chegam com id_mensagem NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mensagens_geral_wamid
  ON public.mensagens_geral (instancia, id_mensagem)
  WHERE id_mensagem IS NOT NULL;
