-- Fidelidade — atualiza api_fidelidade_processar pra checar dia do mês + hora
-- recorrentes (fidelidade_dia_mes / fidelidade_hora) em vez de uma data única
-- (fidelidade_agendado_para, que ficou obsoleta).
CREATE OR REPLACE FUNCTION public.api_fidelidade_processar(
  p_instancia text,
  p_max_dias  integer DEFAULT 2
)
RETURNS TABLE (
  numero            text,
  nome              text,
  mensagem          text,
  primeiro_contato  timestamptz,
  ultima_interacao  timestamptz,
  total_mensagens   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT
      fidelidade_mensagem AS mensagem,
      fidelidade_dia_mes  AS dia_mes,
      fidelidade_hora     AS hora
    FROM public.companies
    WHERE instance = p_instancia
    LIMIT 1
  ),
  msgs AS (
    SELECT
      numero AS numero_raw,
      public.fidelidade_norm_phone(numero) AS numero_norm,
      nome,
      COALESCE(public.fidelidade_parse_ts("horaLastMessage"), created_at) AS ts
    FROM public.mensagens_geral
    WHERE instancia = p_instancia
      AND numero IS NOT NULL
      AND numero NOT LIKE '%@g.us'
  ),
  ranked AS (
    SELECT
      numero_norm,
      (array_agg(numero_raw ORDER BY ts DESC))[1] AS numero_raw,
      (array_agg(nome ORDER BY ts DESC) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
      MIN(ts) AS primeiro_contato,
      MAX(ts) AS ultima_interacao,
      COUNT(*) AS total_mensagens
    FROM msgs
    GROUP BY numero_norm
  )
  SELECT
    split_part(r.numero_raw, '@', 1) AS numero,
    r.nome,
    cfg.mensagem,
    r.primeiro_contato,
    r.ultima_interacao,
    r.total_mensagens
  FROM ranked r, cfg
  WHERE cfg.mensagem IS NOT NULL AND btrim(cfg.mensagem) <> ''
    AND (
      cfg.dia_mes IS NULL -- sem agendamento = envia sempre que rodar
      OR (
        cfg.dia_mes = extract(day FROM now())::smallint
        AND cfg.hora = to_char(now(), 'HH24:MI')
      )
    )
    AND r.primeiro_contato >= (now() - make_interval(days => p_max_dias))
    AND NOT EXISTS (
      SELECT 1 FROM public.fidelidade_envios fe
      WHERE fe.instancia = p_instancia
        AND public.fidelidade_norm_phone(fe.numero) = r.numero_norm
    )
  ORDER BY r.primeiro_contato DESC;
$$;

GRANT EXECUTE ON FUNCTION public.api_fidelidade_processar(text, integer) TO anon, authenticated;
