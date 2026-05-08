import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LimitReachedModal from '../../components/LimitReachedModal'
import { getEffectiveLimits, upgradeMessage } from '../../lib/planLimits'
import {
  Users, MessageSquare, TrendingUp, Clock, Inbox, BarChart2, RefreshCw,
  Calendar, BellRing, Kanban, Headset, CheckCircle2, XCircle, AlertCircle,
  Phone, Bot, ListChecks, Flag, ChevronRight, Layers, DollarSign, Stethoscope, Lock, X,
  Sparkles, Megaphone, Filter, AlertTriangle, AlertOctagon, UserPlus,
} from 'lucide-react'
import './Company.css'

// ─── Inferência de origem do lead ─────────────────────────────────────────
// Roda nas primeiras mensagens do cliente. Ordem importa: Indicação ANTES de
// Instagram/Google porque "minha amiga viu no Insta" deve cair em Indicação.
// Frases-gatilho comuns em PT-BR: "vim através de/do/pelo X", "achei no X",
// "vi no X", "encontrei no X", "pesquisei no X", "fui indicado por", etc.
const ORIGEM_PATTERNS = [
  { origem: 'Indicação', re: /\b(indica[cç][aã]o|indic(ou|aram|ada?|ado)|fui\s+indicad|me\s+indic\w*|me\s+passaram|me\s+passou|amig[ao]\s+(me\s+)?(indic|fal|disse|recomend)|conhec\w+\s+(me\s+)?(indic|fal|recomend)|recomend\w+\s+(por|pelo|pela)|por\s+indica|veio\s+por\s+indica)/i },
  { origem: 'Instagram', re: /\b(instagram|\binsta\b|stories?\b|\bstory\b|@[a-z0-9._-]{3,}|\big\b|vi(m)?\s+(no|do|pelo|seu|sua)\s+(insta|instagram|stories?|story|post)|publica[cç][aã]o de voc|reels?\b|atrav[eé]s\s+do\s+(insta|instagram))/i },
  { origem: 'Google',    re: /\b(google|pesqui[sz]\w+|achei\s+no\s+google|encontrei\s+no\s+google|fui\s+no\s+google|busca\s+(no|do)|\bgoogl|\bmaps\b|atrav[eé]s\s+do\s+google|pelo\s+google|na\s+internet|na\s+pesquisa)/i },
  { origem: 'Facebook',  re: /\b(facebook|\bfb\b|atrav[eé]s\s+do\s+(face|facebook)|pelo\s+(face|facebook)|vi(m)?\s+no\s+(face|facebook))/i },
  { origem: 'TikTok',    re: /\btik\s*tok\b|atrav[eé]s\s+do\s+tiktok|pelo\s+tiktok|vi(m)?\s+no\s+tiktok/i },
  { origem: 'YouTube',   re: /\b(youtube|canal\s+d[oae]|v[ií]deo\s+(do|de|deles)|seu\s+canal|atrav[eé]s\s+do\s+youtube|pelo\s+youtube)/i },
  { origem: 'Site',      re: /\b(atrav[eé]s\s+(do|de)\s+site|pelo\s+site|do\s+site|no\s+site|achei\s+no\s+site|encontrei\s+no\s+site|vi(m)?\s+(do|pelo|no)\s+site|site\s+(de\s+voc|da\s+cl[íi]nica|do\s+consult|de\s+v[oô]s)|seu\s+site|via\s+site|p[aá]gina\s+(da|de)\s+voc)/i },
  { origem: 'Anúncio',   re: /\b(an[uú]nci\w*|patrocinad\w+|propaganda|panfleto|outdoor|\btv\b\s+(da|do)|vi\s+um\s+an[uú]ncio|atrav[eé]s\s+do\s+an[uú]ncio|pelo\s+an[uú]ncio)/i },
  { origem: 'WhatsApp Business', re: /\b(perfil\s+do\s+whats|status\s+do\s+whats|cat[áa]logo\s+do\s+whats|whats\s+business|link\s+do\s+whats)/i },
]

function inferOrigem(messages) {
  if (!messages || !messages.length) return null
  const text = messages.map(m => (m.mensagem || '').toLowerCase()).join(' \n ')
  for (const { origem, re } of ORIGEM_PATTERNS) {
    if (re.test(text)) return origem
  }
  return null
}

// Normaliza variações textuais para forma canônica.
// Ex: 'instagram', 'INSTA', 'Vi no insta' → 'Instagram'
//     'conhecido', 'minha amiga indicou', 'Indicação de uma amiga' → 'Indicação'
// Se não casar com nenhum padrão, devolve texto original com Title Case.
// Mapeamento direto de valores comuns que aparecem crus no banco e devem
// fundir em buckets canônicos (evita 'Conhecido' ficar separado de 'Indicação').
const ORIGEM_DIRECT_MAP = {
  // Indicação
  'conhecido': 'Indicação',
  'conhecida': 'Indicação',
  'conhecidos': 'Indicação',
  'conhecidas': 'Indicação',
  'amigo': 'Indicação',
  'amiga': 'Indicação',
  'familia': 'Indicação',
  'família': 'Indicação',
  'parente': 'Indicação',
  // Paciente recorrente
  'paciente antigo': 'Paciente antigo',
  'paciente antiga': 'Paciente antigo',
  'paciente já atendido': 'Paciente antigo',
  'paciente ja atendido': 'Paciente antigo',
  'paciente fixo': 'Paciente antigo',
  'cliente antigo': 'Paciente antigo',
  'cliente fixo': 'Paciente antigo',
  'retorno': 'Paciente antigo',
}

function normalizeOrigem(raw) {
  if (!raw || !String(raw).trim() || /desconhecid|n[aã]o informad|sem rastreio/i.test(raw)) {
    return 'WhatsApp · sem rastreio'
  }
  const text = String(raw).trim().toLowerCase()
  // 'whatsapp', 'wpp', 'zap' isolado também é canal sem rastreio (a conversa
  // já está no WhatsApp, não acrescenta info de origem real do lead).
  if (/^(whats\s*app|whatsapp|wpp|zap|zap\s*zap)$/i.test(text)) {
    return 'WhatsApp · sem rastreio'
  }
  // Mapeamento direto antes dos patterns
  if (ORIGEM_DIRECT_MAP[text]) return ORIGEM_DIRECT_MAP[text]
  for (const { origem, re } of ORIGEM_PATTERNS) {
    if (re.test(text)) return origem
  }
  // fallback: Title Case do texto (capitaliza a primeira letra de cada palavra)
  return raw.trim().replace(/\b(\p{L})(\p{L}*)/gu, (_, a, b) => a.toUpperCase() + b.toLowerCase())
}

// ─── Períodos ────────────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'hoje',         label: 'Hoje' },
  { key: 'ontem',        label: 'Ontem' },
  { key: 'semana',       label: 'Semana' },
  { key: 'mes',          label: 'Mês' },
  { key: 'todos',        label: 'Todos' },
  { key: 'personalizado',label: 'Personalizado' },
]

function getPeriodRange(period, custom) {
  const now = new Date()
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (period === 'hoje')   return { from: startOf(now), to: null }
  if (period === 'ontem')  { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: startOf(y), to: new Date(startOf(now) - 1) } }
  if (period === 'semana') { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: startOf(d), to: null } }
  if (period === 'mes')    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null }
  if (period === 'personalizado' && custom?.from) {
    const f = new Date(custom.from + 'T00:00:00')
    const t = custom.to ? new Date(custom.to + 'T23:59:59') : null
    return { from: f, to: t }
  }
  return { from: null, to: null }
}

function periodLabel(period) {
  return ({ hoje: 'hoje', ontem: 'ontem', semana: 'esta semana', mes: 'este mês', todos: 'no total' })[period] || ''
}

