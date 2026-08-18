// ────────────────────────────────────────────────────────────────────────────
// Fidelidade — fonte única de verdade
//
// Cliente é "novo" enquanto o primeiro contato dele (primeira mensagem já
// registrada no histórico) tiver acontecido há poucos dias — não importa
// quantas mensagens trocou desde então. Contagem de mensagens é frágil:
// uma única troca com a IA já passa de 3-4 mensagens só na saudação inicial,
// então quase ninguém se qualificava como "novo" por mais que alguns minutos.
// ────────────────────────────────────────────────────────────────────────────

export const NEW_CLIENT_MAX_DAYS = 2

export function isNewClient(firstContactTs, now = new Date()) {
  if (!firstContactTs) return false
  const first = new Date(firstContactTs)
  if (isNaN(first.getTime())) return false
  const diffDays = (now.getTime() - first.getTime()) / 86400000
  return diffDays >= 0 && diffDays <= NEW_CLIENT_MAX_DAYS
}
