-- Mensagem personalizada de lembrete por procedimento
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS reminder_message text;

-- Função que dispara lembretes de agendamento 1 dia antes via webhook
CREATE OR REPLACE FUNCTION public.send_appointment_reminders()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  msg TEXT;
  first_name TEXT;
  appt_time TEXT;
BEGIN
  FOR r IN
    SELECT
      a.id,
      a.instancia,
      a.contact_nome,
      a.contact_numero,
      a.starts_at,
      ag.name AS agenda_name,
      pr.reminder_message AS proc_reminder
    FROM appointments a
    LEFT JOIN agendas ag    ON ag.id = a.agenda_id
    LEFT JOIN procedures pr ON pr.id = a.procedure_id
    WHERE a.starts_at::date = (current_date + 1)
      AND a.status IN ('agendado', 'confirmado')
      AND a.contact_numero IS NOT NULL
      AND a.contact_numero <> ''
  LOOP
    first_name := split_part(r.contact_nome, ' ', 1);
    appt_time  := to_char(r.starts_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM às HH24:MI');

    IF r.proc_reminder IS NOT NULL AND r.proc_reminder <> '' THEN
      msg := replace(r.proc_reminder, '{nome}',   first_name);
      msg := replace(msg,             '{data}',   appt_time);
      msg := replace(msg,             '{agenda}', COALESCE(r.agenda_name, ''));
    ELSE
      msg := 'Olá ' || first_name ||
             ', lembramos que você tem um agendamento amanhã (' || appt_time || ').' ||
             ' Estamos esperando por você!';
    END IF;

    PERFORM net.http_post(
      url     := 'https://n8n.nexladesenvolvimento.com.br/webhook/envioNexla',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := json_build_object(
        'message',        msg,
        'session_id',     r.contact_numero || '@s.whatsapp.net',
        'phone',          r.contact_numero,
        'instancia',      r.instancia,
        'reminder',       true,
        'appointment_id', r.id
      )::jsonb
    );
  END LOOP;
END;
$$;

-- Remove job anterior se existir, depois recria
DO $$
BEGIN
  PERFORM cron.unschedule('appt-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Executa todo dia às 09h horário de Brasília (12:00 UTC, UTC-3)
SELECT cron.schedule('appt-reminders', '0 12 * * *', 'SELECT public.send_appointment_reminders()');
