-- CRM: avança automaticamente a etapa do lead pra "Agendou" (ou equivalente) quando um
-- agendamento é criado na Agenda pro mesmo telefone, na mesma instância.
-- Só avança, nunca regride (se o lead já estiver numa etapa mais adiante, não mexe).

CREATE OR REPLACE FUNCTION crm_advance_on_appointment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_contact  crm_contacts%ROWTYPE;
  v_cur_pos  INTEGER;
  v_target   crm_stages%ROWTYPE;
BEGIN
  IF NEW.contact_numero IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_contact
    FROM crm_contacts
    WHERE instancia = NEW.instancia AND telefone = NEW.contact_numero
    LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_target
    FROM crm_stages
    WHERE funil_id = v_contact.funil_id AND nome ILIKE '%agend%'
    ORDER BY posicao ASC
    LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT posicao INTO v_cur_pos FROM crm_stages WHERE id = v_contact.stage_id;

  -- Só avança: se a etapa atual já está na posição do alvo ou além, não faz nada.
  IF v_cur_pos IS NOT NULL AND v_cur_pos >= v_target.posicao THEN RETURN NEW; END IF;

  UPDATE crm_contacts
    SET stage_id = v_target.id, data_entrada_etapa = now()
    WHERE id = v_contact.id;

  INSERT INTO crm_interactions (instancia, crm_contact_id, telefone, tipo, descricao, created_by_email)
  VALUES (
    NEW.instancia, v_contact.id, v_contact.telefone, 'sistema',
    format('Agendamento criado — etapa avançada automaticamente para "%s"', v_target.nome),
    'Sistema'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_advance_appt ON appointments;
CREATE TRIGGER crm_advance_appt
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION crm_advance_on_appointment();
