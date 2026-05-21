-- Adiciona tipo e referência ao agendamento na tabela alerts
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS type          text DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS appointment_id uuid;

-- Função: cria alertas internos para agendamentos que começam em até 45 min
CREATE OR REPLACE FUNCTION create_appointment_alerts()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r         RECORD;
  alert_msg text;
  mins_left int;
BEGIN
  FOR r IN
    SELECT
      a.id,
      a.instancia,
      a.contact_nome,
      a.contact_numero,
      a.starts_at,
      ag.name AS agenda_name
    FROM appointments a
    JOIN agendas ag ON ag.id = a.agenda_id
    WHERE a.status IN ('agendado', 'confirmado')
      AND a.starts_at > NOW()
      AND a.starts_at <= NOW() + INTERVAL '45 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM alerts al
        WHERE al.appointment_id = a.id
          AND al.type = 'agenda'
      )
  LOOP
    mins_left := CEIL(EXTRACT(EPOCH FROM (r.starts_at - NOW())) / 60)::int;

    alert_msg :=
      r.contact_nome
      || ' — agendamento em ' || mins_left || ' min'
      || ', às ' || TO_CHAR(r.starts_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
      || ' (' || r.agenda_name || ')';

    INSERT INTO alerts (instancia, numero, nome, mensagem, resolved, type, appointment_id)
    VALUES (
      r.instancia,
      r.contact_numero,
      r.contact_nome,
      alert_msg,
      false,
      'agenda',
      r.id
    );
  END LOOP;
END;
$$;

-- Agenda cron (remove anterior se existir, evita duplicata)
DO $$ BEGIN PERFORM cron.unschedule('appt-alerts'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('appt-alerts', '*/15 * * * *', 'SELECT create_appointment_alerts()');
