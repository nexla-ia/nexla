import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'
import {
  Plus, X, Trash2, Pencil, User as UserIcon, AlertTriangle, ChevronLeft, ChevronRight,
  MessageSquare, Calendar, Wallet, StickyNote, ArrowRightLeft, ClipboardList, Info,
  Bookmark, LayoutGrid, CheckCircle2, Filter, Target, Search, UserPlus, Flame, Users,
} from 'lucide-react'
import './Company.css'

const FUNNEL_COLORS = ['#2563EB', '#16A34A', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#DB2777']

const DEFAULT_STAGES = [
  { nome: 'Novo Lead',        cor: '#2563EB', alerta_dias: 1 },
  { nome: 'Primeiro Contato', cor: '#0891B2', alerta_dias: 2 },
  { nome: 'Agendou',          cor: '#7C3AED', alerta_dias: 3 },
  { nome: 'Compareceu',       cor: '#16A34A', alerta_dias: 5 },
  { nome: 'Retorno',          cor: '#D97706', alerta_dias: 7 },
  { nome: 'Fidelizado',       cor: '#059669', alerta_dias: 30 },
  { nome: 'Perdido',          cor: '#6B7280', alerta_dias: 9999 },
]

const TEMP_ORDER = ['frio', 'morno', 'quente']
const TEMP_STYLES = {
  frio:   { color: '#2563EB', bg: '#EFF6FF', label: 'Frio' },
  morno:  { color: '#D97706', bg: '#FFFBEB', label: 'Morno' },
  quente: { color: '#DC2626', bg: '#FEF2F2', label: 'Quente' },
}

const STALE_STYLES = {
  ok:     { bg: '#fff',     border: 'var(--border)' },
  yellow: { bg: '#FFFBEB',  border: '#FDE68A' },
  red:    { bg: '#FEF2F2',  border: '#FECACA' },
}

const TIPO_META = {
  nota:        { label: 'Nota',            color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', Icon: StickyNote },
  etapa:       { label: 'Mudança de etapa', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', Icon: ArrowRightLeft },
  tarefa:      { label: 'Tarefa',          color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', Icon: ClipboardList },
  sistema:     { label: 'Sistema',         color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', Icon: Info },
  mensagem:    { label: 'WhatsApp',        color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', Icon: MessageSquare },
  agendamento: { label: 'Agendamento',     color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', Icon: Calendar },
  financeiro:  { label: 'Financeiro',      color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', Icon: Wallet },
}

const DEFAULT_FILTERS = {
  temperatura: 'todas', stageId: 'todas', diasMin: '', diasMax: '',
  origem: 'todas', tag: '', responsavel: 'todos',
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

function daysIn(dateStr) {
  if (!dateStr) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

function staleLevel(contact, stage) {
  if (!stage) return 'ok'
  const d = daysIn(contact.data_entrada_etapa)
  const limit = stage.alerta_dias || 0
  if (d > limit + 14) return 'red'
  if (d > limit) return 'yellow'
  return 'ok'
}

function cycleTemp(current) {
  const idx = TEMP_ORDER.indexOf(current)
  return TEMP_ORDER[(idx + 1) % TEMP_ORDER.length]
}

// Parser simples de timestamp "DD/MM/AAAA HH:MI:SS" (mesmo formato de mensagens_geral.horaLastMessage)
function parseSimpleTimestamp(val) {
  if (!val) return null
  if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
    const sp = val.indexOf(' ')
    const datePart = sp >= 0 ? val.slice(0, sp) : val
    const timePart = sp >= 0 ? val.slice(sp + 1) : '00:00:00'
    const [d, m, y] = datePart.split('/')
    if (!d || !m || !y) return null
    const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`)
    return isNaN(dt.getTime()) ? null : dt.toISOString()
  }
  const dt = new Date(val)
  return isNaN(dt.getTime()) ? null : val
}

function fmtDateTime(val) {
  if (!val) return '—'
  const dt = new Date(val)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function CompanyCRM() {
  const { session } = useAuth()
  const instance = session?.company?.instance
  const companyId = session?.company?.id
  const isAdmin = session?.user?.role === 'admin'

  const [funnels, setFunnels]   = useState([])
  const [stages, setStages]     = useState([])
  const [contacts, setContacts] = useState([])
  const [lists, setLists]       = useState([])
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)

  const [activeFunnelId, setActiveFunnelId] = useState(null)
  const [view, setView] = useState('board') // 'board' | 'alertas' | 'listas'

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [toast, setToast] = useState(null)

  // Funil
  const [funnelModal, setFunnelModal] = useState(null)
  const [funnelErr, setFunnelErr]     = useState('')
  const [savingFunnel, setSavingFunnel] = useState(false)

  // Etapa
  const [stageModal, setStageModal] = useState(null)
  const [stageErr, setStageErr]     = useState('')
  const [savingStage, setSavingStage] = useState(false)
  const [confirmDeleteStage, setConfirmDeleteStage] = useState(null)

  // Lista
  const [listModal, setListModal] = useState(null)
  const [listErr, setListErr]     = useState('')
  const [savingList, setSavingList] = useState(false)
  const [confirmDeleteList, setConfirmDeleteList] = useState(null)

  const [deletingNow, setDeletingNow] = useState(false)

  // Card: edição inline de nome
  const [editingNameId, setEditingNameId] = useState(null)
  const [editingNameValue, setEditingNameValue] = useState('')

  // Painel lateral do contato
  const [panelContact, setPanelContact]   = useState(null)
  const [panelTimeline, setPanelTimeline] = useState([])
  const [panelLoading, setPanelLoading]   = useState(false)
  const [noteText, setNoteText]           = useState('')
  const [savingNote, setSavingNote]       = useState(false)
  const [confirmDeleteContact, setConfirmDeleteContact] = useState(null)

  const dragContact = useRef(null)
  const [dragOver, setDragOver] = useState({ stageId: null, position: null })

  function showToast(message, color = '#16A34A') {
    setToast({ message, color })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Carrega tudo + seed automático ──────────────────────────────────
  async function load() {
    if (!instance) return
    setLoading(true)
    const [{ data: f }, { data: st }, { data: co }, { data: li }, { data: us }] = await Promise.all([
      supabase.from('crm_funnels').select('*').eq('instancia', instance).order('posicao'),
      supabase.from('crm_stages').select('*').eq('instancia', instance).order('posicao'),
      supabase.from('crm_contacts').select('*').eq('instancia', instance),
      supabase.from('crm_lists').select('*').eq('instancia', instance).order('created_at'),
      supabase.from('users').select('id, name, email, active').eq('company_id', companyId),
    ])

    let funnelsList = f || []
    let stagesList  = st || []

    if (funnelsList.length === 0) {
      const { data: newFunnel, error: funnelErr } = await supabase
        .from('crm_funnels')
        .insert({ instancia: instance, nome: 'Funil Principal', posicao: 0, is_default: true })
        .select().single()

      if (funnelErr || !newFunnel) {
        // Corrida: outra aba já criou o funil padrão — só refaz o select em vez de duplicar.
        const [{ data: f2 }, { data: st2 }] = await Promise.all([
          supabase.from('crm_funnels').select('*').eq('instancia', instance).order('posicao'),
          supabase.from('crm_stages').select('*').eq('instancia', instance).order('posicao'),
        ])
        funnelsList = f2 || []
        stagesList  = st2 || []
      } else {
        funnelsList = [newFunnel]
        const stagesToInsert = DEFAULT_STAGES.map((s, i) => ({
          funil_id: newFunnel.id, instancia: instance, nome: s.nome, cor: s.cor, posicao: i, alerta_dias: s.alerta_dias,
        }))
        const { data: newStages } = await supabase.from('crm_stages').insert(stagesToInsert).select()
        stagesList = newStages || []
      }
    }

    setFunnels(funnelsList)
    setStages(stagesList)
    setContacts(co || [])
    setLists(li || [])
    setUsers((us || []).filter(u => u.active !== false))
    setActiveFunnelId(prev => prev && funnelsList.some(x => x.id === prev) ? prev : (funnelsList[0]?.id || null))
    setLoading(false)
  }

  useEffect(() => { load() }, [instance, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime
  useEffect(() => {
    if (!instance) return
    const ch = supabase.channel(`crm-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_contacts', filter: `instancia=eq.${instance}` },
        (p) => {
          if (p.eventType === 'DELETE') setContacts(prev => prev.filter(c => c.id !== p.old.id))
          else if (p.new) setContacts(prev => {
            const ex = prev.find(c => c.id === p.new.id)
            return ex ? prev.map(c => c.id === p.new.id ? p.new : c) : [...prev, p.new]
          })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_stages', filter: `instancia=eq.${instance}` },
        (p) => {
          if (p.eventType === 'DELETE') setStages(prev => prev.filter(s => s.id !== p.old.id))
          else if (p.new) setStages(prev => {
            const ex = prev.find(s => s.id === p.new.id)
            return (ex ? prev.map(s => s.id === p.new.id ? p.new : s) : [...prev, p.new]).sort((a, b) => a.posicao - b.posicao)
          })
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // ── Derivados ────────────────────────────────────────────────────────
  const funStages = useMemo(() =>
    stages.filter(s => s.funil_id === activeFunnelId).sort((a, b) => (a.posicao || 0) - (b.posicao || 0)),
    [stages, activeFunnelId])

  const origensDisponiveis = useMemo(() => {
    const set = new Set()
    contacts.forEach(c => { if (c.funil_id === activeFunnelId && c.origem) set.add(c.origem) })
    return Array.from(set).sort()
  }, [contacts, activeFunnelId])

  function matchesFilters(c) {
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const phoneDigits = q.replace(/\D/g, '')
      const nameHit = c.nome?.toLowerCase().includes(q)
      const phoneHit = phoneDigits && c.telefone?.includes(phoneDigits)
      if (!nameHit && !phoneHit) return false
    }
    if (filters.temperatura !== 'todas' && c.temperatura !== filters.temperatura) return false
    if (filters.stageId !== 'todas' && c.stage_id !== filters.stageId) return false
    if (filters.origem !== 'todas' && c.origem !== filters.origem) return false
    if (filters.tag.trim() && !(c.tag || '').toLowerCase().includes(filters.tag.trim().toLowerCase())) return false
    if (filters.responsavel === 'sem' && c.responsavel_id) return false
    if (filters.responsavel !== 'todos' && filters.responsavel !== 'sem' && c.responsavel_id !== filters.responsavel) return false
    if (filters.diasMin !== '' || filters.diasMax !== '') {
      const d = daysIn(c.data_entrada_etapa)
      if (filters.diasMin !== '' && d < Number(filters.diasMin)) return false
      if (filters.diasMax !== '' && d > Number(filters.diasMax)) return false
    }
    return true
  }

  const filteredContacts = useMemo(() =>
    contacts.filter(c => c.funil_id === activeFunnelId).filter(matchesFilters),
    [contacts, activeFunnelId, search, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const byStage = useMemo(() => {
    const m = {}
    filteredContacts.forEach(c => {
      if (!m[c.stage_id]) m[c.stage_id] = []
      m[c.stage_id].push(c)
    })
    Object.values(m).forEach(arr => arr.sort((a, b) => (a.position || 0) - (b.position || 0)))
    return m
  }, [filteredContacts])

  const staleContacts = useMemo(() => {
    return filteredContacts
      .map(c => ({ contact: c, stage: funStages.find(s => s.id === c.stage_id), level: staleLevel(c, funStages.find(s => s.id === c.stage_id)) }))
      .filter(x => x.level !== 'ok')
      .sort((a, b) => daysIn(b.contact.data_entrada_etapa) - daysIn(a.contact.data_entrada_etapa))
  }, [filteredContacts, funStages])

  // ── Funil CRUD ───────────────────────────────────────────────────────
  function openNewFunnelModal() {
    setFunnelModal({ nome: '' })
    setFunnelErr('')
  }
  async function handleSaveFunnel() {
    const nome = funnelModal.nome.trim()
    if (!nome) { setFunnelErr('Nome é obrigatório'); return }
    setSavingFunnel(true)
    const maxPos = funnels.length ? Math.max(...funnels.map(f => f.posicao || 0)) : 0
    const { data: newFunnel, error } = await supabase.from('crm_funnels')
      .insert({ instancia: instance, nome, posicao: maxPos + 1, is_default: false })
      .select().single()
    if (error || !newFunnel) {
      setSavingFunnel(false)
      setFunnelErr('Erro: ' + (error?.message || 'não foi possível criar'))
      return
    }
    const stagesToInsert = DEFAULT_STAGES.map((s, i) => ({
      funil_id: newFunnel.id, instancia: instance, nome: s.nome, cor: s.cor, posicao: i, alerta_dias: s.alerta_dias,
    }))
    const { data: newStages } = await supabase.from('crm_stages').insert(stagesToInsert).select()
    setFunnels(prev => [...prev, newFunnel])
    setStages(prev => [...prev, ...(newStages || [])])
    setActiveFunnelId(newFunnel.id)
    setSavingFunnel(false)
    setFunnelModal(null)
    showToast(`Funil "${nome}" criado`, '#16A34A')
  }

  // ── Etapa CRUD ───────────────────────────────────────────────────────
  function openEditStage(stage) {
    setStageModal({ ...stage })
    setStageErr('')
  }
  async function handleSaveStage() {
    if (!stageModal.nome?.trim()) { setStageErr('Nome é obrigatório'); return }
    setSavingStage(true)
    const payload = {
      nome: stageModal.nome.trim(),
      cor: stageModal.cor,
      alerta_dias: Math.max(0, Number(stageModal.alerta_dias) || 0),
    }
    const { error } = await supabase.from('crm_stages').update(payload).eq('id', stageModal.id)
    setSavingStage(false)
    if (error) { setStageErr('Erro: ' + error.message); return }
    setStages(prev => prev.map(s => s.id === stageModal.id ? { ...s, ...payload } : s))
    setStageModal(null)
  }
  async function moveStage(stage, dir) {
    const idx = funStages.findIndex(s => s.id === stage.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= funStages.length) return
    const other = funStages[swapIdx]
    const a = stage.posicao, b = other.posicao
    setStages(prev => prev.map(s => s.id === stage.id ? { ...s, posicao: b } : s.id === other.id ? { ...s, posicao: a } : s))
    await Promise.all([
      supabase.from('crm_stages').update({ posicao: b }).eq('id', stage.id),
      supabase.from('crm_stages').update({ posicao: a }).eq('id', other.id),
    ])
  }
  function handleDeleteStage(stage) {
    const hasContacts = contacts.some(c => c.stage_id === stage.id)
    if (hasContacts) {
      setStageErr('Essa etapa ainda tem leads. Mova ou exclua os leads antes de excluir a etapa.')
      return
    }
    setConfirmDeleteStage(stage)
  }
  async function confirmDeleteStageAction() {
    if (!confirmDeleteStage) return
    setDeletingNow(true)
    await supabase.from('crm_stages').delete().eq('id', confirmDeleteStage.id)
    setStages(prev => prev.filter(s => s.id !== confirmDeleteStage.id))
    setDeletingNow(false)
    setConfirmDeleteStage(null)
    setStageModal(null)
  }

  // ── Lead CRUD ────────────────────────────────────────────────────────
  async function createLead(stageId) {
    const stageContacts = contacts.filter(c => c.stage_id === stageId)
    const maxPos = stageContacts.length ? Math.max(...stageContacts.map(c => c.position || 0)) : 0
    const { data, error } = await supabase.from('crm_contacts').insert({
      instancia: instance, funil_id: activeFunnelId, stage_id: stageId,
      nome: 'Novo lead', temperatura: 'morno',
      data_entrada_etapa: new Date().toISOString(),
      position: maxPos + 1,
      created_by_email: session?.user?.email,
    }).select().single()
    if (error || !data) { showToast('Erro ao criar lead: ' + (error?.message || ''), '#DC2626'); return }
    setContacts(prev => [...prev, data])
    setEditingNameId(data.id)
    setEditingNameValue('Novo lead')
  }

  function startEditName(contact) {
    setEditingNameId(contact.id)
    setEditingNameValue(contact.nome || '')
  }
  async function commitEditName() {
    const id = editingNameId
    const value = editingNameValue.trim()
    setEditingNameId(null)
    if (!id || !value) return
    setContacts(prev => prev.map(c => c.id === id ? { ...c, nome: value } : c))
    if (panelContact?.id === id) setPanelContact(prev => ({ ...prev, nome: value }))
    await supabase.from('crm_contacts').update({ nome: value }).eq('id', id)
  }

  async function handleCycleTemp(e, contact) {
    e.stopPropagation()
    const next = cycleTemp(contact.temperatura)
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, temperatura: next } : c))
    if (panelContact?.id === contact.id) setPanelContact(prev => ({ ...prev, temperatura: next }))
    await supabase.from('crm_contacts').update({ temperatura: next }).eq('id', contact.id)
  }

  function handleDeleteContact(contact) {
    setConfirmDeleteContact(contact)
  }
  async function confirmDeleteContactAction() {
    if (!confirmDeleteContact) return
    setDeletingNow(true)
    await supabase.from('crm_contacts').delete().eq('id', confirmDeleteContact.id)
    setContacts(prev => prev.filter(c => c.id !== confirmDeleteContact.id))
    setDeletingNow(false)
    setConfirmDeleteContact(null)
    if (panelContact?.id === confirmDeleteContact.id) setPanelContact(null)
  }

  // ── Drag & drop ──────────────────────────────────────────────────────
  function onDragStart(e, contact) {
    dragContact.current = contact
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOverCol(e, stageId) {
    e.preventDefault()
    setDragOver(prev => prev.stageId === stageId ? prev : { stageId, position: null })
  }
  function onDragOverCard(e, stageId, position) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver({ stageId, position })
  }
  async function onDrop(stageId) {
    const contact = dragContact.current
    dragContact.current = null
    setDragOver({ stageId: null, position: null })
    if (!contact) return

    const changingStage = contact.stage_id !== stageId
    const targetContacts = contacts.filter(c => c.stage_id === stageId && c.id !== contact.id).sort((a, b) => (a.position || 0) - (b.position || 0))
    const overPos = dragOver.position
    let newPos
    if (overPos == null || targetContacts.length === 0) {
      newPos = targetContacts.length ? Math.max(...targetContacts.map(c => c.position || 0)) + 1 : 1
    } else {
      const before = targetContacts[overPos - 1]?.position
      const after = targetContacts[overPos]?.position
      if (before != null && after != null) newPos = (before + after) / 2
      else if (after != null) newPos = after - 0.5
      else if (before != null) newPos = before + 1
      else newPos = 1
    }

    const payload = { stage_id: stageId, position: newPos }
    if (changingStage) payload.data_entrada_etapa = new Date().toISOString()

    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, ...payload } : c))
    await supabase.from('crm_contacts').update(payload).eq('id', contact.id)

    if (changingStage) {
      const fromStage = stages.find(s => s.id === contact.stage_id)
      const toStage = stages.find(s => s.id === stageId)
      await supabase.from('crm_interactions').insert({
        instancia: instance,
        crm_contact_id: contact.id,
        telefone: contact.telefone || null,
        tipo: 'etapa',
        descricao: `Moveu de "${fromStage?.nome || '?'}" para "${toStage?.nome || '?'}"`,
        de_stage_nome: fromStage?.nome || null,
        para_stage_nome: toStage?.nome || null,
        created_by_email: session?.user?.email,
      })
    }
  }

  // ── Listas (segmentação salva) ───────────────────────────────────────
  function openSaveListModal() {
    setListModal({ nome: '' })
    setListErr('')
  }
  async function handleSaveList() {
    if (!listModal.nome?.trim()) { setListErr('Nome é obrigatório'); return }
    setSavingList(true)
    const { data, error } = await supabase.from('crm_lists').insert({
      instancia: instance, funil_id: activeFunnelId, nome: listModal.nome.trim(), filtros: filters,
    }).select().single()
    setSavingList(false)
    if (error) { setListErr('Erro: ' + error.message); return }
    setLists(prev => [...prev, data])
    setListModal(null)
    showToast('Lista salva', '#16A34A')
  }
  function applyListFilter(list) {
    setFilters({ ...DEFAULT_FILTERS, ...(list.filtros || {}) })
    setActiveFunnelId(list.funil_id)
    setSearch('')
    setView('board')
  }
  function handleDeleteList(list) { setConfirmDeleteList(list) }
  async function confirmDeleteListAction() {
    if (!confirmDeleteList) return
    setDeletingNow(true)
    await supabase.from('crm_lists').delete().eq('id', confirmDeleteList.id)
    setLists(prev => prev.filter(l => l.id !== confirmDeleteList.id))
    setDeletingNow(false)
    setConfirmDeleteList(null)
  }

  // ── Painel do contato: timeline unificada ───────────────────────────
  async function openPanel(contact) {
    setPanelContact(contact)
    setPanelTimeline([])
    setNoteText('')
    setPanelLoading(true)
    const digits = (contact.telefone || '').replace(/\D/g, '')

    const [
      { data: interactions },
      { data: messages },
      { data: appts },
      { data: transactions },
      { data: tasks },
    ] = await Promise.all([
      supabase.from('crm_interactions').select('*').eq('crm_contact_id', contact.id).order('created_at', { ascending: false }),
      digits
        ? supabase.from('mensagens_geral').select('numero, mensagem, type, horaLastMessage, created_at').eq('instancia', instance).like('numero', `${digits}%`).order('id', { ascending: false }).limit(40)
        : Promise.resolve({ data: [] }),
      digits
        ? supabase.from('appointments').select('*').eq('instancia', instance).eq('contact_numero', digits)
        : Promise.resolve({ data: [] }),
      contact.contact_id
        ? supabase.from('financial_transactions').select('*').eq('instancia', instance).eq('contact_id', contact.contact_id)
        : Promise.resolve({ data: [] }),
      contact.contact_id
        ? supabase.from('kanban_cards').select('*').eq('instancia', instance).eq('contact_id', contact.contact_id)
        : Promise.resolve({ data: [] }),
    ])

    const items = []
    ;(interactions || []).forEach(i => items.push({
      id: `int-${i.id}`, date: i.created_at, tipo: i.tipo, texto: i.descricao,
    }))
    ;(messages || []).forEach((m, idx) => items.push({
      id: `msg-${idx}`, date: parseSimpleTimestamp(m.horaLastMessage) || m.created_at, tipo: 'mensagem',
      texto: `${m.type === 'ia' ? 'IA' : m.type === 'atendente' ? 'Atendente' : 'Cliente'}: ${(m.mensagem || '').slice(0, 160)}`,
    }))
    ;(appts || []).forEach(a => items.push({
      id: `appt-${a.id}`, date: a.starts_at, tipo: 'agendamento',
      texto: `Status: ${a.status || 'agendado'}${a.price ? ' · R$ ' + Number(a.price).toFixed(2) : ''}`,
    }))
    ;(transactions || []).forEach(t => items.push({
      id: `fin-${t.id}`, date: t.pagamento_at || t.vencimento || t.created_at, tipo: 'financeiro',
      texto: `${t.tipo === 'receita' ? 'Receita' : 'Despesa'}: ${t.descricao || ''} · R$ ${Number(t.valor || 0).toFixed(2)} (${t.status})`,
    }))
    ;(tasks || []).forEach(k => items.push({
      id: `task-${k.id}`, date: k.due_date || contact.created_at, tipo: 'tarefa',
      texto: k.title,
    }))

    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    setPanelTimeline(items)
    setPanelLoading(false)
  }

  async function updatePanelField(field, value) {
    setPanelContact(prev => ({ ...prev, [field]: value }))
    setContacts(prev => prev.map(c => c.id === panelContact.id ? { ...c, [field]: value } : c))
    await supabase.from('crm_contacts').update({ [field]: value }).eq('id', panelContact.id)
  }
  async function updatePanelResponsavel(userId) {
    const u = users.find(x => x.id === userId)
    const payload = { responsavel_id: u?.id || null, responsavel_nome: u?.name || null }
    setPanelContact(prev => ({ ...prev, ...payload }))
    setContacts(prev => prev.map(c => c.id === panelContact.id ? { ...c, ...payload } : c))
    await supabase.from('crm_contacts').update(payload).eq('id', panelContact.id)
  }
  async function addNote() {
    const text = noteText.trim()
    if (!text || !panelContact) return
    setSavingNote(true)
    const { data, error } = await supabase.from('crm_interactions').insert({
      instancia: instance, crm_contact_id: panelContact.id, telefone: panelContact.telefone || null,
      tipo: 'nota', descricao: text, created_by_email: session?.user?.email,
    }).select().single()
    setSavingNote(false)
    if (!error && data) {
      setNoteText('')
      setPanelTimeline(prev => [{ id: `int-${data.id}`, date: data.created_at, tipo: 'nota', texto: data.descricao }, ...prev])
    }
  }

  const activeFunnel = funnels.find(f => f.id === activeFunnelId)
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div className="nx-card" style={{ padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Target size={18} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.2 }}>CRM</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pipeline de contatos</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {funnels.map(f => (
              <button key={f.id} onClick={() => setActiveFunnelId(f.id)}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${activeFunnelId === f.id ? '#111827' : 'var(--border)'}`,
                  background: activeFunnelId === f.id ? '#111827' : '#fff',
                  color: activeFunnelId === f.id ? '#fff' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}>
                {f.nome}
              </button>
            ))}
            <button onClick={openNewFunnelModal} title="Novo funil"
              style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}>
              <Plus size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                <Users size={12} /> {loading ? '—' : filteredContacts.length}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>leads</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                <Flame size={12} /> {loading ? '—' : filteredContacts.filter(c => c.temperatura === 'quente').length}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>quentes</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                <AlertTriangle size={12} /> {loading ? '—' : staleContacts.length}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>parados</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { id: 'board', label: 'Board', Icon: LayoutGrid },
              { id: 'alertas', label: 'Alertas', Icon: AlertTriangle, count: staleContacts.length },
              { id: 'listas', label: 'Listas', Icon: Bookmark },
            ].map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: view === t.id ? '#F1F5F9' : '#fff',
                  color: view === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderLeft: t.id !== 'board' ? '1px solid var(--border)' : 'none',
                }}>
                <t.Icon size={12} /> {t.label}
                {t.count > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '1px 5px', minWidth: 14, textAlign: 'center' }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {view !== 'listas' && (
            <>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input className="nx-input" style={{ fontSize: 12, paddingLeft: 26, width: 160 }}
                  placeholder="Buscar lead..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="nx-select" style={{ fontSize: 12 }}
                value={filters.temperatura} onChange={e => setFilters(p => ({ ...p, temperatura: e.target.value }))}>
                <option value="todas">Todos</option>
                <option value="frio">Frio</option>
                <option value="morno">Morno</option>
                <option value="quente">Quente</option>
              </select>
              <button onClick={() => setFiltersOpen(o => !o)} title="Mais filtros"
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${filtersActive ? '#2563EB' : 'var(--border)'}`,
                  background: filtersActive ? '#EFF6FF' : '#fff',
                  color: filtersActive ? '#2563EB' : 'var(--text-secondary)',
                }}>
                <Filter size={13} />
              </button>
              <button onClick={() => funStages[0] && createLead(funStages[0].id)}
                disabled={funStages.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  padding: '8px 14px', borderRadius: 8, cursor: funStages.length ? 'pointer' : 'not-allowed',
                  border: 'none', background: '#111827', color: '#fff', opacity: funStages.length ? 1 : 0.5,
                }}>
                <UserPlus size={13} /> Novo Lead
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros avançados */}
      {view !== 'listas' && filtersOpen && (
        <div className="nx-card" style={{ padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="nx-select" style={{ fontSize: 12 }}
            value={filters.stageId} onChange={e => setFilters(p => ({ ...p, stageId: e.target.value }))}>
            <option value="todas">Todas etapas</option>
            {funStages.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <input className="nx-input" type="number" placeholder="Dias mín." style={{ width: 90, fontSize: 12 }}
            value={filters.diasMin} onChange={e => setFilters(p => ({ ...p, diasMin: e.target.value }))} />
          <input className="nx-input" type="number" placeholder="Dias máx." style={{ width: 90, fontSize: 12 }}
            value={filters.diasMax} onChange={e => setFilters(p => ({ ...p, diasMax: e.target.value }))} />
          <select className="nx-select" style={{ fontSize: 12 }}
            value={filters.origem} onChange={e => setFilters(p => ({ ...p, origem: e.target.value }))}>
            <option value="todas">Todas origens</option>
            {origensDisponiveis.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <input className="nx-input" placeholder="Tag..." style={{ width: 120, fontSize: 12 }}
            value={filters.tag} onChange={e => setFilters(p => ({ ...p, tag: e.target.value }))} />
          <select className="nx-select" style={{ fontSize: 12 }}
            value={filters.responsavel} onChange={e => setFilters(p => ({ ...p, responsavel: e.target.value }))}>
            <option value="todos">Todos responsáveis</option>
            <option value="sem">Sem responsável</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {filtersActive && (
            <button onClick={() => setFilters(DEFAULT_FILTERS)}
              style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>
              Limpar
            </button>
          )}
          <button onClick={openSaveListModal}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
              padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#7C3AED',
            }}>
            <Bookmark size={12} /> Salvar como lista
          </button>
        </div>
      )}

      {/* Board */}
      {view === 'board' && (
        !loading && funStages.length === 0 ? (
          <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhuma etapa configurada neste funil ainda.
          </div>
        ) : (
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 14, paddingBottom: 8 }}>
            {funStages.map((stage, stageIdx) => {
              const stageContacts = byStage[stage.id] || []
              const isDragTarget = dragOver.stageId === stage.id
              return (
                <div key={stage.id}
                  onDragOver={e => onDragOverCol(e, stage.id)}
                  onDrop={() => onDrop(stage.id)}
                  style={{
                    width: 270, flexShrink: 0,
                    background: '#F8FAFC', border: `1px solid ${isDragTarget ? stage.cor : 'var(--border)'}`,
                    borderRadius: 10, padding: 10,
                    display: 'flex', flexDirection: 'column', maxHeight: '100%',
                    transition: 'border-color 0.15s',
                  }}>
                  <div style={{ marginBottom: 8, padding: '4px 6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.cor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stage.nome}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {isAdmin && (
                          <button onClick={() => openEditStage(stage)} title="Editar etapa"
                            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 3 }}>
                            <Pencil size={11} />
                          </button>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: '0 6px', borderRadius: 20,
                          background: stage.cor, color: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {stageContacts.length}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: stage.cor, fontWeight: 600, marginTop: 2, paddingLeft: 15 }}>
                      alerta após {stage.alerta_dias}d
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '0 2px 2px' }}>
                    {stageContacts.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
                        Sem leads
                      </div>
                    )}
                    {stageContacts.map((c, idx) => {
                      const level = staleLevel(c, stage)
                      const st = STALE_STYLES[level]
                      const temp = TEMP_STYLES[c.temperatura] || TEMP_STYLES.morno
                      const days = daysIn(c.data_entrada_etapa)
                      return (
                        <div key={c.id}
                          draggable={editingNameId !== c.id}
                          onDragStart={e => onDragStart(e, c)}
                          onDragOver={e => onDragOverCard(e, stage.id, idx)}
                          onClick={() => editingNameId !== c.id && openPanel(c)}
                          style={{
                            background: st.bg, border: `1px solid ${st.border}`,
                            borderLeft: `3px solid ${temp.color}`,
                            borderRadius: 8, padding: '9px 11px', cursor: 'grab',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <button onClick={e => handleCycleTemp(e, c)} title={`Temperatura: ${temp.label} (clique pra mudar)`}
                              style={{ width: 9, height: 9, borderRadius: '50%', background: temp.color, border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }} />
                            {editingNameId === c.id ? (
                              <input autoFocus className="nx-input" style={{ fontSize: 13, padding: '2px 6px', flex: 1 }}
                                value={editingNameValue}
                                onChange={e => setEditingNameValue(e.target.value)}
                                onBlur={commitEditName}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitEditName() }
                                  if (e.key === 'Escape') setEditingNameId(null)
                                }} />
                            ) : (
                              <div onClick={e => { e.stopPropagation(); startEditName(c) }}
                                style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.nome}
                              </div>
                            )}
                          </div>
                          {c.telefone && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>{c.telefone}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            {level !== 'ok' && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                                color: level === 'red' ? '#DC2626' : '#D97706',
                                background: level === 'red' ? '#FEE2E2' : '#FEF3C7',
                              }}>
                                <AlertTriangle size={9} /> {days}d parado
                              </span>
                            )}
                            {c.origem && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5, color: '#0891B2', background: '#ECFEFF', border: '1px solid #A5F3FC' }}>
                                {c.origem}
                              </span>
                            )}
                            {c.tag && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5, color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                                {c.tag}
                              </span>
                            )}
                            {c.responsavel_nome && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto',
                                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color: '#fff', background: '#2563EB',
                              }}>
                                <UserIcon size={9} /> {c.responsavel_nome.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <button onClick={() => createLead(stage.id)}
                    style={{
                      marginTop: 8, padding: '7px 10px', borderRadius: 6,
                      background: 'transparent', border: '1px dashed var(--border)',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = stage.cor; e.currentTarget.style.color = stage.cor }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <Plus size={12} /> Adicionar lead
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Alertas */}
      {view === 'alertas' && (
        <div className="nx-card" style={{ flex: 1, overflow: 'auto' }}>
          {staleContacts.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum lead parado. 🎉
            </div>
          ) : staleContacts.map(({ contact: c, stage, level }) => {
            const temp = TEMP_STYLES[c.temperatura] || TEMP_STYLES.morno
            return (
              <div key={c.id} onClick={() => openPanel(c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: level === 'red' ? '#FEF2F2' : '#FFFBEB',
                }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.98)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: temp.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{c.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {stage?.nome || '—'} {c.telefone && `· ${c.telefone}`}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  color: level === 'red' ? '#DC2626' : '#D97706',
                  background: level === 'red' ? '#FEE2E2' : '#FEF3C7',
                  border: `1px solid ${level === 'red' ? '#FECACA' : '#FDE68A'}`,
                  display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                }}>
                  <AlertTriangle size={11} /> {daysIn(c.data_entrada_etapa)} dias parado
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Listas */}
      {view === 'listas' && (
        <div className="nx-card" style={{ flex: 1, overflow: 'auto' }}>
          {lists.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhuma lista salva ainda. Vá no Board, ajuste os filtros e clique em "Salvar como lista".
            </div>
          ) : lists.map(l => {
            const fn = funnels.find(f => f.id === l.funil_id)
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <Bookmark size={15} style={{ color: '#7C3AED', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{l.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Funil: {fn?.nome || '—'}</div>
                </div>
                <button onClick={() => applyListFilter(l)}
                  style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
                  Aplicar
                </button>
                <button onClick={() => handleDeleteList(l)} title="Excluir lista"
                  style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal novo funil */}
      {funnelModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Novo funil</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setFunnelModal(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome do funil</label>
                <input className="nx-input" autoFocus placeholder="Ex: Funil de Convênios"
                  value={funnelModal.nome} onChange={e => setFunnelModal(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                O funil já nasce com as 7 etapas padrão: Novo Lead → Primeiro Contato → Agendou → Compareceu → Retorno → Fidelizado → Perdido.
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {funnelErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{funnelErr}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setFunnelModal(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveFunnel} disabled={savingFunnel}>
                  {savingFunnel ? 'Criando...' : 'Criar funil'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal editar etapa */}
      {stageModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Editar etapa</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setStageModal(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input className="nx-input" autoFocus value={stageModal.nome}
                  onChange={e => setStageModal(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Cor</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FUNNEL_COLORS.map(c => (
                    <button key={c} onClick={() => setStageModal(p => ({ ...p, cor: c }))}
                      style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: stageModal.cor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Prazo de alerta (dias)</label>
                <input className="nx-input" type="number" min={0} value={stageModal.alerta_dias}
                  onChange={e => setStageModal(p => ({ ...p, alerta_dias: e.target.value }))} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Passou desse prazo sem mudar de etapa → fica amarelo. Mais 14 dias além disso → fica vermelho.
                </div>
              </div>
              <div>
                <label style={labelStyle}>Posição</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => moveStage(stageModal, -1)}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <ChevronLeft size={13} /> Mover pra esquerda
                  </button>
                  <button onClick={() => moveStage(stageModal, 1)}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Mover pra direita <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {stageErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{stageErr}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => handleDeleteStage(stageModal)}
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={13} /> Excluir
                </button>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setStageModal(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveStage} disabled={savingStage}>
                  {savingStage ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal salvar lista */}
      {listModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Salvar como lista</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setListModal(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <label style={labelStyle}>Nome da lista</label>
              <input className="nx-input" autoFocus placeholder="Ex: Leads quentes sem retorno"
                value={listModal.nome} onChange={e => setListModal(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {listErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{listErr}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setListModal(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveList} disabled={savingList}>
                  {savingList ? 'Salvando...' : 'Salvar lista'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Painel lateral do contato */}
      {panelContact && createPortal(
        <>
          <div onClick={() => setPanelContact(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 9998, backdropFilter: 'blur(2px)' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100%',
            background: '#fff', zIndex: 9999, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingNameId === panelContact.id ? (
                  <input autoFocus className="nx-input" style={{ fontSize: 16, fontWeight: 700, padding: '4px 8px' }}
                    value={editingNameValue}
                    onChange={e => setEditingNameValue(e.target.value)}
                    onBlur={commitEditName}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEditName() } if (e.key === 'Escape') setEditingNameId(null) }} />
                ) : (
                  <div onClick={() => startEditName(panelContact)} style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', cursor: 'text' }}>
                    {panelContact.nome}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button onClick={e => handleCycleTemp(e, panelContact)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
                      padding: '3px 9px', borderRadius: 20, cursor: 'pointer', border: 'none',
                      color: TEMP_STYLES[panelContact.temperatura]?.color, background: TEMP_STYLES[panelContact.temperatura]?.bg,
                    }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: TEMP_STYLES[panelContact.temperatura]?.color }} />
                    {TEMP_STYLES[panelContact.temperatura]?.label}
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {stages.find(s => s.id === panelContact.stage_id)?.nome}
                  </span>
                </div>
              </div>
              <button onClick={() => setPanelContact(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <input className="nx-input" style={{ fontSize: 12 }} placeholder="5511999998888"
                    value={panelContact.telefone || ''}
                    onChange={e => setPanelContact(prev => ({ ...prev, telefone: e.target.value }))}
                    onBlur={e => updatePanelField('telefone', e.target.value.replace(/\D/g, ''))} />
                </div>
                <div>
                  <label style={labelStyle}>Origem</label>
                  <input className="nx-input" style={{ fontSize: 12 }} placeholder="Instagram, indicação..."
                    value={panelContact.origem || ''}
                    onChange={e => setPanelContact(prev => ({ ...prev, origem: e.target.value }))}
                    onBlur={e => updatePanelField('origem', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Tag</label>
                  <input className="nx-input" style={{ fontSize: 12 }} placeholder="Ex: convênio X"
                    value={panelContact.tag || ''}
                    onChange={e => setPanelContact(prev => ({ ...prev, tag: e.target.value }))}
                    onBlur={e => updatePanelField('tag', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Responsável</label>
                  <select className="nx-select" style={{ fontSize: 12 }}
                    value={panelContact.responsavel_id || ''}
                    onChange={e => updatePanelResponsavel(e.target.value)}>
                    <option value="">Sem responsável</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => handleDeleteContact(panelContact)}
                style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}>
                <Trash2 size={11} /> Excluir lead
              </button>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <label style={labelStyle}>Adicionar nota</label>
              <textarea className="nx-input" rows={2} placeholder="Escreva uma nota sobre esse lead..."
                value={noteText} onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote() } }} />
              <button className="nx-btn-primary" style={{ marginTop: 6, fontSize: 12, padding: '6px 14px' }}
                onClick={addNote} disabled={savingNote || !noteText.trim()}>
                <StickyNote size={12} /> {savingNote ? 'Salvando...' : 'Adicionar nota'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Timeline
              </div>
              {panelLoading ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
              ) : panelTimeline.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum evento ainda.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {panelTimeline.map(item => {
                    const meta = TIPO_META[item.tipo] || TIPO_META.sistema
                    const Icon = meta.Icon
                    return (
                      <div key={item.id} style={{ display: 'flex', gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          background: meta.bg, border: `1px solid ${meta.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={12} style={{ color: meta.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtDateTime(item.date)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 2, whiteSpace: 'pre-wrap' }}>
                            {item.texto}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      , document.body)}

      <ConfirmModal
        open={!!confirmDeleteStage}
        variant="delete"
        title="Excluir etapa"
        message={`Tem certeza que deseja excluir a etapa "${confirmDeleteStage?.nome || ''}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir etapa"
        loading={deletingNow}
        onConfirm={confirmDeleteStageAction}
        onCancel={() => setConfirmDeleteStage(null)}
      />

      <ConfirmModal
        open={!!confirmDeleteList}
        variant="delete"
        title="Excluir lista"
        message={`Tem certeza que deseja excluir a lista "${confirmDeleteList?.nome || ''}"?`}
        confirmLabel="Excluir lista"
        loading={deletingNow}
        onConfirm={confirmDeleteListAction}
        onCancel={() => setConfirmDeleteList(null)}
      />

      <ConfirmModal
        open={!!confirmDeleteContact}
        variant="delete"
        title="Excluir lead"
        message={`Tem certeza que deseja excluir "${confirmDeleteContact?.nome || ''}"? O histórico de interações também será removido.`}
        confirmLabel="Excluir lead"
        loading={deletingNow}
        onConfirm={confirmDeleteContactAction}
        onCancel={() => setConfirmDeleteContact(null)}
      />

      {toast && createPortal(
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
          background: '#fff', border: `1.5px solid ${toast.color}`, borderRadius: 10,
          padding: '12px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: toast.color,
        }}>
          <CheckCircle2 size={16} /> {toast.message}
        </div>, document.body)}
    </div>
  )
}
