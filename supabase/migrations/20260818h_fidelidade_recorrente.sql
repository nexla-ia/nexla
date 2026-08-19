-- Fidelidade — o agendamento deixou de ser uma data única no futuro e virou
-- recorrente: "todo dia X do mês, às HH:mm". fidelidade_agendado_para (timestamp
-- absoluto) fica obsoleto — mantido na tabela sem uso, sem necessidade de dropar.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS fidelidade_dia_mes smallint, -- 1..31, NULL = sem agendamento (envia sempre)
  ADD COLUMN IF NOT EXISTS fidelidade_hora     text;     -- 'HH:mm', ex: '17:30'
