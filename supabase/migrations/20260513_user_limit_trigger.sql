-- Valor negociado por empresa (substitui preço padrão do plano)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_price_override NUMERIC(10,2);

-- Trigger: bloqueia INSERT em users quando empresa atingiu limite do plano
-- Espelha exatamente a lógica de getEffectiveLimits() em src/lib/planLimits.js
--   Starter  → 5  usuários + extra_users
--   Pro      → 20 usuários + extra_users
--   Business → ilimitado
--   max_users NOT NULL → usa esse valor independente do plano
CREATE OR REPLACE FUNCTION check_user_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_plan        TEXT;
  v_extra_users INT;
  v_max_users   INT;
  v_current     INT;
  v_allowed     INT;
BEGIN
  SELECT plan, COALESCE(extra_users, 0), max_users
    INTO v_plan, v_extra_users, v_max_users
    FROM companies WHERE id = NEW.company_id;

  -- empresa não encontrada: deixa passar (FK vai rejeitar de qualquer forma)
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Business é ilimitado
  IF COALESCE(v_plan, 'Starter') = 'Business' THEN RETURN NEW; END IF;

  -- Override individual tem prioridade máxima
  IF v_max_users IS NOT NULL AND v_max_users > 0 THEN
    v_allowed := v_max_users;
  ELSIF v_plan = 'Pro' THEN
    v_allowed := 20 + v_extra_users;
  ELSE  -- Starter (default)
    v_allowed := 5 + v_extra_users;
  END IF;

  -- Conta usuários existentes (não conta o que está sendo inserido agora)
  SELECT COUNT(*) INTO v_current
    FROM users WHERE company_id = NEW.company_id;

  IF v_current >= v_allowed THEN
    RAISE EXCEPTION
      'Limite de usuários atingido: % de % permitidos no plano %.',
      v_current, v_allowed, COALESCE(v_plan, 'Starter')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_user_limit ON users;
CREATE TRIGGER trg_check_user_limit
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION check_user_limit();
