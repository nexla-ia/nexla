import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GraduationCap, MessageSquare, History, Contact2, Calendar, Kanban, BellRing,
  BarChart3, Stethoscope, Settings2, Sparkles, Check, ArrowRight, Lightbulb,
  PartyPopper, BookOpen, ChevronRight, Bot, Headset, Phone, Star, Zap,
  Mic, Paperclip, FileText, Trophy, Inbox, Users, Flag, Clock, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './CompanyTutorial.css'

const SEEN_KEY = 'nx_tutorial_completed'

// ─── DADOS ───────────────────────────────────────────────────────────────────
const MODULES = [
  {
    key: 'conversas',
    icon: MessageSquare,
    color: '#2563EB',
    bg: '#DBEAFE',
    emoji: '💬',
    title: 'Conversas',
    subtitle: 'O coração do atendimento',
    intro: 'Aqui você vê tudo que chega da sua clínica em tempo real — WhatsApp, Instagram, Digisac, tudo no mesmo lugar.',
    steps: [
      {
        title: 'Três abas para organizar tudo',
        desc: 'Recepção (sob IA, aguardando humano) · Meu Setor (atendimentos seus) · Finalizados (encerrados). A cor da bolinha mostra onde a conversa está.',
      },
      {
        title: 'Assumir uma conversa',
        desc: 'Clica no botão verde "Assumir atendimento". A conversa sai da Recepção e vem para o Meu Setor. Você também pode mandar mensagem direto na Recepção que assume automaticamente.',
      },
      {
        title: 'Mandar texto, áudio, imagem ou PDF',
        desc: 'Use os botões de microfone (🎤) e clipe (📎) ao lado da caixa de texto. Áudio gravado direto pelo navegador, mídia visualizada na conversa.',
        chips: [{ icon: Mic, label: 'Áudio' }, { icon: Paperclip, label: 'Anexo' }, { icon: FileText, label: 'PDF' }],
      },
      {
        title: 'Salvar contato com botão direito',
        desc: 'Clica com o botão direito num número e salva o nome dele. Da próxima vez aparece como "Maria Silva" em vez do telefone.',
      },
      {
        title: 'Finalizar com motivo',
        desc: 'Ao terminar, clica em "Finalizar conversa" e escolhe: Agendado, Resolvido, Encaminhado ou Desistiu. Isso vai virar métrica depois.',
      },
    ],
    tip: 'Tickets sem atividade por 6h fecham automaticamente como "Expirado". Se o paciente voltar, o ticket reabre na Recepção sozinho.',
    cta: { label: 'Abrir Conversas', to: '/painel/conversas' },
  },
  {
    key: 'historico',
    icon: History,
    color: '#7C3AED',
    bg: '#EDE9FE',
    emoji: '🤖',
    title: 'Conversas IA',
    subtitle: 'O histórico completo da IA',
    intro: 'Aqui ficam todas as mensagens que a IA processou — útil para auditar respostas e entender o que sua assistente virtual está dizendo aos pacientes.',
    steps: [
      {
        title: 'Veja só as conversas com IA',
        desc: 'Diferente da aba Conversas, aqui você vê o registro puro do que a IA respondeu. Quando alguém assume o atendimento, as mensagens humanas não aparecem aqui.',
      },
      {
        title: 'Tag "Assumido"',
        desc: 'Conversas que foram para atendente humano ganham essa tag verde. Te ajuda a identificar onde a IA precisou passar o bastão.',
      },
      {
        title: 'Pesquise por número',
        desc: 'Use a busca para encontrar rápido o histórico de um paciente específico.',
      },
    ],
    tip: 'Empresas com IA desativada não veem essa aba — só faz sentido se você usa IA.',
    cta: { label: 'Abrir Conversas IA', to: '/painel/historico' },
  },
  {
    key: 'contatos',
    icon: Contact2,
    color: '#16A34A',
    bg: '#DCFCE7',
    emoji: '📇',
    title: 'Contatos',
    subtitle: 'Sua agenda telefônica inteligente',
    intro: 'Salve pacientes que você atende com frequência. Eles aparecem com nome em vez de número e dão acesso rápido para iniciar conversa.',
    steps: [
      {
        title: 'Salvar pelo botão direito',
        desc: 'Na lista de Conversas, clica com botão direito no contato → "Salvar contato". Coloca nome e notas opcionais.',
      },
      {
        title: 'Botão "Conversar"',
        desc: 'Na aba Contatos, cada paciente tem botão verde "Conversar" que abre o ticket existente ou cria um novo se não houver.',
      },
      {
        title: 'Notas privadas',
        desc: 'Use as notas para anotar coisas tipo "alergia a penicilina", "prefere ser atendida pela tarde" — só sua equipe vê.',
      },
    ],
    tip: 'O nome salvo aparece também na lista de conversas, no header do chat e nos cards de agendamento. Vale investir 30s para nomear cada paciente recorrente.',
    cta: { label: 'Abrir Contatos', to: '/painel/contatos' },
  },
  {
    key: 'agenda',
    icon: Calendar,
    color: '#0891B2',
    bg: '#CFFAFE',
    emoji: '📅',
    title: 'Agenda',
    subtitle: 'Marque consultas direto da plataforma',
    intro: 'Calendário semanal com os agendamentos da clínica. Cria múltiplas agendas (uma por médico ou por sala) com horários, dias e duração de slot configuráveis.',
    steps: [
      {
        title: 'Crie agendas na aba "Agendas"',
        desc: 'Cada agenda tem nome, cor, dias da semana ativos, horário de início/fim e duração de slot (15 a 90 min). Pode vincular a um profissional cadastrado.',
      },
      {
        title: 'Agendar clicando num slot',
        desc: 'No calendário, clica num horário vazio para criar agendamento. Auto-completa nome dos contatos salvos. Selecione profissional + procedimento que o valor vem automático.',
      },
      {
        title: 'Status do agendamento',
        desc: '5 estados: Agendado · Confirmado · Concluído · Faltou · Cancelado. Marcar como Concluído já registra pagamento como Pago.',
      },
      {
        title: 'Validações automáticas',
        desc: 'Não deixa marcar fora do dia/horário do médico, nem dentro do intervalo, nem em conflito com outro paciente do mesmo profissional.',
      },
      {
        title: 'Integração com Conversas',
        desc: 'Cada vez que cria/altera/cancela um agendamento, registra mensagem no chat do paciente. Cancelar manda automaticamente um aviso pelo WhatsApp.',
      },
    ],
    tip: 'Na lista de Conversas aparece uma tag roxa "📅 hoje 14:30" no contato que tem agendamento futuro. Visualmente indica quem espera consulta.',
    cta: { label: 'Abrir Agenda', to: '/painel/agenda' },
  },
  {
    key: 'atividades',
    icon: Kanban,
    color: '#DB2777',
    bg: '#FCE7F3',
    emoji: '📋',
    title: 'Atividades',
    subtitle: 'Quadro Kanban para tarefas internas',
    intro: 'Crie colunas (A Fazer, Em Andamento, Concluído ou o que preferir) e cards de tarefas. Use para checklists internos, follow-up de pacientes, manutenção da clínica.',
    steps: [
      {
        title: 'Crie suas colunas',
        desc: 'Botão "Nova coluna" (só admin). Dá nome e cor. Tem o atalho "Usar padrão" que cria as 3 colunas básicas automaticamente.',
      },
      {
        title: 'Adicionar cards',
        desc: 'Em cada coluna tem botão "Adicionar card". Cada card tem título, descrição, prioridade (Baixa/Normal/Alta/Urgente), data de vencimento e atendente atribuído.',
      },
      {
        title: 'Arrastar entre colunas',
        desc: 'Para mudar de status, segura e arrasta o card. A posição também é salva — você pode reordenar dentro da coluna.',
      },
      {
        title: 'Filtros',
        desc: 'No topo: filtrar por atendente (incluindo "Meus cards" e "Sem atribuição") e por prioridade. Útil quando o quadro fica grande.',
      },
    ],
    tip: 'Cards com data vencida ganham badge vermelho "Atrasado". Use para nunca perder um follow-up importante.',
    cta: { label: 'Abrir Atividades', to: '/painel/atividades' },
  },
  {
    key: 'alertas',
    icon: BellRing,
    color: '#D97706',
    bg: '#FEF3C7',
    emoji: '🔔',
    title: 'Alertas',
    subtitle: 'Avisos da IA e encaminhamentos',
    intro: 'Quando a IA não dá conta, ela manda um alerta para vocês. Quando alguém precisa transferir uma conversa, vira um encaminhamento.',
    steps: [
      {
        title: 'Notificação sonora',
        desc: 'Ative o som no banner amarelo no topo da tela para ser avisado em tempo real quando chega alerta novo.',
      },
      {
        title: 'Encaminhar para colega',
        desc: 'Cada alerta tem botão "Encaminhar". Escolhe um atendente da equipe e ele recebe na tela dele com badge roxa "Encaminhado para você".',
      },
      {
        title: 'Botões de ação rápida',
        desc: 'Em cada alerta tem nome, número (com botão de copiar), atalho para WhatsApp e Digisac (se configurado).',
      },
      {
        title: 'Marcar como resolvido',
        desc: 'Quando lidar com a situação, clica em "Marcar resolvido". Some da fila pendente.',
      },
    ],
    tip: 'Empresas com IA desativada veem só encaminhamentos — alertas gerais da IA não aparecem.',
    cta: { label: 'Abrir Alertas', to: '/painel/alertas' },
  },
  {
    key: 'metricas',
    icon: BarChart3,
    color: '#059669',
    bg: '#D1FAE5',
    emoji: '📊',
    title: 'Métricas',
    subtitle: '6 abas para entender sua operação',
    intro: 'Dashboard completo. Use os filtros de período (Hoje, Ontem, Semana, Mês, Todos) no topo — eles afetam todas as abas.',
    steps: [
      {
        title: 'Visão Geral',
        desc: 'KPIs principais: tickets novos, ativos, finalizados, agendamentos hoje, alertas pendentes, atividades atrasadas. Volume de mensagens por dia.',
      },
      {
        title: 'Atendimento',
        desc: 'Tempo médio até atendimento, duração de ticket, taxa de IA→humano, motivos de encerramento, mensagens por hora.',
      },
      {
        title: 'Equipe',
        desc: 'Ranking de atendentes (com troféu pro top 1) e distribuição por setor.',
      },
      {
        title: 'Agenda',
        desc: 'Confirmação, no-show, cancelamento. Distribuição por status e por dia da semana.',
      },
      {
        title: 'Financeiro',
        desc: 'Faturamento, ticket médio, a receber, perdido em faltas. Ranking por profissional e procedimento. Donut por forma de pagamento.',
      },
      {
        title: 'Leads & Atividades',
        desc: 'Funil de leads (origem, classificação) e visão geral do Kanban.',
      },
    ],
    tip: 'O badge laranja "Atenção" aparece quando algum KPI está em estado crítico (no-show alto, cards atrasados, etc.). Olhe primeiro para esses.',
    cta: { label: 'Abrir Métricas', to: '/painel/metricas' },
  },
  {
    key: 'catalogo',
    icon: Stethoscope,
    color: '#A855F7',
    bg: '#F3E8FF',
    emoji: '🩺',
    title: 'Catálogo Clínico',
    subtitle: 'Médicos, procedimentos e convênios',
    intro: 'Aqui é onde você cadastra a estrutura da clínica. Tudo que cadastrar aparece automaticamente nos modais de agendamento.',
    steps: [
      {
        title: 'Profissionais',
        desc: 'Nome, especialidade, registro (CRM/CRO), cor, dias e horários de atendimento, intervalo (almoço). Tudo isso vira validação na agenda.',
      },
      {
        title: 'Procedimentos',
        desc: 'Tipo (Consulta/Exame/Procedimento), duração padrão e valor particular. Pode ser específico de um profissional ou da clínica toda.',
      },
      {
        title: 'Convênios e valores',
        desc: 'Cadastre os planos aceitos. Em cada procedimento, defina o valor diferenciado por convênio. O sistema usa o valor certo conforme a forma de pagamento escolhida.',
      },
    ],
    tip: 'No agendamento, ao escolher procedimento + convênio, o valor é preenchido automaticamente. Se o paciente pagar diferente, é só editar no campo.',
    cta: { label: 'Abrir Catálogo', to: '/painel/catalogo' },
  },
  {
    key: 'admin',
    icon: Settings2,
    color: '#475569',
    bg: '#E2E8F0',
    emoji: '⚙️',
    title: 'Administração',
    subtitle: 'Conexão, equipe e setores',
    intro: 'Painel de configurações. Visível só para usuários com perfil Admin.',
    steps: [
      {
        title: 'Conexão WhatsApp',
        desc: 'Status da instância em tempo real. Botão "Gerar QR Code" mostra o QR pra escanear no celular. Detecta a conexão automaticamente.',
      },
      {
        title: 'Setores',
        desc: 'Crie setores como "Comercial", "Suporte", "Recepção". Cada conversa atribuída fica visível só para quem é desse setor (admin vê tudo).',
      },
      {
        title: 'Usuários',
        desc: 'Crie acessos para sua equipe (respeitando o limite do seu plano). Defina perfil Admin ou Operador. Pode editar nome, e-mail, senha e excluir.',
      },
    ],
    tip: 'Operadores só veem conversas do setor deles + Recepção. Use isso para organizar grupos de atendimento sem confundir.',
    cta: { label: 'Abrir Administração', to: '/painel/admin' },
  },
]

