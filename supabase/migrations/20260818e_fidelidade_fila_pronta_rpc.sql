-- Fidelidade — RPC que devolve, num único JSON, só quem está pronto pra ser
-- processado agora (não entregue ainda + hora de envio já chegou ou é imediato).
-- Existe pra tirar do n8n a lógica de Filter/IF checando data — o worker só
-- chama isso e já recebe a lista certa pra gerar mensagem e enviar.
CREATE OR REPLACE FUNCTION public.api_fidelidade_fila_pronta(p_instancia text)
RETURNS TABLE (
  id             uuid,
  numero         text,
  nome           text,
  mensagem       text,
  scheduled_for  timestamptz,
  sent_at        timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, numero, nome, mensagem, scheduled_for, sent_at
  FROM public.fidelidade_envios
  WHERE instancia = p_instancia
    AND delivered_at IS NULL
    AND (scheduled_for IS NULL OR scheduled_for <= now())
  ORDER BY sent_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.api_fidelidade_fila_pronta(text) TO anon, authenticated;
