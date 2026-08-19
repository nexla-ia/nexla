-- Fidelidade — view que já vem com a conta pesada feita (agrupar mensagens por
-- número, achar o primeiro contato de cada um). O n8n consulta essa view com
-- "Get many rows" normal, igual faria numa tabela — nunca precisa puxar
-- mensagens_geral inteira pra computar isso no próprio n8n.
CREATE OR REPLACE VIEW public.fidelidade_clientes_novos AS
SELECT
  instancia,
  public.fidelidade_norm_phone(numero) AS numero_norm,
  (array_agg(split_part(numero, '@', 1)
    ORDER BY COALESCE(public.fidelidade_parse_ts("horaLastMessage"), created_at) DESC))[1] AS numero,
  (array_agg(nome
    ORDER BY COALESCE(public.fidelidade_parse_ts("horaLastMessage"), created_at) DESC)
    FILTER (WHERE nome IS NOT NULL))[1] AS nome,
  MIN(COALESCE(public.fidelidade_parse_ts("horaLastMessage"), created_at)) AS primeiro_contato,
  MAX(COALESCE(public.fidelidade_parse_ts("horaLastMessage"), created_at)) AS ultima_interacao,
  COUNT(*) AS total_mensagens
FROM public.mensagens_geral
WHERE numero IS NOT NULL
  AND numero NOT LIKE '%@g.us'
GROUP BY instancia, public.fidelidade_norm_phone(numero);

GRANT SELECT ON public.fidelidade_clientes_novos TO anon, authenticated;
