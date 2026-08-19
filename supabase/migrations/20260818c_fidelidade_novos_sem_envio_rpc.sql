-- Fidelidade — RPC pro n8n consultar (via Schedule Trigger diário) quem são os
-- clientes novos que ainda não receberam a mensagem de boas-vindas.
-- Mesma regra de "novo" usada na tela (src/lib/loyalty.js: dias desde o primeiro
-- contato) e mesma tabela de controle de envio (fidelidade_envios) usada pelo
-- botão manual — então o automático e o manual nunca duplicam envio um do outro.

-- horaLastMessage vem como "DD/MM/AAAA HH:mm:ss" (texto, não timestamp) — mesmo
-- parser usado no frontend (src/pages/company/CompanyFidelidade.jsx).
CREATE OR REPLACE FUNCTION public.fidelidade_parse_ts(p_val text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_val IS NULL OR p_val = '' THEN
    RETURN NULL;
  END IF;
  IF p_val ~ '^\d{2}/\d{2}/\d{4}' THEN
    BEGIN
      RETURN to_timestamp(p_val, 'DD/MM/YYYY HH24:MI:SS');
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  BEGIN
    RETURN p_val::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Normaliza número de telefone: tira sufixo de JID (@s.whatsapp.net), tira tudo
-- que não é dígito, e remove o "55" de DDI quando presente — mesma lógica de
-- normPhoneKey() no frontend. Evita duplicar contato por causa de formato.
CREATE OR REPLACE FUNCTION public.fidelidade_norm_phone(p_sid text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(regexp_replace(split_part(p_sid, '@', 1), '\D', '', 'g')) > 10
     AND regexp_replace(split_part(p_sid, '@', 1), '\D', '', 'g') LIKE '55%'
    THEN substring(regexp_replace(split_part(p_sid, '@', 1), '\D', '', 'g') from 3)
    ELSE regexp_replace(split_part(p_sid, '@', 1), '\D', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.api_fidelidade_novos_sem_envio(
  p_instancia text,
  p_max_dias  integer DEFAULT 2
)
RETURNS TABLE (
  numero            text,
  nome              text,
  primeiro_contato  timestamptz,
  ultima_interacao  timestamptz,
  total_mensagens   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH msgs AS (
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
    r.primeiro_contato,
    r.ultima_interacao,
    r.total_mensagens
  FROM ranked r
  WHERE r.primeiro_contato >= (now() - make_interval(days => p_max_dias))
    AND NOT EXISTS (
      SELECT 1 FROM public.fidelidade_envios fe
      WHERE fe.instancia = p_instancia
        AND public.fidelidade_norm_phone(fe.numero) = r.numero_norm
    )
  ORDER BY r.primeiro_contato DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fidelidade_parse_ts(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fidelidade_norm_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_fidelidade_novos_sem_envio(text, integer) TO anon, authenticated;