// ─── COMPONENTE ──────────────────────────────────────────────────────────────
export default function CompanyTutorial() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userKey = session?.user?.email
  const onboardingDone = userKey && localStorage.getItem(`nx_onboarding_done_${userKey}`) === 'true'
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] }
  })
  const [activeKey, setActiveKey] = useState(MODULES[0].key)
  const isAdmin = session?.user?.role === 'admin'
  const aiEnabled = session?.company?.ai_enabled !== false
  const contentRef = useRef(null)

  function finishOnboarding() {
    if (!userKey) return
    localStorage.setItem(`nx_onboarding_done_${userKey}`, 'true')
    navigate('/painel/conversas', { replace: true })
  }

  function skipOnboarding() {
    if (!userKey) return
    if (!confirm('Tem certeza que quer pular o tutorial? Você pode voltar aqui a qualquer momento pelo menu lateral.')) return
    localStorage.setItem(`nx_onboarding_done_${userKey}`, 'true')
    navigate('/painel/conversas', { replace: true })
  }

  // Filtra módulos pelo perfil
  const visibleModules = useMemo(() => {
    return MODULES.filter(m => {
      if (m.key === 'historico' && !aiEnabled) return false
      if ((m.key === 'admin' || m.key === 'catalogo') && !isAdmin) return false
      return true
    })
  }, [isAdmin, aiEnabled])

  const active = visibleModules.find(m => m.key === activeKey) || visibleModules[0]

  function toggleComplete(key) {
    setCompleted(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem(SEEN_KEY, JSON.stringify(next))
      return next
    })
  }

  function selectModule(key) {
    setActiveKey(key)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalCompleted = visibleModules.filter(m => completed.includes(m.key)).length
  const pct = Math.round((totalCompleted / visibleModules.length) * 100)
  const allDone = totalCompleted === visibleModules.length

  return (
    <div className="tut-root">
      {/* Banner de onboarding obrigatório */}
      {!onboardingDone && (
        <div className="tut-onboard-banner">
          <div className="tut-onboard-icon">
            <Sparkles size={16} />
          </div>
          <div className="tut-onboard-text">
            <strong>Bem-vindo à plataforma!</strong>
            <span>Conhece todos os capítulos antes de começar — assim você aproveita o máximo desde o primeiro dia.</span>
          </div>
          <button className="tut-onboard-skip" onClick={skipOnboarding}>
            Pular por agora
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="tut-hero">
        <div className="tut-hero-bg" />
        <div className="tut-hero-content">
          <div className="tut-hero-eyebrow">
            <BookOpen size={14} />
            Manual da plataforma
          </div>
          <h1 className="tut-hero-title">
            Olá, <em>{session?.user?.name?.split(' ')[0] || 'amig@'}!</em><br />
            Vamos dominar a plataforma juntos?
          </h1>
          <p className="tut-hero-sub">
            Cada bloco abaixo é um capítulo do manual. Leia no seu ritmo, marque os
            que terminou e siga em frente. Não tem prova no final, prometo. 🤝
          </p>

          <div className="tut-progress">
            <div className="tut-progress-bar">
              <div className="tut-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="tut-progress-meta">
              <span><strong>{totalCompleted}</strong> de {visibleModules.length} capítulos</span>
              {allDone && (
                <span className="tut-trophy"><Trophy size={13} /> Tudo dominado!</span>
              )}
            </div>
          </div>

          {allDone && !onboardingDone && (
            <button className="tut-finish-btn" onClick={finishOnboarding}>
              <PartyPopper size={16} />
              Concluir tutorial e ir para o painel
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Layout principal */}
      <div className="tut-shell">
        {/* Navegação lateral */}
        <aside className="tut-nav">
          <div className="tut-nav-title">CAPÍTULOS</div>
          {visibleModules.map((m, i) => {
            const done = completed.includes(m.key)
            const isActive = m.key === activeKey
            return (
              <button
                key={m.key}
                onClick={() => selectModule(m.key)}
                className={`tut-nav-item ${isActive ? 'active' : ''} ${done ? 'done' : ''}`}
                style={isActive ? { background: m.bg, borderColor: m.color } : {}}
              >
                <div className="tut-nav-num" style={{ background: done ? m.color : 'transparent', borderColor: m.color, color: done ? '#fff' : m.color }}>
                  {done ? <Check size={11} /> : String(i + 1).padStart(2, '0')}
                </div>
                <div className="tut-nav-info">
                  <div className="tut-nav-name">{m.title}</div>
                  <div className="tut-nav-sub">{m.subtitle}</div>
                </div>
                <ChevronRight size={14} className="tut-nav-arrow" />
              </button>
            )
          })}
        </aside>

        {/* Conteúdo */}
        <main className="tut-content" ref={contentRef}>
          <ModuleGuide
            module={active}
            done={completed.includes(active.key)}
            onToggle={() => toggleComplete(active.key)}
          />
        </main>
      </div>
    </div>
  )
}

// ─── GUIA DO MÓDULO ──────────────────────────────────────────────────────────
function ModuleGuide({ module: m, done, onToggle }) {
  const Icon = m.icon
  return (
    <article className="tut-guide" key={m.key}>
      {/* Cabeçalho colorido */}
      <header className="tut-guide-head" style={{ background: m.bg }}>
        <div className="tut-guide-emoji">{m.emoji}</div>
        <div className="tut-guide-head-content">
          <div className="tut-guide-kicker" style={{ color: m.color }}>
            <Icon size={13} /> {m.subtitle}
          </div>
          <h2 className="tut-guide-title">{m.title}</h2>
          <p className="tut-guide-intro">{m.intro}</p>
        </div>
        <div className="tut-guide-deco" style={{ background: m.color }} />
      </header>

      {/* Passos */}
      <div className="tut-steps">
        {m.steps.map((step, i) => (
          <div key={i} className="tut-step">
            <div className="tut-step-num" style={{ background: m.color }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="tut-step-line" style={{ background: `${m.color}33` }} />
            <div className="tut-step-card">
              <h3 className="tut-step-title">{step.title}</h3>
              <p className="tut-step-desc">{step.desc}</p>
              {step.chips && (
                <div className="tut-step-chips">
                  {step.chips.map((c, j) => (
                    <span key={j} style={{ background: m.bg, color: m.color, borderColor: `${m.color}44` }}>
                      <c.icon size={11} /> {c.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dica em formato post-it */}
      {m.tip && (
        <div className="tut-tip" style={{ '--tip-color': m.color, '--tip-bg': m.bg }}>
          <div className="tut-tip-icon"><Lightbulb size={18} /></div>
          <div>
            <div className="tut-tip-label">Dica de quem usa</div>
            <p className="tut-tip-text">{m.tip}</p>
          </div>
        </div>
      )}

      {/* Footer com CTA + marcar concluído */}
      <footer className="tut-guide-foot">
        <Link to={m.cta.to} className="tut-cta" style={{ background: m.color }}>
          {m.cta.label} <ArrowRight size={15} />
        </Link>
        <button onClick={onToggle} className={`tut-mark ${done ? 'done' : ''}`} style={done ? { background: m.color, borderColor: m.color, color: '#fff' } : {}}>
          {done ? <><Check size={14} /> Capítulo concluído</> : <>Marcar como concluído</>}
        </button>
      </footer>

      {/* Fim do capítulo */}
      <div className="tut-end">
        <div className="tut-end-stars">
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
        </div>
        <span>Fim do capítulo</span>
      </div>
    </article>
  )
}
