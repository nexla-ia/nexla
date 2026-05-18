-- Adiciona colunas de controle de notificações WhatsApp por agenda
ALTER TABLE agendas
  ADD COLUMN IF NOT EXISTS notify_created   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_updated   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_cancelled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_confirmed boolean DEFAULT true;
