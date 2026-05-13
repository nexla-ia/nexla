-- Vinculação card ↔ paciente (saved_contacts)
ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS contact_id   UUID REFERENCES saved_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_nome TEXT;

-- Comentários por card
CREATE TABLE IF NOT EXISTS kanban_card_comments (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id    UUID        NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  instancia  TEXT        NOT NULL,
  user_id    UUID,
  user_name  TEXT        NOT NULL,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kcc_card_id   ON kanban_card_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_kcc_instancia ON kanban_card_comments(instancia);