function inPeriod(ts, from, to) {
  if (!ts) return false
  const d = new Date(ts)
  if (isNaN(d.getTime())) return false
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '—'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  if (h < 24) return `${h}h ${m}min`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

// Status de lead — agora computado automaticamente pela posição no funil
// Mantém os labels antigos (Curioso/Quente/Interessado/Cliente/Inativo) pra não quebrar
// dados antigos. Novos leads recebem os valores em snake_case abaixo.
const CLASSIF_COLORS = {
  // ── Auto (preferidos)
  'novo':            { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', label: 'Novo' },
  'em_atendimento':  { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'Em atendimento' },
  'agendado':        { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Agendado' },
  'encerrado':       { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', label: 'Encerrado' },
  'perdido':         { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Perdido' },
  // ── Legados (mantidos pra retro-compat)
  'Curioso':    { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
  'Interessado':{ color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  'Quente':     { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  'Cliente':    { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  'Inativo':    { color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
}

const STATUS_ORDER = ['novo', 'em_atendimento', 'agendado', 'encerrado', 'perdido']

// Computa status do lead automaticamente. Ordem importa:
//   1. Tem appointment ativo (não cancelado) → 'agendado'
//   2. Conversa encerrada com 'desistiu' ou 'auto_encerrado' → 'perdido'
//   3. Outras conversas encerradas (resolvido, encaminhado) → 'encerrado'
//   4. Alguém respondeu (IA ou humano) → 'em_atendimento'
//   5. Default → 'novo'
function computeLeadStatus({ lead, msgsByPhone, apptsByPhone, convBySession }) {
  const phone = (lead.numero || '').replace(/@.*$/, '').replace(/\D/g, '')
  const myAppts = apptsByPhone[phone] || []
  const hasActiveAppt = myAppts.some(a => a.status && a.status !== 'cancelado')
  if (hasActiveAppt) return 'agendado'

  const conv = convBySession[lead.numero] || convBySession[phone]
  if (conv) {
    if (conv.reason === 'desistiu' || conv.reason === 'auto_encerrado') return 'perdido'
    return 'encerrado'
  }

  const myMsgs = msgsByPhone[phone] || []
  const hasResponse = myMsgs.some(m => {
    const t = (m.type || '').toLowerCase()
    return t === 'ia' || t === 'humano'
  })
  if (hasResponse) return 'em_atendimento'

  return 'novo'
}
const ORIGEM_COLORS = ['#2563EB','#16A34A','#F59E0B','#7C3AED','#DC2626','#0891B2','#D97706','#059669']

const REASON_META = {
  agendado:       { label: 'Agendado',    color: '#16A34A' },
  resolvido:      { label: 'Resolvido',   color: '#2563EB' },
  encaminhado:    { label: 'Encaminhado', color: '#7C3AED' },
  desistiu:       { label: 'Desistiu',    color: '#DC2626' },
  auto_encerrado: { label: 'Expirado',    color: '#6B7280' },
}

const APPT_STATUS = {
  agendado:   { label: 'Agendado',   color: '#2563EB' },
  confirmado: { label: 'Confirmado', color: '#16A34A' },
  concluido:  { label: 'Concluído',  color: '#0891B2' },
  faltou:     { label: 'Faltou',     color: '#D97706' },
  cancelado:  { label: 'Cancelado',  color: '#DC2626' },
}

const PRIORITY_META = {
  baixa:   { label: 'Baixa',   color: '#6B7280' },
  normal:  { label: 'Normal',  color: '#2563EB' },
  alta:    { label: 'Alta',    color: '#D97706' },
  urgente: { label: 'Urgente', color: '#DC2626' },
}

const TABS = [
  { key: 'overview',    label: 'Visão Geral',  icon: BarChart2 },
  { key: 'atendimento', label: 'Atendimento',  icon: MessageSquare },
  { key: 'equipe',      label: 'Equipe',       icon: Users },
  { key: 'agenda',      label: 'Agenda',       icon: Calendar },
  { key: 'financeiro',  label: 'Financeiro',   icon: DollarSign },
  { key: 'leads',       label: 'Leads',        icon: TrendingUp },
  { key: 'atividades',  label: 'Kanban',       icon: Kanban },
]

function fmtMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Página principal ────────────────────────────────────────────────────────
// Props opcionais (usadas pelo ADM Análise 360°):
//   companyOverride: substitui session.company (pra ver métricas de outra empresa)
//   hideHeader: esconde o título 'Métricas' + botão Atualizar
export default function CompanyMetrics({ companyOverride = null, hideHeader = false } = {}) {
  const { session } = useAuth()
  const company = companyOverride || session?.company
  const instance      = company?.instance
  const companyId     = company?.id
  const contactsTable = company?.contacts_table
  const aiEnabled     = company?.ai_enabled !== false
  const limits        = getEffectiveLimits(company)
  // No modo ADM (companyOverride), libera todas as abas — admin vê tudo.
  const advancedAllowed = companyOverride ? true : limits.advanced_metrics
  const ADVANCED_TABS  = ['equipe', 'financeiro']

  // Persiste filtro de período por usuário+empresa entre sessões
  const filterKey = `nx_metrics_filter_${companyId || 'def'}`
  const [period, setPeriod]   = useState(() => {
    try {
      const raw = localStorage.getItem(filterKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.period) return parsed.period
      }
    } catch {}
    return 'semana'
  })
  const [customRange, setCustomRange] = useState(() => {
    try {
      const raw = localStorage.getItem(filterKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        return parsed.customRange || { from: '', to: '' }
      }
    } catch {}
    return { from: '', to: '' }
  })

  // Salva sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem(filterKey, JSON.stringify({ period, customRange }))
    } catch {}
  }, [filterKey, period, customRange])
  const [tab, setTab]         = useState('overview')
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [limitModal, setLimitModal] = useState(null)

  const [msgs, setMsgs]                 = useState([])
  const [convs, setConvs]               = useState([])
  const [atts, setAtts]                 = useState([])
  const [appts, setAppts]               = useState([])
  const [alerts, setAlerts]             = useState([])
  const [kanbanCards, setKanbanCards]   = useState([])
  const [kanbanColumns, setKanbanColumns] = useState([])
  const [users, setUsers]               = useState([])
  const [sectors, setSectors]           = useState([])
  const [sectorMembers, setSectorMembers] = useState([])
  const [leads, setLeads]               = useState([])
  const [professionals, setProfessionals] = useState([])
  const [procedures, setProcedures]     = useState([])
  const [insurancePlans, setInsurancePlans] = useState([])

  async function load() {
    if (!instance) return
    setLoading(true)
    const queries = [
      supabase.from('mensagens_geral').select('id, numero, type, mensagem, "horaLastMessage", created_at').eq('instancia', instance).order('id', { ascending: false }).limit(20000),
      supabase.from('conversations').select('*').eq('instancia', instance),
      supabase.from('attendances').select('*').eq('instancia', instance),
      supabase.from('appointments').select('*, agendas(name, color)').eq('instancia', instance),
      supabase.from('alerts').select('*').eq('instancia', instance),
      supabase.from('kanban_cards').select('*').eq('instancia', instance),
      supabase.from('kanban_columns').select('*').eq('instancia', instance).order('position'),
      supabase.from('users').select('id, name, email, role, active').eq('company_id', companyId),
      supabase.from('sectors').select('*').eq('instancia', instance),
      supabase.from('sector_members').select('*'),
      supabase.from('professionals').select('*').eq('instancia', instance),
      supabase.from('procedures').select('*').eq('instancia', instance),
      supabase.from('insurance_plans').select('*').eq('instancia', instance),
    ]
    if (contactsTable) queries.push(supabase.from(contactsTable).select('*').eq('instancia', instance))

    const results = await Promise.all(queries)
    setMsgs(results[0].data || [])
    setConvs(results[1].data || [])
    setAtts(results[2].data || [])
    setAppts(results[3].data || [])
    setAlerts(results[4].data || [])
    setKanbanCards(results[5].data || [])
    setKanbanColumns(results[6].data || [])
    setUsers((results[7].data || []).filter(u => u.active !== false))
    setSectors(results[8].data || [])
    setSectorMembers(results[9].data || [])
    setProfessionals(results[10].data || [])
    setProcedures(results[11].data || [])
    setInsurancePlans(results[12].data || [])
    const leadsData = contactsTable ? (results[13].data || []) : []
    setLeads(leadsData)
    setLastRefresh(new Date())
    setLoading(false)

    // Inferência automática de origem para leads sem origem definida.
    // Lê primeiras mensagens cliente, detecta canal por palavra-chave, atualiza banco silenciosamente.
    if (contactsTable && leadsData.length) {
      const msgsAll = results[0].data || []
      const semOrigem = leadsData.filter(l => !l.origem || l.origem === '' || /desconhecid/i.test(l.origem))
      if (semOrigem.length) {
        const updates = []
        for (const lead of semOrigem) {
          const leadMsgs = msgsAll
            .filter(m => m.numero === lead.numero && (m.type || '').toLowerCase() === 'cliente')
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .slice(0, 5)
          const inferred = inferOrigem(leadMsgs)
          if (inferred) updates.push({ id: lead.id, origem: inferred })
        }
        if (updates.length) {
          await Promise.all(updates.map(u =>
            supabase.from(contactsTable).update({ origem: u.origem }).eq('id', u.id)
          ))
          setLeads(prev => prev.map(l => {
            const u = updates.find(x => x.id === l.id)
            return u ? { ...l, origem: u.origem } : l
          }))
        }
      }

      // Classificação automática de status (novo / em_atendimento / agendado / encerrado / perdido)
      // Roda em todos os leads, atualiza só onde o valor mudou.
      const allMsgs  = results[0].data || []
      const allConvs = results[1].data || []
      const allAppts = results[3].data || []

      const msgsByPhone = {}
      allMsgs.forEach(m => {
        const p = (m.numero || '').replace(/@.*$/, '').replace(/\D/g, '')
        if (!p) return
        if (!msgsByPhone[p]) msgsByPhone[p] = []
        msgsByPhone[p].push(m)
      })
      const apptsByPhone = {}
      allAppts.forEach(a => {
        const p = (a.patient_phone || '').replace(/@.*$/, '').replace(/\D/g, '')
        if (!p) return
        if (!apptsByPhone[p]) apptsByPhone[p] = []
        apptsByPhone[p].push(a)
      })
      const convBySession = {}
      allConvs.forEach(c => { convBySession[c.session_id] = c })

      const statusUpdates = []
      for (const lead of leadsData) {
        const newStatus = computeLeadStatus({ lead, msgsByPhone, apptsByPhone, convBySession })
        const current = lead.classificacao_lead
        // Só atualiza se diferente E (status atual está vazio OU é um valor auto)
        const isAutoValue = !current || STATUS_ORDER.includes(current)
        if (isAutoValue && current !== newStatus) {
          statusUpdates.push({ id: lead.id, classificacao_lead: newStatus })
        }
      }
      if (statusUpdates.length) {
        await Promise.all(statusUpdates.map(u =>
          supabase.from(contactsTable).update({ classificacao_lead: u.classificacao_lead }).eq('id', u.id)
        ))
        setLeads(prev => prev.map(l => {
          const u = statusUpdates.find(x => x.id === l.id)
          return u ? { ...l, classificacao_lead: u.classificacao_lead } : l
        }))
      }
    }
  }

  useEffect(() => { load() }, [instance, companyId, contactsTable])

  // Range do período ativo
  const range = useMemo(() => getPeriodRange(period, customRange), [period, customRange])

  return (
    <div className="page-enter" style={{ padding: hideHeader ? 0 : '1.5rem' }}>
      {/* Header — só fora do modo embed do ADM */}
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Métricas</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {lastRefresh ? `Atualizado às ${lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Carregando...'}
            </div>
          </div>
          <button className="nx-btn-ghost" style={{ fontSize: 12 }} onClick={load} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>
      )}

      {/* Filtros de período */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              padding: '7px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${period === p.key ? '#2563EB' : 'var(--border)'}`,
              background: period === p.key ? '#2563EB' : '#fff',
              color: period === p.key ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: period === p.key ? '0 1px 4px rgba(37,99,235,0.3)' : 'none',
            }}>{p.label}</button>
        ))}
        {period === 'personalizado' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            marginLeft: 6, padding: '4px 10px',
            background: '#EFF6FF', border: '1.5px solid #BFDBFE',
            borderRadius: 20,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', letterSpacing: '0.04em', textTransform: 'uppercase' }}>De</span>
            <input
              type="date"
              value={customRange.from}
              onChange={e => setCustomRange(p => ({ ...p, from: e.target.value }))}
              style={{
                border: 'none', background: 'transparent',
                fontSize: 12, color: '#1E40AF', fontWeight: 600,
                fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF' }}>→</span>
            <input
              type="date"
              value={customRange.to}
              onChange={e => setCustomRange(p => ({ ...p, to: e.target.value }))}
              style={{
                border: 'none', background: 'transparent',
                fontSize: 12, color: '#1E40AF', fontWeight: 600,
                fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
              }}
            />
            {(customRange.from || customRange.to) && (
              <button
                onClick={() => setCustomRange({ from: '', to: '' })}
                title="Limpar"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#1E40AF', display: 'inline-flex', padding: 2,
                }}
              ><X size={11} /></button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {TABS.filter(t => aiEnabled || t.key !== 'leads' || contactsTable).map(t => {
          const locked = !advancedAllowed && ADVANCED_TABS.includes(t.key)
          return (
            <button key={t.key} onClick={() => {
              if (locked) {
                setLimitModal(upgradeMessage('advanced_metrics', null, limits.plan))
                return
              }
              setTab(t.key)
            }}
              title={locked ? `Disponível a partir do plano Pro` : ''}
              style={{
                padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === t.key ? '2px solid #2563EB' : '2px solid transparent',
                color: tab === t.key ? '#2563EB' : (locked ? '#94A3B8' : 'var(--text-secondary)'),
                fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: -1,
                opacity: locked ? 0.6 : 1,
              }}>
              {locked ? <Lock size={12} /> : <t.icon size={14} />} {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview'    && <OverviewTab    {...{ msgs, convs, atts, appts, alerts, kanbanCards, range, period, loading }} />}
      {tab === 'atendimento' && <AtendimentoTab {...{ msgs, convs, atts, range, period, loading }} />}
      {tab === 'equipe'      && <EquipeTab      {...{ msgs, convs, atts, users, sectors, sectorMembers, range, period, loading }} />}
      {tab === 'agenda'      && <AgendaTab      {...{ appts, range, period, loading }} />}
      {tab === 'financeiro'  && <FinanceiroTab  {...{ appts, professionals, procedures, insurancePlans, range, period, loading }} />}
      {tab === 'leads'       && <LeadsTab       {...{ leads, appts, msgs, range, period, loading, contactsTable }} />}
      {tab === 'atividades'  && <AtividadesTab  {...{ kanbanCards, kanbanColumns, users, range, period, loading }} />}

      <LimitReachedModal
        open={!!limitModal}
        title={limitModal?.title}
        body={limitModal?.body}
        cta={limitModal?.cta}
        planName={limits.plan}
        onClose={() => setLimitModal(null)}
      />
    </div>
  )
}

// ─── Tab: Visão Geral ───────────────────────────────────────────────────────
function OverviewTab({ msgs, convs, atts, appts, alerts, kanbanCards, range, period, loading }) {
  const { from, to } = range
  const m = msgs.filter(x => inPeriod(x.created_at, from, to))
  const c = convs.filter(x => inPeriod(x.closed_at, from, to))

  // Tickets novos: primeiro registro de cada numero dentro do período
  const firstByNumero = useMemo(() => {
    const seen = {}
    const sorted = [...msgs].sort((a, b) => a.id - b.id)
    sorted.forEach(x => { if (!seen[x.numero]) seen[x.numero] = x.created_at })
    return seen
  }, [msgs])
  const ticketsNovos = Object.values(firstByNumero).filter(ts => inPeriod(ts, from, to)).length

  // Tickets ativos: tem mensagem mas não fechado e não atribuído
  const closedSet = new Set(convs.map(c => c.session_id))
  const attSet = new Set(atts.map(a => a.numero))
  const allNumbers = new Set(msgs.map(x => x.numero).filter(Boolean))
  const ticketsAtivos = [...allNumbers].filter(n => !closedSet.has(n) && !attSet.has(n)).length

  // Hoje agendamentos
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1)
  const apptsHoje = appts.filter(a => {
    const d = new Date(a.starts_at)
    return d >= todayStart && d < todayEnd && a.status !== 'cancelado'
  }).length

  const alertasPend = alerts.filter(a => !a.resolved).length
  const cardsAtrasados = kanbanCards.filter(c => c.due_date && new Date(`${c.due_date}T23:59:59`) < new Date()).length

  // Volume mensagens por dia
  const dayVolume = useMemo(() => {
    const map = {}
    m.forEach(x => {
      if (!x.created_at) return
      const d = new Date(x.created_at)
      const k = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      map[k] = (map[k] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => {
      const parse = s => { const [d, mo] = s.split('/'); return new Date(2026, +mo - 1, +d) }
      return parse(a[0]) - parse(b[0])
    })
  }, [m])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard icon={<Inbox size={18} color="#2563EB" />} bg="#EFF6FF" value={ticketsNovos} label="Tickets novos" sub={periodLabel(period)} loading={loading} />
        <KpiCard icon={<MessageSquare size={18} color="#7C3AED" />} bg="#F5F3FF" value={ticketsAtivos} label="Tickets ativos" sub="aguardando atendimento" loading={loading} />
        <KpiCard icon={<CheckCircle2 size={18} color="#16A34A" />} bg="#F0FDF4" value={c.length} label="Tickets finalizados" sub={periodLabel(period)} loading={loading} />
        <KpiCard icon={<Calendar size={18} color="#0891B2" />} bg="#ECFEFF" value={apptsHoje} label="Agendamentos hoje" sub="exceto cancelados" loading={loading} />
        <KpiCard icon={<BellRing size={18} color="#D97706" />} bg="#FFFBEB" value={alertasPend} label="Alertas pendentes" sub="aguardando resolução" loading={loading} alert={alertasPend > 0} />
        <KpiCard icon={<AlertCircle size={18} color="#DC2626" />} bg="#FEF2F2" value={cardsAtrasados} label="Atividades atrasadas" sub="data vencida" loading={loading} alert={cardsAtrasados > 0} />
      </div>

      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Clock size={15} color="#2563EB" />
          <div style={{ fontWeight: 700, fontSize: 14 }}>Mensagens por dia</div>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{periodLabel(period)}</span>
        </div>
        <BarTimeline data={dayVolume} />
      </div>
    </div>
  )
}

// ─── Tab: Atendimento ───────────────────────────────────────────────────────
function medianMs(arr) { if (!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2 }
function p90Ms(arr)    { if (!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[Math.min(Math.floor(s.length*0.9), s.length-1)] }
function slaColor(ms) {
  if (!ms) return '#94A3B8'
  if (ms < 5*60*1000)  return '#16A34A'
  if (ms < 30*60*1000) return '#D97706'
  return '#DC2626'
}

function AtendimentoTab({ msgs, convs, atts, range, period, loading }) {
  const { from, to } = range
  const closedInPeriod = convs.filter(c => inPeriod(c.closed_at, from, to))

  // Motivos de encerramento
  const reasonsMap = useMemo(() => {
    const map = {}
    closedInPeriod.forEach(c => { map[c.reason || 'outro'] = (map[c.reason || 'outro'] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [closedInPeriod])

  // Indexa mensagens por numero ordenadas asc
  const msgsByNumero = useMemo(() => {
    const map = {}
    msgs.forEach(m => {
      if (!m.numero) return
      if (!map[m.numero]) map[m.numero] = []
      map[m.numero].push(m)
    })
    Object.values(map).forEach(s => s.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
    return map
  }, [msgs])

  // Sessões encerradas como Set (pra pendentes)
  const closedSet = useMemo(() => new Set(convs.map(c => c.session_id)), [convs])

  // Métricas por sessão: tempo até IA, tempo até humano, pendente atual
  const sessionMetrics = useMemo(() => {
    return Object.entries(msgsByNumero).map(([numero, sMsgs]) => {
      const last = sMsgs[sMsgs.length - 1]
      const lastType = (last?.type || '').toLowerCase()
      const isClosed = closedSet.has(numero)
      const isPending = !isClosed && lastType === 'cliente'
      const waitingMs = isPending && last ? (Date.now() - new Date(last.created_at).getTime()) : 0

      const firstCliIdx = sMsgs.findIndex(m => (m.type || '').toLowerCase() === 'cliente')
      let firstIaMs = null, firstHumanMs = null
      if (firstCliIdx >= 0) {
        const t0 = new Date(sMsgs[firstCliIdx].created_at).getTime()
        // Filtra só msgs no período pra alinhar com filtro de tempo
        if (inPeriod(sMsgs[firstCliIdx].created_at, from, to) || (!from && !to)) {
          const fIa = sMsgs.slice(firstCliIdx + 1).find(m => (m.type || '').toLowerCase() === 'ia')
          const fHu = sMsgs.slice(firstCliIdx + 1).find(m => ['atendente', 'humano'].includes((m.type || '').toLowerCase()))
          if (fIa) firstIaMs = new Date(fIa.created_at).getTime() - t0
          if (fHu) firstHumanMs = new Date(fHu.created_at).getTime() - t0
        }
      }
      return { numero, isClosed, isPending, waitingMs, firstIaMs, firstHumanMs, sMsgs, last }
    })
  }, [msgsByNumero, closedSet, from, to])

  // Tempo até IA (mediana + p90)
  const iaTimes = sessionMetrics.map(s => s.firstIaMs).filter(x => x != null && x > 0)
  const medIa = medianMs(iaTimes)
  const p9Ia = p90Ms(iaTimes)

  // Tempo até humano (mediana + p90)
  const humanTimes = sessionMetrics.map(s => s.firstHumanMs).filter(x => x != null && x > 0)
  const medHuman = medianMs(humanTimes)
  const p9Human = p90Ms(humanTimes)

  // Pendentes agora
  const pending = sessionMetrics.filter(s => s.isPending)
  const pending1h = pending.filter(s => s.waitingMs > 3600000).length
  const pending24h = pending.filter(s => s.waitingMs > 86400000).length

  // Tendência diária — tempo médio resposta humana por dia
  const dailyHumanTrend = useMemo(() => {
    const buckets = {}
    sessionMetrics.forEach(s => {
      if (s.firstHumanMs == null || !s.last) return
      const day = new Date(s.last.created_at).toISOString().slice(0, 10)
      if (!buckets[day]) buckets[day] = []
      buckets[day].push(s.firstHumanMs)
    })
    return Object.entries(buckets).sort().map(([day, vals]) => ({ day, median: medianMs(vals), count: vals.length }))
  }, [sessionMetrics])
  const maxTrend = Math.max(1, ...dailyHumanTrend.map(d => d.median))

  // Tempo médio de ticket: closed_at - primeira msg do session_id
  const ticketDurations = useMemo(() => {
    const firstMsg = {}
    msgs.forEach(x => {
      if (!firstMsg[x.numero] || new Date(x.created_at) < new Date(firstMsg[x.numero])) {
        firstMsg[x.numero] = x.created_at
      }
    })
    return closedInPeriod.map(c => {
      const start = firstMsg[c.session_id]
      if (!start || !c.closed_at) return null
      return new Date(c.closed_at).getTime() - new Date(start).getTime()
    }).filter(d => d != null && d > 0)
  }, [closedInPeriod, msgs])
  const avgTicket = ticketDurations.length ? ticketDurations.reduce((a, b) => a + b, 0) / ticketDurations.length : 0

  // Tipos de mensagem
  const typeCounts = useMemo(() => {
    const map = { cliente: 0, atendente: 0, ia: 0, outro: 0 }
    msgs.filter(x => inPeriod(x.created_at, from, to)).forEach(x => {
      const t = (x.type || 'outro').toLowerCase()
      if (map[t] != null) map[t]++; else map.outro++
    })
    return map
  }, [msgs, from, to])

  // Mensagens por hora (heatmap simples)
  const hourCounts = useMemo(() => {
    const arr = Array(24).fill(0)
    msgs.filter(x => inPeriod(x.created_at, from, to)).forEach(x => {
      const d = new Date(x.created_at); if (isNaN(d.getTime())) return
      arr[d.getHours()]++
    })
    return arr
  }, [msgs, from, to])

  // % tickets que viraram atendimento humano
  const numTicketsClosed = closedInPeriod.length
  const closedHadAtt = closedInPeriod.filter(c => atts.some(a => a.numero === c.session_id)).length
  const taxaHumano = numTicketsClosed ? Math.round((closedHadAtt / numTicketsClosed) * 100) : 0

  // Auto-encerrados
  const autoEncerrados = closedInPeriod.filter(c => c.reason === 'auto_encerrado').length

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard icon={<Bot size={18} color="#2563EB" />} bg="#EFF6FF" value={formatDuration(medIa)} label="Resposta da IA (mediana)" sub={`p90: ${formatDuration(p9Ia)}`} loading={loading} />
        <KpiCard icon={<Headset size={18} color="#16A34A" />} bg="#F0FDF4" value={formatDuration(medHuman)} label="Resposta humana (mediana)" sub={`p90: ${formatDuration(p9Human)}`} loading={loading} />
        <KpiCard icon={<Inbox size={18} color="#D97706" />} bg="#FFFBEB" value={pending.length} label="Pendentes agora" sub={`${pending1h} > 1h · ${pending24h} > 24h`} loading={loading} alert={pending1h > 0} />
        <KpiCard icon={<XCircle size={18} color="#DC2626" />} bg="#FEF2F2" value={autoEncerrados} label="Expirados (auto)" sub="ninguém atendeu" loading={loading} alert={autoEncerrados > 0} />
        <KpiCard icon={<Clock size={18} color="#7C3AED" />} bg="#F5F3FF" value={formatDuration(avgTicket)} label="Duração do ticket" sub="abertura → fechamento" loading={loading} />
        <KpiCard icon={<TrendingUp size={18} color="#0891B2" />} bg="#ECFEFF" value={`${taxaHumano}%`} label="Atendimento humano" sub="tickets assumidos" loading={loading} />
      </div>

      {/* Tendência diária — tempo médio resposta humana */}
      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 14 }}>
        <SectionTitle icon={TrendingUp} text="Tempo de resposta humana — dia a dia" right={`${dailyHumanTrend.length} dias`} />
        {dailyHumanTrend.length === 0 ? <Empty /> : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, marginTop: 16, paddingBottom: 24, position: 'relative' }}>
            {dailyHumanTrend.map((d, i) => {
              const h = Math.max(4, (d.median / maxTrend) * 90)
              return (
                <div
                  key={i}
                  title={`${d.day} — ${formatDuration(d.median)} (${d.count} conv.)`}
                  style={{
                    flex: 1, height: `${h}%`,
                    background: slaColor(d.median),
                    borderRadius: '4px 4px 0 0',
                    position: 'relative', cursor: 'pointer',
                  }}>
                  {d.median === maxTrend && (
                    <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: slaColor(d.median), whiteSpace: 'nowrap' }}>{formatDuration(d.median)}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {dailyHumanTrend.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
            <span>{new Date(dailyHumanTrend[0].day + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
            <span>{new Date(dailyHumanTrend[dailyHumanTrend.length - 1].day + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={ListChecks} text="Motivos de encerramento" right={periodLabel(period)} />
          {reasonsMap.length === 0 ? <Empty /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <DonutChart data={reasonsMap.map(([k, v]) => ({ value: v, color: REASON_META[k]?.color || '#94A3B8', label: REASON_META[k]?.label || k }))} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reasonsMap.map(([k, v]) => {
                  const meta = REASON_META[k] || { label: k, color: '#94A3B8' }
                  const total = reasonsMap.reduce((a, b) => a + b[1], 0)
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{meta.label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{Math.round(v / total * 100)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={MessageSquare} text="Tipos de mensagem" right={periodLabel(period)} />
          {[['cliente', '#94A3B8'], ['atendente', '#16A34A'], ['ia', '#2563EB']].map(([k, color]) => {
            const v = typeCounts[k] || 0
            const total = Object.values(typeCounts).reduce((a, b) => a + b, 0) || 1
            return (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, textTransform: 'capitalize', color: 'var(--text-primary)' }}>{k}</span>
                  <span style={{ fontWeight: 700, color }}>{v}</span>
                </div>
                <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v / total) * 100}%`, background: color, transition: 'width 0.5s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="nx-card" style={{ padding: '1.25rem' }}>
        <SectionTitle icon={Clock} text="Mensagens por hora do dia" right={periodLabel(period)} />
        <HourChart data={hourCounts} />
      </div>
    </div>
  )
}

// ─── Tab: Equipe ────────────────────────────────────────────────────────────
function EquipeTab({ msgs, convs, atts, users, sectors, sectorMembers, range, period, loading }) {
  const { from, to } = range

  // Ranking atendentes
  const ranking = useMemo(() => {
    return users.map(u => {
      const myMsgs = msgs.filter(x => (x.type || '').toLowerCase() === 'atendente' && inPeriod(x.created_at, from, to))
      // Filtrar mensagens do próprio atendente (assumimos que mensagens com type=atendente foram enviadas por algum atendente,
      // e a atribuição vem das attendances; usamos email como liga)
      const myAtts = atts.filter(a => a.attendant_email === u.email)
      const myAttsInPeriod = myAtts.filter(a => inPeriod(a.assumed_at, from, to))
      const myClosedSet = new Set(myAtts.map(a => a.numero))
      const myConvs = convs.filter(c => myClosedSet.has(c.session_id) && inPeriod(c.closed_at, from, to))
      // Mensagens enviadas pelo atendente: assumimos pela proximidade temporal de suas attendances
      const myNumeros = new Set(myAtts.map(a => a.numero))
      const sentMsgs = myMsgs.filter(m => myNumeros.has(m.numero)).length
      return {
        id: u.id, name: u.name, email: u.email,
        tickets: myAttsInPeriod.length,
        finalizados: myConvs.length,
        mensagens: sentMsgs,
      }
    }).sort((a, b) => b.tickets - a.tickets)
  }, [users, atts, convs, msgs, from, to])

  // Por setor
  const bySector = useMemo(() => {
    const map = {}
    atts.filter(a => inPeriod(a.assumed_at, from, to)).forEach(a => {
      const k = a.sector_name || 'Sem setor'
      map[k] = (map[k] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [atts, from, to])

  const totalAttsInPeriod = bySector.reduce((a, b) => a + b[1], 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={Users} text="Ranking de atendentes" right={periodLabel(period)} />
          {ranking.length === 0 ? <Empty /> : (
            <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr><th>Atendente</th><th style={{ textAlign: 'right' }}>Tickets</th><th style={{ textAlign: 'right' }}>Finalizados</th><th style={{ textAlign: 'right' }}>Msgs</th></tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id}>
                    <td className="td-name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? '#FEF3C7' : '#EFF6FF', border: `1px solid ${i === 0 ? '#FDE68A' : '#BFDBFE'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#D97706' : '#2563EB' }}>
                          {i === 0 ? '🏆' : r.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{r.tickets}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{r.finalizados}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.mensagens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={Layers} text="Atendimentos por setor" right={periodLabel(period)} />
          {bySector.length === 0 ? <Empty /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bySector.map(([name, count], i) => {
                const sector = sectors.find(s => s.name === name)
                const color = sector?.color || ORIGEM_COLORS[i % ORIGEM_COLORS.length]
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{name}</span>
                      <span style={{ fontWeight: 700, color }}>{count} ({Math.round(count / totalAttsInPeriod * 100)}%)</span>
                    </div>
                    <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / Math.max(...bySector.map(b => b[1]))) * 100}%`, background: color, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Agenda ────────────────────────────────────────────────────────────
function AgendaTab({ appts, range, period, loading }) {
  const { from, to } = range
  const inRange = appts.filter(a => inPeriod(a.starts_at, from, to))

  const counts = inRange.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {})
  const total = inRange.length
  const noShow = counts.faltou || 0
  const cancelado = counts.cancelado || 0
  const taxaNoShow = total ? Math.round((noShow / total) * 100) : 0
  const taxaCancel = total ? Math.round((cancelado / total) * 100) : 0
  const taxaConfirm = total ? Math.round(((counts.confirmado || 0) + (counts.concluido || 0)) / total * 100) : 0

  const byAgenda = useMemo(() => {
    const map = {}
    inRange.forEach(a => {
      const name = a.agendas?.name || 'Sem nome'
      if (!map[name]) map[name] = { total: 0, color: a.agendas?.color || '#2563EB' }
      map[name].total++
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [inRange])

  const byDayOfWeek = useMemo(() => {
    const arr = Array(7).fill(0)
    inRange.forEach(a => { const d = new Date(a.starts_at); if (!isNaN(d.getTime())) arr[d.getDay()]++ })
    return arr
  }, [inRange])
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard icon={<Calendar size={18} color="#2563EB" />} bg="#EFF6FF" value={total} label="Total" sub={periodLabel(period)} loading={loading} />
        <KpiCard icon={<CheckCircle2 size={18} color="#16A34A" />} bg="#F0FDF4" value={`${taxaConfirm}%`} label="Confirmação" sub="confirmado + concluído" loading={loading} />
        <KpiCard icon={<AlertCircle size={18} color="#D97706" />} bg="#FFFBEB" value={`${taxaNoShow}%`} label="No-show" sub="pacientes que faltaram" loading={loading} alert={taxaNoShow > 15} />
        <KpiCard icon={<XCircle size={18} color="#DC2626" />} bg="#FEF2F2" value={`${taxaCancel}%`} label="Cancelamento" sub="taxa de cancelamento" loading={loading} alert={taxaCancel > 20} />
      </div>

      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 14 }}>
        <SectionTitle icon={Flag} text="Distribuição por status" right={periodLabel(period)} />
        {total === 0 ? <Empty /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(APPT_STATUS).map(([k, meta]) => {
              const v = counts[k] || 0
              return (
                <div key={k} style={{ flex: '1 1 130px', padding: '10px 14px', background: meta.color + '11', border: `1px solid ${meta.color}33`, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: 'uppercase' }}>{meta.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: meta.color, marginTop: 2 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total ? Math.round(v / total * 100) : 0}% do total</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={Calendar} text="Por agenda" right={periodLabel(period)} />
          {byAgenda.length === 0 ? <Empty /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byAgenda.map(([name, info]) => {
                const max = Math.max(...byAgenda.map(([, i]) => i.total))
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{name}</span>
                      <span style={{ fontWeight: 700, color: info.color }}>{info.total}</span>
                    </div>
                    <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(info.total / max) * 100}%`, background: info.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={BarChart2} text="Por dia da semana" right={periodLabel(period)} />
          {total === 0 ? <Empty /> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
              {byDayOfWeek.map((v, i) => {
                const max = Math.max(...byDayOfWeek)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>{v || ''}</div>
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${max ? (v / max) * 100 : 0}%`, minHeight: v ? 4 : 0, background: '#2563EB', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dayLabels[i]}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Financeiro ────────────────────────────────────────────────────────
function FinanceiroTab({ appts, professionals, procedures, insurancePlans, range, period, loading }) {
  const { from, to } = range
  const inRange = appts.filter(a => inPeriod(a.starts_at, from, to))

  // KPIs
  const faturado = inRange.filter(a => a.payment_status === 'pago').reduce((s, a) => s + Number(a.price || 0), 0)
  const aReceber = inRange.filter(a => a.payment_status === 'pendente' && a.status !== 'cancelado' && a.status !== 'faltou').reduce((s, a) => s + Number(a.price || 0), 0)
  const perdidoFaltas = inRange.filter(a => a.status === 'faltou').reduce((s, a) => s + Number(a.price || 0), 0)
  const concluidos = inRange.filter(a => a.payment_status === 'pago').length
  const ticketMedio = concluidos ? faturado / concluidos : 0

  // Faturamento por profissional
  const byProfessional = useMemo(() => {
    const map = {}
    inRange.filter(a => a.payment_status === 'pago').forEach(a => {
      const id = a.professional_id || 'sem'
      const pro = professionals.find(p => p.id === id)
      const name = pro?.name || (id === 'sem' ? 'Sem profissional' : 'Removido')
      const color = pro?.color || '#6B7280'
      if (!map[id]) map[id] = { name, color, value: 0, count: 0 }
      map[id].value += Number(a.price || 0)
      map[id].count++
    })
    return Object.values(map).sort((a, b) => b.value - a.value)
  }, [inRange, professionals])

  // Faturamento por procedimento
  const byProcedure = useMemo(() => {
    const map = {}
    inRange.filter(a => a.payment_status === 'pago').forEach(a => {
      const id = a.procedure_id || 'sem'
      const proc = procedures.find(p => p.id === id)
      const name = proc?.name || (id === 'sem' ? 'Sem procedimento' : 'Removido')
      if (!map[id]) map[id] = { name, value: 0, count: 0 }
      map[id].value += Number(a.price || 0)
      map[id].count++
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [inRange, procedures])

  // Faturamento por convênio (Particular = null)
  const byInsurance = useMemo(() => {
    const map = {}
    inRange.filter(a => a.payment_status === 'pago').forEach(a => {
      const id = a.insurance_plan_id || 'particular'
      const plan = insurancePlans.find(p => p.id === id)
      const name = plan?.name || 'Particular'
      if (!map[id]) map[id] = { name, value: 0, count: 0 }
      map[id].value += Number(a.price || 0)
      map[id].count++
    })
    return Object.values(map).sort((a, b) => b.value - a.value)
  }, [inRange, insurancePlans])

  const totalIns = byInsurance.reduce((s, x) => s + x.value, 0) || 1
  const maxPro   = Math.max(1, ...byProfessional.map(x => x.value))
  const maxProc  = Math.max(1, ...byProcedure.map(x => x.value))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard icon={<DollarSign size={18} color="#16A34A" />} bg="#F0FDF4" value={fmtMoney(faturado)} label="Faturado" sub={periodLabel(period)} loading={loading} />
        <KpiCard icon={<Clock size={18} color="#D97706" />} bg="#FFFBEB" value={fmtMoney(aReceber)} label="A receber" sub="agendamentos pendentes" loading={loading} alert={aReceber > 0} />
        <KpiCard icon={<TrendingUp size={18} color="#2563EB" />} bg="#EFF6FF" value={fmtMoney(ticketMedio)} label="Ticket médio" sub={`${concluidos} pagamentos`} loading={loading} />
        <KpiCard icon={<XCircle size={18} color="#DC2626" />} bg="#FEF2F2" value={fmtMoney(perdidoFaltas)} label="Perdido em faltas" sub="pacientes que faltaram" loading={loading} alert={perdidoFaltas > 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={Stethoscope} text="Faturamento por profissional" right={periodLabel(period)} />
          {byProfessional.length === 0 ? <Empty /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byProfessional.map((p, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontWeight: 700, color: p.color }}>{fmtMoney(p.value)} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>· {p.count}x</span></span>
                  </div>
                  <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(p.value / maxPro) * 100}%`, background: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={ListChecks} text="Top procedimentos" right={periodLabel(period)} />
          {byProcedure.length === 0 ? <Empty /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byProcedure.map((p, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{p.name}</span>
                    <span style={{ fontWeight: 700, color: '#16A34A', flexShrink: 0 }}>{fmtMoney(p.value)} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>· {p.count}x</span></span>
                  </div>
                  <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(p.value / maxProc) * 100}%`, background: '#16A34A' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="nx-card" style={{ padding: '1.25rem' }}>
        <SectionTitle icon={Layers} text="Faturamento por forma de pagamento" right={periodLabel(period)} />
        {byInsurance.length === 0 ? <Empty /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <DonutChart data={byInsurance.map((p, i) => ({
              value: p.value,
              color: p.name === 'Particular' ? '#16A34A' : ORIGEM_COLORS[(i + 1) % ORIGEM_COLORS.length],
              label: p.name,
            }))} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byInsurance.map((p, i) => {
                const color = p.name === 'Particular' ? '#16A34A' : ORIGEM_COLORS[(i + 1) % ORIGEM_COLORS.length]
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{p.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtMoney(p.value)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{Math.round(p.value / totalIns * 100)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Leads ─────────────────────────────────────────────────────────────
function cleanPhone(p) {
  return (p || '').replace(/@.*$/, '').replace(/\D/g, '')
}

function LeadsTab({ leads, appts, msgs, range, period, loading, contactsTable }) {
  const { from, to } = range
  const navigate = useNavigate()
  const { session } = useAuth()
  const instance = session?.company?.instance
  const [drilldown, setDrilldown] = useState(null) // { origem, leads } — modal de leads por origem

  function openConversation(lead) {
    const phone = cleanPhone(lead.numero)
    if (!phone) return
    setDrilldown(null)
    navigate(`/painel/conversas?contact=${phone}`)
  }
  if (!contactsTable) {
    return <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tabela de contatos não configurada.</div>
  }
  const filtered = leads.filter(l => inPeriod(l.created_at, from, to) || (!from && !to))

  // Index appointments por telefone (clean)
  const apptsByPhone = useMemo(() => {
    const map = {}
    appts.forEach(a => {
      const p = cleanPhone(a.patient_phone)
      if (!p) return
      if (!map[p]) map[p] = []
      map[p].push(a)
    })
    return map
  }, [appts])

  // Index leads → appointments
  const leadsWithAppt = useMemo(() => {
    return filtered.map(l => {
      const phone = cleanPhone(l.numero)
      const myAppts = apptsByPhone[phone] || []
      const concluded = myAppts.filter(a => a.status === 'concluido')
      const revenue = concluded.reduce((s, a) => s + Number(a.price || 0), 0)
      return { ...l, appts: myAppts, concluded: concluded.length, revenue }
    })
  }, [filtered, apptsByPhone])

  const totalLeads    = filtered.length
  const comContato    = filtered.filter(l => l.primeiro_contato === 'sim').length
  const semResposta   = filtered.filter(l => l.primeiro_contato === 'sim' && !l.ultima_mensagem).length
  const comUltimaMsg  = filtered.filter(l => !!l.ultima_mensagem).length
  const agendaram     = leadsWithAppt.filter(l => l.appts.length > 0).length
  const concluiram    = leadsWithAppt.filter(l => l.concluded > 0).length
  const receitaTotal  = leadsWithAppt.reduce((s, l) => s + l.revenue, 0)
  const conversao     = totalLeads ? (agendaram / totalLeads * 100) : 0
  const ticketMedio   = concluiram ? (receitaTotal / concluiram) : 0

  // Tempo médio até primeiro contato (mensagem mais antiga - lead.created_at)
  const tempoMedioContato = useMemo(() => {
    const msgsByPhone = {}
    msgs.forEach(m => {
      if ((m.type || '').toLowerCase() !== 'cliente') return
      const p = cleanPhone(m.numero)
      const ts = new Date(m.created_at).getTime()
      if (!msgsByPhone[p] || ts < msgsByPhone[p]) msgsByPhone[p] = ts
    })
    let totalMs = 0, count = 0
    filtered.forEach(l => {
      const p = cleanPhone(l.numero)
      const firstMsg = msgsByPhone[p]
      const created = new Date(l.created_at).getTime()
      if (firstMsg && created && firstMsg >= created) {
        totalMs += (firstMsg - created)
        count++
      }
    })
    return count ? totalMs / count : 0
  }, [filtered, msgs])

  // Origem com conversão (agrupada por valor canônico — case/variações fundem)
  const origens = useMemo(() => {
    const map = {}
    leadsWithAppt.forEach(l => {
      const k = normalizeOrigem(l.origem)
      if (!map[k]) map[k] = { name: k, total: 0, agendaram: 0, concluidas: 0, receita: 0 }
      map[k].total++
      if (l.appts.length > 0) map[k].agendaram++
      map[k].concluidas += l.concluded
      map[k].receita += l.revenue
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [leadsWithAppt])

  // Classificação — mostra todos os 5 status auto na ordem do funil, mesmo zerados
  const classifMap = useMemo(() => {
    const map = {}
    filtered.forEach(l => {
      const k = l.classificacao_lead || 'novo'
      map[k] = (map[k] || 0) + 1
    })
    // Garante que os 5 status auto apareçam mesmo com 0 (na ordem do funil)
    const ordered = STATUS_ORDER.map(s => [s, map[s] || 0])
    // Adiciona valores legados (Curioso, Quente, etc) no final
    Object.entries(map).forEach(([k, v]) => {
      if (!STATUS_ORDER.includes(k)) ordered.push([k, v])
    })
    return ordered
  }, [filtered])
  const maxClassif = Math.max(1, ...classifMap.map(([, v]) => v))

  // Volume diário (últimos 14 dias ou range completo)
  const dailyVolume = useMemo(() => {
    const days = []
    const end = to || new Date()
    const start = from || new Date(Date.now() - 13 * 86400000)
    const dayMs = 86400000
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + dayMs)) {
      const next = new Date(d.getTime() + dayMs)
      const dayLeads = filtered.filter(l => {
        const c = new Date(l.created_at)
        return c >= d && c < next
      }).length
      days.push({ date: new Date(d), count: dayLeads })
      if (days.length > 60) break
    }
    return days
  }, [filtered, from, to])
  const maxDaily = Math.max(1, ...dailyVolume.map(d => d.count))

  // Leads sem resposta — actionable
  const sleepingLeads = useMemo(() => {
    return filtered
      .filter(l => l.primeiro_contato === 'sim' && !l.ultima_mensagem)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)
  }, [filtered])

  // ── Leads em risco / perdidos por desatenção ──────────────────────────────
  // Detecta conversas onde:
  //  - última mensagem é da IA
  //  - cliente NÃO respondeu desde então
  //  - ninguém assumiu (não tem entrada em attendances)
  //  - conversa NÃO foi finalizada
  // Classificação: em_risco (> 2h) | perdido (> 24h)
  const SLA_RISCO_MS   = 2  * 3600 * 1000  //  2h
  const SLA_PERDIDO_MS = 24 * 3600 * 1000  // 24h

  const leadsEmRisco = useMemo(() => {
    // Index das últimas mensagens por numero
    const lastByNum = {}
    msgs.forEach(m => {
      const n = m.numero
      if (!n) return
      const ts = new Date(m.created_at).getTime()
      const t = (m.type || '').toLowerCase()
      const cur = lastByNum[n] || { last: 0, lastType: null, hasAtendente: false }
      if (ts > cur.last) {
        cur.last = ts
        cur.lastType = t
      }
      if (t === 'atendente' || t === 'humano') cur.hasAtendente = true
      lastByNum[n] = cur
    })

    const now = Date.now()
    const risco = []
    for (const lead of filtered) {
      const sid = lead.numero
      if (!sid) continue
      // Ignora IDs internos do Instagram/Meta (PSIDs têm 15+ dígitos, telefone
      // brasileiro tem 12-13). Esses leads não conseguem ser assumidos via
      // numero pelo painel de Conversas mesmo, melhor não confundir o atendente.
      if (cleanPhone(sid).length > 14) continue
      const info = lastByNum[sid]
      if (!info) continue
      // Última mensagem precisa ser da IA (paciente sumiu após resposta automática)
      if (info.lastType !== 'ia') continue
      if (info.hasAtendente) continue          // alguém já tomou conta
      if (lead.classificacao_lead === 'agendado' || lead.classificacao_lead === 'encerrado') continue
      const elapsed = now - info.last
      if (elapsed < SLA_RISCO_MS) continue     // ainda dentro do SLA
      const status = elapsed >= SLA_PERDIDO_MS ? 'perdido' : 'em_risco'
      risco.push({ ...lead, lastMsgTs: info.last, elapsed, status })
    }
    return risco.sort((a, b) => a.lastMsgTs - b.lastMsgTs)  // mais antigo primeiro (mais urgente)
  }, [msgs, filtered])

  const leadsPerdidos    = leadsEmRisco.filter(l => l.status === 'perdido')
  const leadsEmRiscoOnly = leadsEmRisco.filter(l => l.status === 'em_risco')

  // Dispara alertas no banco pra leads em risco (com dedup de 24h)
  useEffect(() => {
    if (!instance || !leadsEmRisco.length) return
    let cancelled = false
    async function fireAlerts() {
      // Busca alertas recentes com tag de lead-perdido pra deduplicar
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('alerts')
        .select('numero, mensagem, created_at')
        .eq('instancia', instance)
        .gte('created_at', since)
        .like('mensagem', '🚨 LEAD SUMINDO%')
      if (cancelled) return
      const alreadyAlerted = new Set((existing || []).map(a => a.numero))

      const toInsert = []
      for (const l of leadsEmRisco) {
        if (alreadyAlerted.has(l.numero)) continue
        const ageH = Math.floor(l.elapsed / 3600000)
        const ageStr = ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d ${ageH % 24}h`
        const sev = l.status === 'perdido' ? '⚠️ PERDENDO' : '🚨 EM RISCO'
        toInsert.push({
          instancia: instance,
          numero: l.numero,
          nome: l.nome || null,
          mensagem: `🚨 LEAD SUMINDO · ${sev} — ${l.nome || cleanPhone(l.numero)} parou de responder há ${ageStr}. IA já respondeu mas não retornou. Assumir AGORA antes de perder o lead.`,
          resolved: false,
        })
      }
      if (toInsert.length && !cancelled) {
        await supabase.from('alerts').insert(toInsert)
      }
    }
    fireAlerts()
    return () => { cancelled = true }
  }, [instance, leadsEmRisco])


  function fmtAge(ts) {
    const ms = Date.now() - new Date(ts).getTime()
    const hours = Math.floor(ms / 3600000)
    if (hours < 1) return `${Math.floor(ms / 60000)}min`
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }
  function fmtMsCurta(ms) {
    if (!ms) return '—'
    const h = Math.floor(ms / 3600000)
    if (h < 1) return `${Math.floor(ms / 60000)}min`
    if (h < 24) return `${h}h ${Math.floor((ms % 3600000) / 60000)}min`
    return `${Math.floor(h / 24)}d ${h % 24}h`
  }

  return (
    <div>
      {/* KPIs — 6 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard icon={<Users size={18} color="#2563EB" />} bg="#EFF6FF" value={totalLeads} label="Total de leads" sub={periodLabel(period)} loading={loading} />
        <KpiCard icon={<MessageSquare size={18} color="#16A34A" />} bg="#F0FDF4" value={comContato} label="Leads contactados" sub={`${totalLeads ? Math.round(comContato / totalLeads * 100) : 0}% do total`} loading={loading} />
        <KpiCard icon={<Calendar size={18} color="#7C3AED" />} bg="#F5F3FF" value={agendaram} label="Viraram agendamento" sub={`${conversao.toFixed(1)}% de conversão`} loading={loading} />
        <KpiCard icon={<DollarSign size={18} color="#059669" />} bg="#ECFDF5" value={fmtMoney(receitaTotal)} label="Receita atribuída" sub={`ticket médio ${fmtMoney(ticketMedio)}`} loading={loading} />
        <KpiCard icon={<Clock size={18} color="#0891B2" />} bg="#ECFEFF" value={fmtMsCurta(tempoMedioContato)} label="Tempo até 1º contato" sub="lead → 1ª mensagem" loading={loading} />
        <KpiCard icon={<Inbox size={18} color="#F59E0B" />} bg="#FFFBEB" value={semResposta} label="Sem resposta" sub="aguardando retorno" loading={loading} alert={semResposta > 0} />
        <KpiCard icon={<AlertTriangle size={18} color="#D97706" />} bg="#FFFBEB" value={leadsEmRiscoOnly.length} label="Em risco (> 2h)" sub="IA respondeu, paciente sumiu" loading={loading} alert={leadsEmRiscoOnly.length > 0} />
        <KpiCard icon={<AlertOctagon size={18} color="#DC2626" />} bg="#FEF2F2" value={leadsPerdidos.length} label="Perdidos por desatenção" sub="> 24h sem ação humana" loading={loading} alert={leadsPerdidos.length > 0} />
      </div>

      {/* Funil */}
      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 14 }}>
        <SectionTitle icon={TrendingUp} text="Funil de conversão" right={periodLabel(period)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, alignItems: 'stretch', marginTop: 12 }}>
          {[
            { lbl: 'Leads recebidos',     val: totalLeads,    color: '#2563EB', bg: '#EFF6FF' },
            { lbl: 'Contactados',         val: comContato,    color: '#0891B2', bg: '#ECFEFF' },
            { lbl: 'Trocaram msg',        val: comUltimaMsg,  color: '#7C3AED', bg: '#F5F3FF' },
            { lbl: 'Agendaram',           val: agendaram,     color: '#D97706', bg: '#FFFBEB' },
            { lbl: 'Compareceram',        val: concluiram,    color: '#16A34A', bg: '#F0FDF4' },
          ].map((s, i, arr) => {
            const pct = totalLeads ? (s.val / totalLeads * 100) : 0
            const prev = i > 0 ? arr[i - 1].val : null
            const stepConv = prev && prev > 0 ? (s.val / prev * 100) : null
            return (
              <div key={s.lbl} style={{
                background: s.bg, borderRadius: 10, padding: '14px 12px',
                display: 'flex', flexDirection: 'column', gap: 4,
                position: 'relative', minHeight: 96,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: s.color }}>
                  {String(i + 1).padStart(2, '0')} · {s.lbl}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {pct.toFixed(1)}% do topo
                </div>
                {stepConv !== null && (
                  <div style={{ fontSize: 10, color: stepConv >= 50 ? '#16A34A' : stepConv >= 25 ? '#D97706' : '#DC2626', fontWeight: 700, marginTop: 'auto' }}>
                    ↳ {stepConv.toFixed(1)}% da etapa anterior
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Volume diário (sparkline) */}
      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 14 }}>
        <SectionTitle icon={BarChart2} text="Volume diário de novos leads" right={`${dailyVolume.length} dias`} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, marginTop: 16, paddingBottom: 24, position: 'relative' }}>
          {dailyVolume.map((d, i) => {
            const h = d.count === 0 ? 2 : Math.max(4, (d.count / maxDaily) * 90)
            const isToday = new Date().toDateString() === d.date.toDateString()
            return (
              <div key={i} style={{
                flex: 1, height: `${h}%`,
                background: isToday ? 'linear-gradient(180deg, #2563EB, #1D4ED8)' : (d.count > 0 ? '#3B82F6' : '#E5E7EB'),
                borderRadius: '4px 4px 0 0',
                position: 'relative',
                cursor: 'pointer',
              }}
              title={`${d.date.toLocaleDateString('pt-BR')} — ${d.count} leads`}>
                {d.count > 0 && d.count === maxDaily && (
                  <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: '#1D4ED8' }}>{d.count}</div>
                )}
              </div>
            )
          })}
        </div>
        {dailyVolume.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
            <span>{dailyVolume[0]?.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
            <span>{dailyVolume[dailyVolume.length - 1]?.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
          </div>
        )}
      </div>

      {/* Origem com conversão (tabela rica) */}
      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 14 }}>
        <SectionTitle icon={BarChart2} text="Origens — qual canal mais converte?" right={`${origens.length} canais`} />
        {origens.length === 0 ? <Empty /> : (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 80px 100px 100px 120px 1fr', gap: 8, padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', borderBottom: '1px solid #F1F5F9' }}>
              <div>Canal</div>
              <div style={{ textAlign: 'right' }}>Leads</div>
              <div style={{ textAlign: 'right' }}>Agendou</div>
              <div style={{ textAlign: 'right' }}>Conv.</div>
              <div style={{ textAlign: 'right' }}>Receita</div>
              <div></div>
            </div>
            {origens.map((o, i) => {
              const conv = o.total ? (o.agendaram / o.total * 100) : 0
              const color = ORIGEM_COLORS[i % ORIGEM_COLORS.length]
              return (
                <div
                  key={o.name}
                  onClick={() => {
                    const subset = leadsWithAppt.filter(l => normalizeOrigem(l.origem) === o.name)
                    setDrilldown({ origem: o.name, color, leads: subset })
                  }}
                  title={`Ver os ${o.total} leads que vieram de ${o.name}`}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.5fr 80px 100px 100px 120px 1fr', gap: 8,
                    padding: '10px 12px', alignItems: 'center',
                    borderBottom: '1px solid #F8FAFC', fontSize: 12.5,
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {o.name}
                    <ChevronRight size={12} style={{ color: '#CBD5E1', marginLeft: 'auto' }} />
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700 }}>{o.total}</div>
                  <div style={{ textAlign: 'right', color: '#7C3AED', fontWeight: 600 }}>{o.agendaram}</div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: conv >= 30 ? '#F0FDF4' : conv >= 15 ? '#FFFBEB' : '#FEF2F2',
                      color: conv >= 30 ? '#16A34A' : conv >= 15 ? '#D97706' : '#DC2626',
                    }}>{conv.toFixed(0)}%</span>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(o.receita)}</div>
                  <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(o.total / origens[0].total * 100)}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Classificação + Sem resposta — 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14 }}>
        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle
            icon={Flag}
            text="Status do lead (auto)"
            right={<span title="Classificação automática baseada no fluxo: novo (sem resposta) → em atendimento (IA/humano respondeu) → agendado → encerrado/perdido" style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>auto</span>}
          />
          {classifMap.length === 0 ? <Empty /> : classifMap.map(([k, v]) => {
            const cs = CLASSIF_COLORS[k] || { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' }
            const label = cs.label || k
            const pct = totalLeads ? (v / totalLeads * 100) : 0
            return (
              <div key={k} style={{ marginBottom: 10, opacity: v === 0 ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: cs.color, background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>{label}</span>
                  <span style={{ fontWeight: 700 }}>{v} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>({pct.toFixed(0)}%)</span></span>
                </div>
                <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v / maxClassif) * 100}%`, background: cs.color, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle
            icon={AlertCircle}
            text="Leads sem resposta — ação recomendada"
            right={sleepingLeads.length > 0 ? <span style={{ color: '#DC2626', fontWeight: 700 }}>{sleepingLeads.length} pendentes</span> : <span>tudo em dia</span>}
          />
          {sleepingLeads.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#16A34A', fontSize: 13, fontWeight: 600 }}>
              <CheckCircle2 size={20} style={{ marginBottom: 6 }} /><br />
              Sem leads pendentes nesse período
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {sleepingLeads.map(l => {
                const age = fmtAge(l.created_at)
                const urgent = (Date.now() - new Date(l.created_at).getTime()) > 86400000 * 2 // > 2 dias
                return (
                  <div key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: urgent ? '#FEF2F2' : '#FFFBEB',
                    border: `1px solid ${urgent ? '#FECACA' : '#FDE68A'}`,
                    borderRadius: 8, padding: '8px 12px', fontSize: 12.5,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: urgent ? '#DC2626' : '#D97706',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>{(l.nome || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome || cleanPhone(l.numero)}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {l.origem ? `via ${l.origem} · ` : ''}aguardando há {age}
                      </div>
                    </div>
                    {urgent && (
                      <span style={{ background: '#DC2626', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgente</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════ Leads em risco / perdidos por desatenção ═════════════════ */}
      {leadsEmRisco.length > 0 && (
        <div className="nx-card" style={{
          padding: '1.25rem',
          marginTop: 14,
          border: leadsPerdidos.length > 0 ? '1.5px solid #FCA5A5' : '1.5px solid #FCD34D',
          background: leadsPerdidos.length > 0
            ? 'linear-gradient(180deg, #FEF2F2 0%, #FFFFFF 80%)'
            : 'linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 80%)',
        }}>
          <SectionTitle
            icon={leadsPerdidos.length > 0 ? AlertOctagon : AlertTriangle}
            text={leadsPerdidos.length > 0
              ? '🚨 Leads sumindo — ação imediata necessária'
              : 'Leads em risco — IA respondeu mas paciente sumiu'}
            right={
              <span style={{
                color: leadsPerdidos.length > 0 ? '#DC2626' : '#D97706',
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {leadsPerdidos.length > 0 ? `${leadsPerdidos.length} já passaram de 24h` : `${leadsEmRiscoOnly.length} pendentes`}
              </span>
            }
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {leadsEmRisco.slice(0, 8).map(l => {
              const phoneClean = cleanPhone(l.numero)
              const saved = null // não temos savedContacts aqui, mas dá pra abrir conversa pelo numero
              const isPerdido = l.status === 'perdido'
              const ageH = Math.floor(l.elapsed / 3600000)
              return (
                <div
                  key={l.id}
                  onClick={() => navigate(`/painel/conversas?contact=${phoneClean}`)}
                  title="Abrir conversa pra assumir"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: '#fff',
                    border: `1.5px solid ${isPerdido ? '#FECACA' : '#FDE68A'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 16px -6px ${isPerdido ? 'rgba(220,38,38,0.25)' : 'rgba(217,119,6,0.25)'}` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: isPerdido
                      ? 'linear-gradient(135deg, #DC2626, #991B1B)'
                      : 'linear-gradient(135deg, #F59E0B, #B45309)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>
                    {(l.nome || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{l.nome || phoneClean}</span>
                      <span style={{
                        fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                        background: isPerdido ? '#DC2626' : '#F59E0B',
                        color: '#fff',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        flexShrink: 0,
                      }}>{isPerdido ? 'Perdendo' : 'Em risco'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      IA respondeu há {ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d ${ageH % 24}h`}
                      {l.origem && ` · ${l.origem}`}
                    </div>
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700,
                    color: isPerdido ? '#DC2626' : '#D97706',
                    flexShrink: 0,
                  }}>
                    <UserPlus size={12} /> Assumir
                  </div>
                </div>
              )
            })}
          </div>
          {leadsEmRisco.length > 8 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
              + {leadsEmRisco.length - 8} lead(s) na fila
            </div>
          )}
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: '#F8FAFC', borderRadius: 8,
            fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Como funciona:</strong> a IA responde a primeira mensagem, mas se o paciente não voltar a falar e ninguém assumir em até <strong>2h</strong>, o lead entra em <strong>risco</strong>. Após <strong>24h</strong> sem ação, é classificado como <strong>perdido por desatenção</strong> e contabilizado nas métricas como problema de operação.
          </div>
        </div>
      )}

      {/* ════════ Atribuição (anúncios pagos × orgânico) ═══════════════════ */}
      <div style={{ marginTop: 14 }}>
        <AtribuicaoSection
          leadsWithAppt={leadsWithAppt}
          period={period}
          loading={loading}
        />
      </div>

      {/* Drill-down: leads de uma origem específica */}
      {drilldown && createPortal(
        <div
          onClick={() => setDrilldown(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="nx-card"
            style={{
              width: '100%', maxWidth: 720, maxHeight: 'calc(100vh - 3rem)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: drilldown.color }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Leads via {drilldown.origem}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {drilldown.leads.length} lead(s) no período · {drilldown.leads.filter(l => l.appts.length > 0).length} agendaram
                  </div>
                </div>
              </div>
              <button onClick={() => setDrilldown(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {drilldown.leads.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Sem leads dessa origem no período selecionado.
                </div>
              ) : (
                <div style={{ fontSize: 12.5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 110px 110px 110px 28px', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                    <div style={{ padding: '10px 14px' }}></div>
                    <div style={{ padding: '10px 14px' }}>Lead</div>
                    <div style={{ padding: '10px 14px', textAlign: 'center' }}>Status</div>
                    <div style={{ padding: '10px 14px', textAlign: 'right' }}>Receita</div>
                    <div style={{ padding: '10px 14px', textAlign: 'right' }}>Quando</div>
                    <div style={{ padding: '10px 14px' }}></div>
                  </div>

                  {drilldown.leads
                    .slice()
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((l, idx) => {
                      const cs = CLASSIF_COLORS[l.classificacao_lead] || { color: '#6B7280', bg: '#F3F4F6', label: l.classificacao_lead || 'novo' }
                      const phone = cleanPhone(l.numero)
                      const created = new Date(l.created_at)
                      return (
                        <div
                          key={l.id || idx}
                          onClick={() => openConversation(l)}
                          title="Abrir conversa do lead"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '52px 1fr 110px 110px 110px 28px',
                            alignItems: 'center',
                            borderBottom: '1px solid #F8FAFC',
                            cursor: 'pointer',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ padding: '10px 14px' }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: drilldown.color, color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>{(l.nome || '?').charAt(0).toUpperCase()}</div>
                          </div>
                          <div style={{ padding: '10px 14px', minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {l.nome || phone || 'Sem nome'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                              {l.nome && phone && (
                                <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{phone}</span>
                              )}
                              {(l.ad_title || l.ad_click_id) && (
                                <span
                                  title={l.ad_body ? l.ad_body.slice(0, 200) : 'Lead vindo de anúncio Meta'}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 10, fontWeight: 700, padding: '2px 6px 2px 4px', borderRadius: 999,
                                    background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A',
                                  }}
                                >
                                  {l.ad_thumbnail_url
                                    ? <img src={l.ad_thumbnail_url} alt="" style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                                    : <Megaphone size={10} />}
                                  <span style={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {l.ad_title || `Anúncio · ${(l.ad_click_id || '').slice(0, 8)}…`}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                              color: cs.color, background: cs.bg,
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>{cs.label}</span>
                          </div>
                          <div style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: l.revenue > 0 ? '#059669' : '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                            {l.revenue > 0 ? fmtMoney(l.revenue) : '—'}
                          </div>
                          <div style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', fontSize: 11.5 }}>
                            {created.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </div>
                          <div style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <ChevronRight size={14} style={{ color: '#CBD5E1' }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Section: Atribuição (renderizada dentro da aba Leads) ─────────────────
function AtribuicaoSection({ leadsWithAppt, period, loading, onDrilldown }) {
  const navigate = useNavigate()
  const [platformFilter, setPlatformFilter] = useState('all')   // all | paid | organic
  const [sortBy, setSortBy] = useState('total')                 // total | conv | receita
  const [drilldown, setDrilldown] = useState(null)
  const enriched = useMemo(() =>
    leadsWithAppt.map(l => ({
      ...l,
      isPaid: !!(l.ad_click_id || l.ad_title || l.ad_platform || l.ad_source),
    })),
  [leadsWithAppt])

  // Pago vs Orgânico — sempre baseado em todos os leads do período
  const pagoVsOrganico = useMemo(() => {
    const pago = enriched.filter(l => l.isPaid)
    const organico = enriched.filter(l => !l.isPaid)
    function s(arr) {
      const total = arr.length
      const agend = arr.filter(l => l.appts.length > 0).length
      const conc = arr.reduce((sum, l) => sum + l.concluded, 0)
      const rev = arr.reduce((sum, l) => sum + l.revenue, 0)
      return { total, agend, conc, rev, conv: total ? (agend / total * 100) : 0, ticket: conc ? (rev / conc) : 0 }
    }
    return { pago: s(pago), organico: s(organico) }
  }, [enriched])

  // Top campanhas — agrupado por ad_title
  const campanhas = useMemo(() => {
    const map = {}
    enriched.forEach(l => {
      if (!l.isPaid) return
      const key = l.ad_title || (l.ad_click_id ? `Anúncio (${l.ad_click_id.slice(0, 8)}…)` : null)
      if (!key) return
      if (!map[key]) {
        map[key] = {
          title: key,
          body: l.ad_body || '',
          thumb: l.ad_thumbnail_url || null,
          sourceUrl: l.ad_source_url || l.ad_media_url || null,
          platform: l.ad_platform || l.ad_source || '—',
          total: 0, agend: 0, conc: 0, receita: 0,
        }
      }
      map[key].total++
      if (l.appts.length > 0) map[key].agend++
      map[key].conc += l.concluded
      map[key].receita += l.revenue
    })
    const arr = Object.values(map)
    if (sortBy === 'conv')    arr.sort((a, b) => (b.agend / Math.max(b.total, 1)) - (a.agend / Math.max(a.total, 1)))
    else if (sortBy === 'receita') arr.sort((a, b) => b.receita - a.receita)
    else arr.sort((a, b) => b.total - a.total)
    return arr
  }, [enriched, sortBy])

  // Cruzamento horário × pago/orgânico
  const horarioCross = useMemo(() => {
    const periodos = [
      { key: 'madrugada', label: 'Madrugada', range: '0-6h', start: 0, end: 6 },
      { key: 'manha',     label: 'Manhã',     range: '6-12h', start: 6, end: 12 },
      { key: 'tarde',     label: 'Tarde',     range: '12-18h', start: 12, end: 18 },
      { key: 'noite',     label: 'Noite',     range: '18-24h', start: 18, end: 24 },
    ]
    return periodos.map(p => {
      const inRange = enriched.filter(l => {
        const h = new Date(l.created_at).getHours()
        return h >= p.start && h < p.end
      })
      return {
        ...p,
        pago: inRange.filter(l => l.isPaid).length,
        organico: inRange.filter(l => !l.isPaid).length,
        total: inRange.length,
      }
    })
  }, [enriched])
  const maxHorario = Math.max(1, ...horarioCross.map(h => h.total))

  // KPIs
  const totalLeads = enriched.length
  const topCampanha = campanhas[0]
  const convPaid = pagoVsOrganico.pago.conv
  const convOrg  = pagoVsOrganico.organico.conv
  const deltaConv = convPaid - convOrg

  const periodoLabel = periodLabel(period)

  function openConversation(l) {
    const phone = cleanPhone(l.numero)
    if (!phone) return
    setDrilldown(null)
    navigate(`/painel/conversas?contact=${phone}`)
  }

  return (
    <div>
      {/* Filtros internos */}
      <div className="nx-card" style={{ padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <Filter size={12} /> Mostrar
        </div>
        {[
          { k: 'all',     l: 'Todos',    n: enriched.length },
          { k: 'paid',    l: 'Pagos',    n: pagoVsOrganico.pago.total },
          { k: 'organic', l: 'Orgânicos', n: pagoVsOrganico.organico.total },
        ].map(p => (
          <button key={p.k} onClick={() => setPlatformFilter(p.k)} style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${platformFilter === p.k ? '#2563EB' : 'var(--border)'}`,
            background: platformFilter === p.k ? '#2563EB' : '#fff',
            color: platformFilter === p.k ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {p.l}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              background: platformFilter === p.k ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
              color: platformFilter === p.k ? '#fff' : 'var(--text-muted)',
            }}>{p.n}</span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ordenar campanhas por</span>
          <select className="nx-select" style={{ fontSize: 12 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="total">Volume (leads)</option>
            <option value="conv">Conversão</option>
            <option value="receita">Receita</option>
          </select>
        </div>
      </div>

      {/* KPIs — mesmo padrão das outras abas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard
          icon={<Megaphone size={18} color="#F59E0B" />} bg="#FFFBEB"
          value={pagoVsOrganico.pago.total}
          label="Leads pagos"
          sub={`${totalLeads ? Math.round(pagoVsOrganico.pago.total / totalLeads * 100) : 0}% do total`}
          loading={loading}
        />
        <KpiCard
          icon={<TrendingUp size={18} color="#16A34A" />} bg="#F0FDF4"
          value={pagoVsOrganico.organico.total}
          label="Leads orgânicos"
          sub={`${totalLeads ? Math.round(pagoVsOrganico.organico.total / totalLeads * 100) : 0}% do total`}
          loading={loading}
        />
        <KpiCard
          icon={<Sparkles size={18} color="#7C3AED" />} bg="#F5F3FF"
          value={`${convPaid.toFixed(0)}%`}
          label="Conv. de pagos"
          sub={deltaConv >= 0 ? `+${deltaConv.toFixed(0)}pp vs orgânico` : `${deltaConv.toFixed(0)}pp vs orgânico`}
          loading={loading}
        />
        <KpiCard
          icon={<DollarSign size={18} color="#059669" />} bg="#ECFDF5"
          value={fmtMoney(pagoVsOrganico.pago.rev)}
          label="Receita de pagos"
          sub={`ticket médio ${fmtMoney(pagoVsOrganico.pago.ticket)}`}
          loading={loading}
        />
      </div>

      {/* Comparativo Pago × Orgânico em barra horizontal */}
      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 14 }}>
        <SectionTitle
          icon={Layers}
          text="Pago × Orgânico"
          right={<span>volume relativo · {periodoLabel}</span>}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: 38, borderRadius: 10, overflow: 'hidden', background: '#F1F5F9' }}>
          {pagoVsOrganico.pago.total + pagoVsOrganico.organico.total > 0 ? (
            <>
              <div style={{
                width: `${(pagoVsOrganico.pago.total / (pagoVsOrganico.pago.total + pagoVsOrganico.organico.total)) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #FBBF24, #F59E0B)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 14,
                color: '#fff', fontSize: 12.5, fontWeight: 700,
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
                Pago · {pagoVsOrganico.pago.total}
              </div>
              <div style={{
                flex: 1,
                height: '100%',
                background: 'linear-gradient(90deg, #34D399, #16A34A)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 14,
                color: '#fff', fontSize: 12.5, fontWeight: 700,
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
                Orgânico · {pagoVsOrganico.organico.total}
              </div>
            </>
          ) : (
            <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, lineHeight: '38px' }}>Sem dados no período</div>
          )}
        </div>
        {/* Linha de stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0, marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderRight: '1px solid var(--border)', paddingRight: 16 }}>
            <Stat label="Agendaram" value={pagoVsOrganico.pago.agend} sub={`${convPaid.toFixed(0)}%`} color="#F59E0B" />
            <Stat label="Concluídas" value={pagoVsOrganico.pago.conc} color="#F59E0B" />
            <Stat label="Receita" value={fmtMoney(pagoVsOrganico.pago.rev)} color="#059669" mono />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', paddingLeft: 16 }}>
            <Stat label="Agendaram" value={pagoVsOrganico.organico.agend} sub={`${convOrg.toFixed(0)}%`} color="#16A34A" />
            <Stat label="Concluídas" value={pagoVsOrganico.organico.conc} color="#16A34A" />
            <Stat label="Receita" value={fmtMoney(pagoVsOrganico.organico.rev)} color="#059669" mono />
          </div>
        </div>
      </div>

      {/* Top campanhas */}
      <div className="nx-card" style={{ padding: '1.25rem', marginBottom: 14 }}>
        <SectionTitle
          icon={Sparkles}
          text="Top campanhas · qual criativo trouxe mais lead"
          right={<span>{campanhas.length} criativo(s) ativos</span>}
        />
        {campanhas.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Megaphone size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
            <div>Nenhuma campanha rastreada nesse período.</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Leads vindos de Click-to-WhatsApp do Meta vão aparecer aqui automaticamente.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 90px 110px 24px',
              gap: 10, padding: '8px 12px', alignItems: 'center',
              fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              borderBottom: '1px solid var(--border)',
            }}>
              <div></div>
              <div>Criativo</div>
              <div style={{ textAlign: 'right' }}>Leads</div>
              <div style={{ textAlign: 'right' }}>Agend.</div>
              <div style={{ textAlign: 'right' }}>Conv.</div>
              <div style={{ textAlign: 'right' }}>Receita</div>
              <div></div>
            </div>
            {campanhas.slice(0, 10).map((c, i) => {
              const conv = c.total ? (c.agend / c.total * 100) : 0
              return (
                <div
                  key={c.title}
                  onClick={() => {
                    const subset = enriched.filter(l => l.ad_title === c.title)
                    setDrilldown({ title: c.title, color: '#F59E0B', leads: subset })
                  }}
                  title={`Ver ${c.total} lead(s) dessa campanha`}
                  style={{
                    display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 90px 110px 24px',
                    gap: 10, padding: '12px', alignItems: 'center',
                    borderBottom: i < campanhas.slice(0, 10).length - 1 ? '1px solid #F8FAFC' : 'none',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                    background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {c.thumb
                      ? <img src={c.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                      : <Megaphone size={18} color="#fff" />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                      }}>{c.title}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: '#FFFBEB', color: '#92400E',
                        textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
                      }}>{c.platform}</span>
                    </div>
                    {c.body && (
                      <div style={{
                        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{c.body.replace(/\n/g, ' ').slice(0, 100)}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{c.total}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#7C3AED', fontVariantNumeric: 'tabular-nums' }}>{c.agend}</div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      background: conv >= 30 ? '#F0FDF4' : conv >= 15 ? '#FFFBEB' : '#FEF2F2',
                      color: conv >= 30 ? '#16A34A' : conv >= 15 ? '#D97706' : '#DC2626',
                    }}>{conv.toFixed(0)}%</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(c.receita)}</div>
                  <ChevronRight size={14} style={{ color: '#CBD5E1' }} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cruzamento horário × pago/orgânico */}
      <div className="nx-card" style={{ padding: '1.25rem' }}>
        <SectionTitle
          icon={Clock}
          text="Quando os leads chegam · pago × orgânico por período"
          right={<span>{enriched.length} leads · {periodoLabel}</span>}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {horarioCross.map(p => {
            const intensity = p.total / maxHorario
            return (
              <div key={p.key} style={{
                padding: '14px 16px', borderRadius: 10,
                background: `rgba(37, 99, 235, ${0.04 + intensity * 0.1})`,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>{p.range}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{p.total}</div>
                </div>
                {/* Mini barra dividida pago/orgânico */}
                {p.total > 0 && (
                  <>
                    <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#F1F5F9' }}>
                      {p.pago > 0 && (
                        <div style={{ width: `${(p.pago / p.total) * 100}%`, background: 'linear-gradient(90deg, #FBBF24, #F59E0B)' }} />
                      )}
                      {p.organico > 0 && (
                        <div style={{ flex: 1, background: 'linear-gradient(90deg, #34D399, #16A34A)' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                      <span><span style={{ color: '#F59E0B' }}>●</span> {p.pago} pago</span>
                      <span><span style={{ color: '#16A34A' }}>●</span> {p.organico} orgânico</span>
                    </div>
                  </>
                )}
                {p.total === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem leads</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Drill-down de campanha */}
      {drilldown && createPortal(
        <div onClick={() => setDrilldown(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div onClick={e => e.stopPropagation()} className="nx-card" style={{
            width: '100%', maxWidth: 720, maxHeight: 'calc(100vh - 3rem)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Megaphone size={18} color="#F59E0B" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drilldown.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {drilldown.leads.length} lead(s) · {drilldown.leads.filter(l => l.appts.length > 0).length} agendaram
                  </div>
                </div>
              </div>
              <button onClick={() => setDrilldown(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {drilldown.leads
                .slice()
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(l => (
                  <div key={l.id} onClick={() => openConversation(l)} style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr auto auto',
                    gap: 12, padding: '10px 14px', alignItems: 'center',
                    borderBottom: '1px solid #F8FAFC', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F59E0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {(l.nome || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.nome || cleanPhone(l.numero)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {cleanPhone(l.numero)}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: l.revenue > 0 ? '#059669' : '#94A3B8', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {l.revenue > 0 ? fmtMoney(l.revenue) : '—'}
                    </div>
                    <ChevronRight size={14} style={{ color: '#CBD5E1' }} />
                  </div>
                ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function Stat({ label, value, sub, color, mono }) {
  return (
    <div>
      <div style={{
        fontSize: 18, fontWeight: 800, color: color || 'var(--text-primary)',
        lineHeight: 1, fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} {sub && <span style={{ color, opacity: 0.8 }}>· {sub}</span>}
      </div>
    </div>
  )
}

// ─── Tab: Atividades ────────────────────────────────────────────────────────
function AtividadesTab({ kanbanCards, kanbanColumns, users, range, period, loading }) {
  const { from, to } = range
  const cards = kanbanCards
  const inPeriodCards = cards.filter(c => inPeriod(c.created_at, from, to) || (!from && !to))
  const total = inPeriodCards.length
  const atrasados = cards.filter(c => c.due_date && new Date(`${c.due_date}T23:59:59`) < new Date()).length
  const semAtribuir = cards.filter(c => !c.assigned_user_id).length
  const urgentes = cards.filter(c => c.priority === 'urgente').length

  const byColumn = useMemo(() => {
    return kanbanColumns.map(col => ({
      name: col.name,
      color: col.color,
      count: cards.filter(c => c.column_id === col.id).length,
    })).sort((a, b) => b.count - a.count)
  }, [kanbanColumns, cards])

  const byUser = useMemo(() => {
    const map = {}
    cards.forEach(c => {
      const k = c.assigned_user_name || 'Sem atribuição'
      map[k] = (map[k] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [cards])

  const byPriority = useMemo(() => {
    const map = {}
    cards.forEach(c => { map[c.priority || 'normal'] = (map[c.priority || 'normal'] || 0) + 1 })
    return ['urgente', 'alta', 'normal', 'baixa'].map(p => [p, map[p] || 0])
  }, [cards])

  const maxCol = Math.max(1, ...byColumn.map(c => c.count))
  const maxUser = Math.max(1, ...byUser.map(([, v]) => v))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard icon={<Kanban size={18} color="#2563EB" />} bg="#EFF6FF" value={cards.length} label="Total de cards" sub="todos os cards" loading={loading} />
        <KpiCard icon={<AlertCircle size={18} color="#DC2626" />} bg="#FEF2F2" value={atrasados} label="Atrasados" sub="data vencida" loading={loading} alert={atrasados > 0} />
        <KpiCard icon={<Flag size={18} color="#D97706" />} bg="#FFFBEB" value={urgentes} label="Urgentes" sub="prioridade urgente" loading={loading} alert={urgentes > 0} />
        <KpiCard icon={<Users size={18} color="#6B7280" />} bg="#F3F4F6" value={semAtribuir} label="Sem atribuição" sub="aguardando designação" loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={Layers} text="Por coluna" right="todas" />
          {byColumn.length === 0 ? <Empty /> : byColumn.map(col => (
            <div key={col.name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{col.name}</span>
                <span style={{ fontWeight: 700, color: col.color }}>{col.count}</span>
              </div>
              <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(col.count / maxCol) * 100}%`, background: col.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="nx-card" style={{ padding: '1.25rem' }}>
          <SectionTitle icon={Users} text="Por atendente" right="todos" />
          {byUser.length === 0 ? <Empty /> : byUser.map(([name, count], i) => (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{name}</span>
                <span style={{ fontWeight: 700, color: ORIGEM_COLORS[i % ORIGEM_COLORS.length] }}>{count}</span>
              </div>
              <div style={{ height: 7, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count / maxUser) * 100}%`, background: ORIGEM_COLORS[i % ORIGEM_COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="nx-card" style={{ padding: '1.25rem', marginTop: 14 }}>
        <SectionTitle icon={Flag} text="Por prioridade" right="todos" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {byPriority.map(([k, v]) => {
            const meta = PRIORITY_META[k]
            return (
              <div key={k} style={{ padding: '10px 12px', background: meta.color + '11', border: `1px solid ${meta.color}33`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: 'uppercase' }}>{meta.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: meta.color, marginTop: 2 }}>{v}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ─────────────────────────────────────────────────
function KpiCard({ icon, bg, value, label, sub, loading, alert }) {
  return (
    <div className="nx-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        {alert && <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 20, padding: '2px 8px' }}>Atenção</span>}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{loading ? '—' : value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, text, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Icon size={15} color="#2563EB" />
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{text}</div>
      {right && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{right}</span>}
    </div>
  )
}

function Empty() {
  return <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>Sem dados</div>
}

function BarTimeline({ data }) {
  if (data.length === 0) return <Empty />
  const max = Math.max(...data.map(d => d[1]))
  const BAR_H = 90
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {data.map(([k, v]) => (
          <div key={k} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#2563EB', minWidth: 0 }}>{v}</div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: BAR_H }}>
        {data.map(([k, v]) => (
          <div key={k} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', minWidth: 0 }}>
            <div style={{ width: '100%', height: `${Math.max((v / max) * 100, 5)}%`, background: '#2563EB', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
        {data.map(([k]) => (
          <div key={k} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</div>
        ))}
      </div>
    </div>
  )
}

function HourChart({ data }) {
  const max = Math.max(...data, 1)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
            <div title={`${i}h: ${v} mensagens`} style={{
              width: '100%',
              height: `${Math.max((v / max) * 100, v ? 4 : 0)}%`,
              background: v > max * 0.7 ? '#DC2626' : v > max * 0.4 ? '#D97706' : '#2563EB',
              borderRadius: '3px 3px 0 0', opacity: v ? 0.85 : 0.2,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
        {data.map((_, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-muted)' }}>{i % 3 === 0 ? `${i}h` : ''}</div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ data }) {
  const total = data.reduce((a, b) => a + b.value, 0)
  if (total === 0) return null
  const SIZE = 120
  const RADIUS = 50
  const CIRC = 2 * Math.PI * RADIUS
  let acc = 0
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#F1F5F9" strokeWidth={14} />
      {data.map((d, i) => {
        const portion = d.value / total
        const dash = portion * CIRC
        const offset = -acc * CIRC
        acc += portion
        return (
          <circle key={i}
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke={d.color} strokeWidth={14}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dasharray 0.4s' }}
          />
        )
      })}
      <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: '#0F172A' }}>{total}</text>
      <text x={SIZE / 2} y={SIZE / 2 + 12} textAnchor="middle" style={{ fontSize: 10, fill: '#64748B' }}>total</text>
    </svg>
  )
}
