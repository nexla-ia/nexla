-- ────────────────────────────────────────────────────────────────────────────
-- API RPCs — todas as operações disponíveis via POST com body JSON
-- (em vez de GET com query string, pra não expor parâmetros na URL)
--
-- Uso: POST /rest/v1/rpc/{nome_funcao}
-- Body: { "param1": "valor1", ... }
-- Headers: apikey + Authorization Bearer (anon_key)
--
-- Todas SECURITY DEFINER — bypassam RLS, controlam acesso pelo p_instancia
-- ────────────────────────────────────────────────────────────────────────────

-- ─── PACIENTES ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_pacientes_list(
  p_instancia text,
  p_search    text DEFAULT NULL,
  p_limit     int DEFAULT 100,
  p_offset    int DEFAULT 0
)
RETURNS SETOF saved_contacts
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM saved_contacts
   WHERE instancia = p_instancia
     AND (p_search IS NULL
          OR nome ILIKE '%' || p_search || '%'
          OR numero ILIKE '%' || p_search || '%'
          OR cpf ILIKE '%' || p_search || '%')
   ORDER BY nome ASC
   LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.api_paciente_by_phone(
  p_instancia text,
  p_numero    text
)
RETURNS SETOF saved_contacts
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM saved_contacts
   WHERE instancia = p_instancia AND numero = p_numero
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.api_paciente_create(p_data jsonb)
RETURNS saved_contacts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row saved_contacts;
BEGIN
  INSERT INTO saved_contacts (
    instancia, nome, numero, birthdate, gender, email, phone_secondary,
    address, cpf, rg, profession, social_name, marital_status, blood_type,
    weight, height, legal_guardian, guardian_phone, insurance_plan_id,
    card_number, allergies, chronic_conditions, medications, clinical_notes,
    origem, classificacao_lead, primeiro_contato, photo
  ) VALUES (
    p_data->>'instancia', p_data->>'nome', p_data->>'numero',
    NULLIF(p_data->>'birthdate','')::date, p_data->>'gender', p_data->>'email',
    p_data->>'phone_secondary', p_data->>'address', p_data->>'cpf',
    p_data->>'rg', p_data->>'profession', p_data->>'social_name',
    p_data->>'marital_status', p_data->>'blood_type',
    NULLIF(p_data->>'weight','')::numeric, NULLIF(p_data->>'height','')::numeric,
    p_data->>'legal_guardian', p_data->>'guardian_phone',
    NULLIF(p_data->>'insurance_plan_id','')::uuid, p_data->>'card_number',
    p_data->>'allergies', p_data->>'chronic_conditions', p_data->>'medications',
    p_data->>'clinical_notes', p_data->>'origem', p_data->>'classificacao_lead',
    COALESCE(p_data->>'primeiro_contato','sim'), p_data->>'photo'
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.api_paciente_update(
  p_id   uuid,
  p_data jsonb
)
RETURNS saved_contacts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row saved_contacts;
BEGIN
  UPDATE saved_contacts SET
    nome              = COALESCE(p_data->>'nome', nome),
    birthdate         = COALESCE(NULLIF(p_data->>'birthdate','')::date, birthdate),
    gender            = COALESCE(p_data->>'gender', gender),
    email             = COALESCE(p_data->>'email', email),
    phone_secondary   = COALESCE(p_data->>'phone_secondary', phone_secondary),
    address           = COALESCE(p_data->>'address', address),
    cpf               = COALESCE(p_data->>'cpf', cpf),
    rg                = COALESCE(p_data->>'rg', rg),
    insurance_plan_id = COALESCE(NULLIF(p_data->>'insurance_plan_id','')::uuid, insurance_plan_id),
    card_number       = COALESCE(p_data->>'card_number', card_number),
    allergies         = COALESCE(p_data->>'allergies', allergies),
    chronic_conditions = COALESCE(p_data->>'chronic_conditions', chronic_conditions),
    medications       = COALESCE(p_data->>'medications', medications),
    clinical_notes    = COALESCE(p_data->>'clinical_notes', clinical_notes),
    origem            = COALESCE(p_data->>'origem', origem),
    classificacao_lead = COALESCE(p_data->>'classificacao_lead', classificacao_lead),
    photo             = COALESCE(p_data->>'photo', photo)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.api_paciente_delete(p_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM saved_contacts WHERE id = p_id;
  SELECT TRUE;
$$;

-- ─── MENSAGENS ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_messages_by_phone(
  p_instancia text,
  p_numero    text,
  p_limit     int DEFAULT 20,
  p_only_client boolean DEFAULT false
)
RETURNS SETOF mensagens_geral
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM mensagens_geral
   WHERE instancia = p_instancia
     AND numero = p_numero
     AND (NOT p_only_client OR LOWER(type) = 'cliente')
   ORDER BY id DESC
   LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.api_message_create(p_data jsonb)
RETURNS mensagens_geral
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row mensagens_geral;
BEGIN
  INSERT INTO mensagens_geral (instancia, numero, mensagem, type, "horaLastMessage")
  VALUES (
    p_data->>'instancia', p_data->>'numero', p_data->>'mensagem',
    COALESCE(p_data->>'type', 'ia'),
    COALESCE(p_data->>'horaLastMessage', to_char(now(), 'DD/MM/YYYY HH24:MI:SS'))
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- ─── CONVERSAS / TICKETS ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_conversation_close(
  p_session_id text,
  p_instancia  text,
  p_reason     text
)
RETURNS conversations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row conversations;
BEGIN
  INSERT INTO conversations (session_id, instancia, reason, closed_at)
  VALUES (p_session_id, p_instancia, p_reason, now())
  RETURNING * INTO v_row;
  -- Limpa attendance se existir
  DELETE FROM attendances WHERE numero = p_session_id AND instancia = p_instancia;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.api_conversation_status(
  p_session_id text,
  p_instancia  text
)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'is_open', NOT EXISTS (
      SELECT 1 FROM conversations
       WHERE session_id = p_session_id AND instancia = p_instancia
    ),
    'last_close', (
      SELECT row_to_json(c) FROM conversations c
       WHERE c.session_id = p_session_id AND c.instancia = p_instancia
       ORDER BY c.closed_at DESC LIMIT 1
    )
  );
$$;

-- ─── CATÁLOGO ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_professionals_list(
  p_instancia   text,
  p_only_active boolean DEFAULT true
)
RETURNS SETOF professionals
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM professionals
   WHERE instancia = p_instancia
     AND (NOT p_only_active OR active = true)
   ORDER BY name ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_procedures_list(
  p_instancia   text,
  p_only_active boolean DEFAULT true
)
RETURNS SETOF procedures
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM procedures
   WHERE instancia = p_instancia
     AND (NOT p_only_active OR active = true)
   ORDER BY name ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_insurance_plans_list(
  p_instancia   text,
  p_only_active boolean DEFAULT true
)
RETURNS SETOF insurance_plans
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM insurance_plans
   WHERE instancia = p_instancia
     AND (NOT p_only_active OR active = true)
   ORDER BY name ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_procedure_price(
  p_procedure_id      uuid,
  p_insurance_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'price', COALESCE(
      (SELECT price FROM procedure_prices
        WHERE procedure_id = p_procedure_id
          AND insurance_plan_id = p_insurance_plan_id),
      (SELECT default_price FROM procedures WHERE id = p_procedure_id)
    ),
    'is_default', (
      SELECT NOT EXISTS (
        SELECT 1 FROM procedure_prices
         WHERE procedure_id = p_procedure_id
           AND insurance_plan_id = p_insurance_plan_id
      )
    )
  );
$$;

-- ─── AGENDA ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_agendas_list(p_instancia text)
RETURNS SETOF agendas
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM agendas WHERE instancia = p_instancia ORDER BY name ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_appointments_by_date(
  p_instancia text,
  p_date      date
)
RETURNS SETOF appointments
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM appointments
   WHERE instancia = p_instancia
     AND starts_at >= p_date::timestamptz
     AND starts_at <  (p_date + INTERVAL '1 day')::timestamptz
   ORDER BY starts_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_appointments_by_phone(
  p_instancia text,
  p_phone     text,
  p_limit     int DEFAULT 10
)
RETURNS SETOF appointments
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM appointments
   WHERE instancia = p_instancia AND patient_phone = p_phone
   ORDER BY starts_at DESC
   LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.api_appointments_busy_slots(
  p_instancia       text,
  p_professional_id uuid,
  p_from            timestamptz,
  p_to              timestamptz
)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT starts_at, ends_at FROM appointments
   WHERE instancia = p_instancia
     AND professional_id = p_professional_id
     AND status <> 'cancelado'
     AND starts_at >= p_from
     AND starts_at <  p_to
   ORDER BY starts_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_appointment_create(p_data jsonb)
RETURNS appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row appointments;
BEGIN
  INSERT INTO appointments (
    instancia, agenda_id, professional_id, procedure_id, insurance_plan_id,
    patient_name, patient_phone, starts_at, ends_at, status, payment_status,
    price, notes
  ) VALUES (
    p_data->>'instancia',
    NULLIF(p_data->>'agenda_id','')::uuid,
    NULLIF(p_data->>'professional_id','')::uuid,
    NULLIF(p_data->>'procedure_id','')::uuid,
    NULLIF(p_data->>'insurance_plan_id','')::uuid,
    p_data->>'patient_name', p_data->>'patient_phone',
    (p_data->>'starts_at')::timestamptz,
    (p_data->>'ends_at')::timestamptz,
    COALESCE(p_data->>'status', 'agendado'),
    COALESCE(p_data->>'payment_status', 'pendente'),
    NULLIF(p_data->>'price','')::numeric,
    p_data->>'notes'
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.api_appointment_update_status(
  p_id             uuid,
  p_status         text,
  p_payment_status text DEFAULT NULL
)
RETURNS appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row appointments;
BEGIN
  UPDATE appointments SET
    status         = p_status,
    payment_status = COALESCE(p_payment_status, payment_status)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- ─── ALERTAS ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_alert_create(p_data jsonb)
RETURNS alerts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row alerts;
BEGIN
  INSERT INTO alerts (instancia, "contactName", phone, type, message, resolved)
  VALUES (
    p_data->>'instancia', p_data->>'contactName', p_data->>'phone',
    COALESCE(p_data->>'type', 'help'), p_data->>'message',
    COALESCE((p_data->>'resolved')::boolean, false)
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.api_alerts_pending(p_instancia text)
RETURNS SETOF alerts
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM alerts
   WHERE instancia = p_instancia AND resolved = false
   ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.api_alert_resolve(p_id uuid)
RETURNS alerts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row alerts;
BEGIN
  UPDATE alerts SET resolved = true WHERE id = p_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- ─── KANBAN ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_kanban_columns(p_instancia text)
RETURNS SETOF kanban_columns
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM kanban_columns
   WHERE instancia = p_instancia ORDER BY position ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_kanban_cards(p_instancia text)
RETURNS SETOF kanban_cards
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM kanban_cards
   WHERE instancia = p_instancia ORDER BY position ASC;
$$;

CREATE OR REPLACE FUNCTION public.api_kanban_card_create(p_data jsonb)
RETURNS kanban_cards
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row kanban_cards;
BEGIN
  INSERT INTO kanban_cards (
    instancia, column_id, title, description, priority, due_date, position
  ) VALUES (
    p_data->>'instancia',
    NULLIF(p_data->>'column_id','')::uuid,
    p_data->>'title', p_data->>'description',
    COALESCE(p_data->>'priority', 'normal'),
    NULLIF(p_data->>'due_date','')::date,
    COALESCE((p_data->>'position')::int, 0)
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- ─── GRANTS ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION
  public.api_pacientes_list(text, text, int, int),
  public.api_paciente_by_phone(text, text),
  public.api_paciente_create(jsonb),
  public.api_paciente_update(uuid, jsonb),
  public.api_paciente_delete(uuid),
  public.api_messages_by_phone(text, text, int, boolean),
  public.api_message_create(jsonb),
  public.api_conversation_close(text, text, text),
  public.api_conversation_status(text, text),
  public.api_professionals_list(text, boolean),
  public.api_procedures_list(text, boolean),
  public.api_insurance_plans_list(text, boolean),
  public.api_procedure_price(uuid, uuid),
  public.api_agendas_list(text),
  public.api_appointments_by_date(text, date),
  public.api_appointments_by_phone(text, text, int),
  public.api_appointments_busy_slots(text, uuid, timestamptz, timestamptz),
  public.api_appointment_create(jsonb),
  public.api_appointment_update_status(uuid, text, text),
  public.api_alert_create(jsonb),
  public.api_alerts_pending(text),
  public.api_alert_resolve(uuid),
  public.api_kanban_columns(text),
  public.api_kanban_cards(text),
  public.api_kanban_card_create(jsonb)
TO anon, authenticated;
