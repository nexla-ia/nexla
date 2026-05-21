-- Configurações globais de notificações WhatsApp por empresa
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS notify_agenda_created   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_agenda_confirmed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_agenda_cancelled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_agenda_updated   boolean DEFAULT false;
