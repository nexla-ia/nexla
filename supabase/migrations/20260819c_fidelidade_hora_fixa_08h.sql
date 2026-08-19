-- Fidelidade — horário do disparo automático deixa de ser escolhido por
-- empresa e passa a ser fixo (08:00) pra todo mundo; só o dia do mês continua
-- configurável. Backfill de quem já tinha outro horário salvo.
UPDATE public.companies
SET fidelidade_hora = '08:00'
WHERE fidelidade_dia_mes IS NOT NULL;
