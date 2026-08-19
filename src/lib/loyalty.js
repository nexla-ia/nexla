// ────────────────────────────────────────────────────────────────────────────
// Fidelidade — fonte única de verdade
//
// Cliente é "novo" quando o primeiro contato dele (primeira mensagem já
// registrada no histórico) caiu dentro do mês de calendário anterior ao atual
// — não importa quantas mensagens trocou desde então. Contagem de mensagens é
// frágil: uma única troca com a IA já passa de 3-4 mensagens só na saudação
// inicial, então quase ninguém se qualificava como "novo" por mais que alguns
// minutos.
//
// Isso é uma janela fixa por mês, não móvel: no dia 1º de cada mês a lista
// pula de uma vez pra quem chegou no mês inteiro anterior, e fica parada até
// o próximo dia 1º.
// ────────────────────────────────────────────────────────────────────────────

export function isNewClient(firstContactTs, now = new Date()) {
  if (!firstContactTs) return false
  const first = new Date(firstContactTs)
  if (isNaN(first.getTime())) return false
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return first >= prevMonthStart && first < thisMonthStart
}
