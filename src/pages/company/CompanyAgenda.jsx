import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'
import LimitReachedModal from '../../components/LimitReachedModal'
import { getEffectiveLimits, reachedLimit, upgradeMessage, formatLimit } from '../../lib/planLimits'
import {
  Calendar, Plus, X, Pencil, Trash2, ChevronLeft, ChevronRight,
  Clock, User as UserIcon, Phone, ListChecks, CheckCircle2, XCircle, AlertCircle, Settings,
  MessageSquare, History, Lock, Bell, BellOff
} from 'lucide-react'
import './Company.css'

const AGENDA_COLORS = ['#2563EB', '#16A34A', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#DB2777', '#059669']
const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90]
const DAYS_OF_WEEK = [
  { num: 0, label: 'Dom', full: 'Domingo' },
  { num: 1, label: 'Seg', full: 'Segunda' },
  { num: 2, label: 'Ter', full: 'Terça' },
  { num: 3, label: 'Qua', full: 'Quarta' },
  { num: 4, label: 'Qui', full: 'Quinta' },
  { num: 5, label: 'Sex', full: 'Sexta' },
  { num: 6, label: 'Sáb', full: 'Sábado' },
]

const STATUS_OPTIONS = [
  { value: 'agendado',   label: 'Agendado',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Calendar },
  { value: 'confirmado', label: 'Confirmado', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
  { value: 'concluido',  label: 'Concluído',  color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', icon: ListChecks },
  { value: 'faltou',     label: 'Faltou',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: AlertCircle },
  { value: 'cancelado',  label: 'Cancelado',  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: XCircle },
]

function getMonday(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // ajusta para segunda-feira
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}

function fmtDate(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtTimeInput(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseTimeStr(s) {
  if (!s) return [0, 0]
  const [h, m] = s.split(':').map(Number)
  return [h || 0, m || 0]
}

function timeToMinutes(s) {
  const [h, m] = parseTimeStr(s)
  return h * 60 + m
}

function minutesToTime(min) {
  const h = Math.floor(min / 60), m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function CompanyAgenda() {
  const { session } = useAuth()
  const navigate = useNavigate()

  function getUserName(email) {
    if (!email) return ''
    const u = (session?.company?.users || []).find(u => u.email === email)
    return u?.name?.split(' ')[0] || email
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const instance = session?.company?.instance
  const apiInstancia = session?.company?.api_instancia

  const [tab, setTab]                 = useState('calendario')
  const [agendas, setAgendas]         = useState([])
  const [appointments, setAppointments] = useState([])
  const [savedContacts, setSavedContacts] = useState([])
  const [allContacts, setAllContacts]     = useState([])
  const [professionals, setProfessionals] = useState([])
  const [procedures, setProcedures]   = useState([])
  const [insurancePlans, setInsurancePlans] = useState([])
  const [procedurePrices, setProcedurePrices] = useState([])
  const [selectedAgendaId, setSelectedAgendaId] = useState(null)
  const [weekStart, setWeekStart]     = useState(getMonday(new Date()))
  const [loading, setLoading]         = useState(true)

  const [agendaModal, setAgendaModal] = useState(null)
  const [agendaErr, setAgendaErr]     = useState('')
  const [savingAgenda, setSavingAgenda] = useState(false)
  const [limitModal, setLimitModal]   = useState(null)
  const [tooltip, setTooltip]         = useState(null) // { appt, x, y }

  const limits = getEffectiveLimits(session?.company)

  const [apptModal, setApptModal]     = useState(null)
  const [apptErr, setApptErr]         = useState('')
  const [savingAppt, setSavingAppt]   = useState(false)
  const [patientHistory, setPatientHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [confirmDeleteAgenda, setConfirmDeleteAgenda] = useState(null)
  const [confirmDeleteAppt, setConfirmDeleteAppt] = useState(false)
  const [deletingNow, setDeletingNow] = useState(false)
  const [draggingId, setDraggingId]     = useState(null)
  const [dragOverSlot, setDragOverSlot] = useState(null) // { dateStr, hhmm }

  // Carrega agendas + agendamentos + contatos
  useEffect(() => {
    if (!instance) return
    setLoading(true)
    Promise.all([
      supabase.from('agendas').select('*').eq('instancia', instance).order('name'),
      supabase.from('saved_contacts').select('id, nome, numero').eq('instancia', instance).order('nome'),
      supabase.from('professionals').select('*').eq('instancia', instance).order('name'),
      supabase.from('procedures').select('*').eq('instancia', instance).order('name'),
      supabase.from('insurance_plans').select('*').eq('instancia', instance).order('name'),
      supabase.from('procedure_prices').select('*'),
      supabase.from('mensagens_geral').select('numero, nome').eq('instancia', instance)
        .not('numero', 'like', '%@g.us').not('numero', 'like', '%@lid')
        .order('id', { ascending: false }).limit(400),
    ]).then(([{ data: ag }, { data: sc }, { data: pros }, { data: procs }, { data: plans }, { data: prices }, { data: mg }]) => {
      if (ag) {
        setAgendas(ag)
        if (!selectedAgendaId && ag.length) setSelectedAgendaId(ag[0].id)
      }
      if (sc) setSavedContacts(sc)
      // Mescla saved_contacts + contatos únicos de mensagens_geral (normaliza DDD)
      const scNums = new Set((sc || []).map(c => (c.numero || '').replace(/\D/g, '')))
      const seen = new Set(scNums)
      const mgExtra = (mg || [])
        .filter(m => {
          const n = (m.numero || '').replace(/@.*$/, '').replace(/\D/g, '')
          if (!n || seen.has(n)) return false
          seen.add(n)
          return true
        })
        .map(m => ({
          nome: m.nome || (m.numero || '').replace(/@.*$/, '').replace(/\D/g, ''),
          numero: (m.numero || '').replace(/@.*$/, '').replace(/\D/g, ''),
        }))
      setAllContacts([...(sc || []), ...mgExtra])
      if (pros) setProfessionals(pros.filter(p => p.active !== false))
      if (procs) setProcedures(procs.filter(p => p.active !== false))
      if (plans) setInsurancePlans(plans.filter(p => p.active !== false))
      if (prices) setProcedurePrices(prices)
      setLoading(false)
    })
  }, [instance])

  // Carrega agendamentos da semana
  useEffect(() => {
    if (!instance) return
    const from = new Date(weekStart); from.setHours(0, 0, 0, 0)
    const to = addDays(weekStart, 7); to.setHours(0, 0, 0, 0)
    supabase.from('appointments').select('*')
      .eq('instancia', instance)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .then(({ data }) => { if (data) setAppointments(data) })
  }, [instance, weekStart])

  // Realtime para agendamentos
  useEffect(() => {
    if (!instance) return
    const ch = supabase.channel(`appointments-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `instancia=eq.${instance}` },
        (p) => {
          if (p.eventType === 'DELETE') {
            setAppointments(prev => prev.filter(a => a.id !== p.old.id))
          } else if (p.new) {
            setAppointments(prev => {
              const exists = prev.find(a => a.id === p.new.id)
              if (exists) return prev.map(a => a.id === p.new.id ? p.new : a)
              return [...prev, p.new]
            })
          }
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  function openNewAgenda() {
    if (reachedLimit(agendas.length, limits.agendas)) {
      setLimitModal(upgradeMessage('agendas', limits.agendas, limits.plan))
      return
    }
    setAgendaModal({
      name: '', color: AGENDA_COLORS[0],
      working_days: [1, 2, 3, 4, 5],
      start_time: '08:00', end_time: '18:00',
      slot_minutes: 30,
      professional_id: null,
      notify_created: true,
      notify_updated: false,
      notify_cancelled: true,
      notify_confirmed: true,
    })
    setAgendaErr('')
  }

  function openEditAgenda(a) {
    setAgendaModal({ ...a })
    setAgendaErr('')
  }

  async function handleSaveAgenda() {
    if (!agendaModal.name?.trim()) { setAgendaErr('Nome é obrigatório'); return }
    if (!agendaModal.working_days?.length) { setAgendaErr('Selecione ao menos um dia'); return }
    if (timeToMinutes(agendaModal.end_time) <= timeToMinutes(agendaModal.start_time)) {
      setAgendaErr('Horário final deve ser depois do inicial'); return
    }
    setSavingAgenda(true)
    const payload = {
      name: agendaModal.name.trim(),
      color: agendaModal.color,
      working_days: agendaModal.working_days,
      start_time: agendaModal.start_time,
      end_time: agendaModal.end_time,
      slot_minutes: agendaModal.slot_minutes,
      professional_id: agendaModal.professional_id || null,
      notify_created: agendaModal.notify_created !== false,
      notify_updated: agendaModal.notify_updated === true,
      notify_cancelled: agendaModal.notify_cancelled !== false,
      notify_confirmed: agendaModal.notify_confirmed !== false,
      instancia: instance,
    }
    const { data, error } = agendaModal.id
      ? await supabase.from('agendas').update(payload).eq('id', agendaModal.id).select().single()
      : await supabase.from('agendas').insert(payload).select().single()
    setSavingAgenda(false)
    if (error) { setAgendaErr('Erro: ' + error.message); return }
    setAgendas(prev => {
      const exists = prev.find(a => a.id === data.id)
      if (exists) return prev.map(a => a.id === data.id ? data : a)
      return [...prev, data]
    })
    if (!selectedAgendaId) setSelectedAgendaId(data.id)
    setAgendaModal(null)
  }

  function handleDeleteAgenda(agenda) {
    setConfirmDeleteAgenda(agenda)
  }
  async function confirmDeleteAgendaAction() {
    if (!confirmDeleteAgenda) return
    setDeletingNow(true)
    const id = confirmDeleteAgenda.id
    await supabase.from('agendas').delete().eq('id', id)
    setAgendas(prev => prev.filter(a => a.id !== id))
    setAppointments(prev => prev.filter(a => a.agenda_id !== id))
    if (selectedAgendaId === id) setSelectedAgendaId(agendas.find(a => a.id !== id)?.id || null)
    setDeletingNow(false)
    setConfirmDeleteAgenda(null)
  }

  function openNewAppt(date, hhmm, prefill = {}) {
    if (!selectedAgendaId) return
    const ag = agendas.find(a => a.id === selectedAgendaId)
    setApptModal({
      agenda_id: selectedAgendaId,
      contact_nome: prefill.nome || '',
      contact_numero: prefill.numero || '',
      date: fmtDateInput(date),
      time: hhmm,
      duration_minutes: ag?.slot_minutes || 30,
      status: 'agendado',
      notes: '',
      professional_id: ag?.professional_id || null,
      procedure_id: null,
      insurance_plan_id: null,
      price: 0,
      payment_status: 'pendente',
      recurrence: null,
      recurrence_count: 4,
    })
    setApptErr('')
    setPatientHistory([])
  }

  // Pré-preenche pelo query param (vindo do botão "Agendar" no chat)
  useEffect(() => {
    const numero = searchParams.get('numero')
    const nome = searchParams.get('nome')
    if (numero && agendas.length && selectedAgendaId) {
      const now = new Date()
      const slot = now.getHours().toString().padStart(2, '0') + ':00'
      openNewAppt(now, slot, { numero, nome: nome || '' })
      setTab('calendario')
      searchParams.delete('numero'); searchParams.delete('nome')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, agendas, selectedAgendaId])

  // Carrega últimas mensagens do paciente quando o modal abre com número
  useEffect(() => {
    const num = apptModal?.contact_numero?.replace(/\D/g, '')
    if (!num || !instance) { setPatientHistory([]); return }
    setLoadingHistory(true)
    supabase.from('mensagens_geral').select('id, mensagem, type, "horaLastMessage", created_at')
      .eq('instancia', instance)
      .like('numero', `${num}%`)
      .order('id', { ascending: false }).limit(5)
      .then(({ data }) => {
        if (data) setPatientHistory(data.reverse())
        setLoadingHistory(false)
      })
  }, [apptModal?.contact_numero, instance])

  function openEditAppt(a) {
    const d = new Date(a.starts_at)
    setApptModal({
      ...a,
      date: fmtDateInput(d),
      time: fmtTimeInput(d),
      _prevStatus: a.status,
    })
    setApptErr('')
    setPatientHistory([])
  }

  async function handleSaveAppt() {
    if (!apptModal.contact_nome?.trim()) { setApptErr('Nome do paciente é obrigatório'); return }
    if (!apptModal.date || !apptModal.time) { setApptErr('Data e hora são obrigatórios'); return }
    const startsAt = new Date(`${apptModal.date}T${apptModal.time}:00`)
    const duration = parseInt(apptModal.duration_minutes) || 30
    const endsAt = new Date(startsAt.getTime() + duration * 60000)

    // Validação: dia/horário do profissional
    if (apptModal.professional_id) {
      const pro = professionals.find(p => p.id === apptModal.professional_id)
      if (pro) {
        const dayOfWeek = startsAt.getDay()
        const workingDays = pro.working_days || [1, 2, 3, 4, 5]
        if (!workingDays.includes(dayOfWeek)) {
          const dayLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayOfWeek]
          setApptErr(`${pro.name} não atende ${dayLabel.toLowerCase()}. Dias disponíveis: ${workingDays.map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join(', ')}`)
          return
        }
        const apptStart = startsAt.getHours() * 60 + startsAt.getMinutes()
        const apptEnd = apptStart + duration
        const proStart = parseInt(pro.start_time?.split(':')[0] || 8) * 60 + parseInt(pro.start_time?.split(':')[1] || 0)
        const proEnd = parseInt(pro.end_time?.split(':')[0] || 18) * 60 + parseInt(pro.end_time?.split(':')[1] || 0)
        if (apptStart < proStart || apptEnd > proEnd) {
          setApptErr(`${pro.name} atende das ${pro.start_time?.slice(0,5)} às ${pro.end_time?.slice(0,5)}. Horário fora do expediente.`)
          return
        }
        // Validação: intervalo (pausa/almoço)
        if (pro.break_start && pro.break_end) {
          const breakStart = parseInt(pro.break_start.split(':')[0]) * 60 + parseInt(pro.break_start.split(':')[1] || 0)
          const breakEnd = parseInt(pro.break_end.split(':')[0]) * 60 + parseInt(pro.break_end.split(':')[1] || 0)
          if (apptStart < breakEnd && breakStart < apptEnd) {
            setApptErr(`${pro.name} está em intervalo das ${pro.break_start.slice(0,5)} às ${pro.break_end.slice(0,5)}. Escolha outro horário.`)
            return
          }
        }
      }

      // Validação: conflito com outro agendamento do mesmo profissional
      const conflict = appointments.find(a => {
        if (a.id === apptModal.id) return false
        if (a.professional_id !== apptModal.professional_id) return false
        if (a.status === 'cancelado') return false
        const aStart = new Date(a.starts_at).getTime()
        const aEnd = aStart + (a.duration_minutes || 30) * 60000
        return startsAt.getTime() < aEnd && aStart < endsAt.getTime()
      })
      if (conflict) {
        const cStart = new Date(conflict.starts_at)
        const cTime = cStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        setApptErr(`Conflito de horário: ${conflict.contact_nome} já está marcado às ${cTime} com este profissional.`)
        return
      }
    }

    setSavingAppt(true)
    const rawNum = apptModal.contact_numero?.replace(/\D/g, '') || ''
    // Normaliza para 55DDDnúmero sem o 9 extra (13 dígitos → 12)
    let numero = rawNum
    if (numero) {
      if (!numero.startsWith('55')) numero = '55' + numero
      if (numero.length === 13) numero = numero.slice(0, 4) + numero.slice(5)
    }
    numero = numero || null
    const payload = {
      agenda_id: apptModal.agenda_id,
      instancia: instance,
      contact_nome: apptModal.contact_nome.trim(),
      contact_numero: numero,
      starts_at: startsAt.toISOString(),
      duration_minutes: parseInt(apptModal.duration_minutes) || 30,
      status: apptModal.status,
      notes: apptModal.notes?.trim() || null,
      created_by_email: session?.user?.email,
    }
    // Auto-marcar como pago se status virou 'concluido'
    let paymentStatus = apptModal.payment_status || 'pendente'
    let paidAt = apptModal.paid_at || null
    if (apptModal.status === 'concluido' && paymentStatus !== 'pago') {
      paymentStatus = 'pago'
      paidAt = new Date().toISOString()
    }

    payload.professional_id = apptModal.professional_id || null
    payload.procedure_id = apptModal.procedure_id || null
    payload.insurance_plan_id = apptModal.insurance_plan_id || null
    payload.price = parseFloat(apptModal.price) || 0
    payload.payment_status = paymentStatus
    payload.paid_at = paidAt

    const isNew = !apptModal.id
    const prevStatus = apptModal._prevStatus
    let supaError
    if (isNew && apptModal.recurrence) {
      const count = Math.min(parseInt(apptModal.recurrence_count) || 1, 52)
      const rows = buildRecurringRows(payload, startsAt, apptModal.recurrence, count)
      const { error } = await supabase.from('appointments').insert(rows)
      supaError = error
    } else {
      const { error } = isNew
        ? await supabase.from('appointments').insert(payload)
        : await supabase.from('appointments').update(payload).eq('id', apptModal.id)
      supaError = error
    }
    setSavingAppt(false)
    if (supaError) { setApptErr('Erro: ' + supaError.message); return }

    // Registra evento na conversa do paciente (se tem número)
    if (numero) {
      const sessionId = `${numero}@s.whatsapp.net`
      const dateStr = startsAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      const ag = agendas.find(a => a.id === payload.agenda_id)
      let msg = null
      if (isNew) {
        msg = `📅 Agendamento criado para ${dateStr}${ag ? ` — ${ag.name}` : ''}`
      } else if (prevStatus && prevStatus !== payload.status) {
        const labels = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' }
        msg = `📅 Agendamento de ${dateStr} alterado para: ${labels[payload.status] || payload.status}`
      } else {
        msg = `✏️ Agendamento atualizado para ${dateStr}`
      }
      if (msg) {
        await supabase.rpc('send_mensagem_geral', {
          p_instancia: instance,
          p_numero: sessionId,
          p_mensagem: msg,
          p_type: 'atendente',
          p_hora: new Date().toISOString(),
          p_base64: null,
        })
      }

      // Cancelamento: envia mensagem WhatsApp via webhook avisando o paciente
      if (!isNew && prevStatus !== 'cancelado' && payload.status === 'cancelado') {
        const aviso = `Olá ${payload.contact_nome.split(' ')[0]}, infelizmente seu agendamento de ${dateStr} foi cancelado. Em caso de dúvidas, entre em contato.`
        await supabase.rpc('send_mensagem_geral', {
          p_instancia: instance,
          p_numero: sessionId,
          p_mensagem: aviso,
          p_type: 'atendente',
          p_hora: new Date().toISOString(),
          p_base64: null,
        })
        if (ag?.notify_cancelled !== false && session?.company?.notify_agenda_cancelled !== false) {
          fetch('https://n8n.nexladesenvolvimento.com.br/webhook/envioNexla', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: aviso,
              session_id: sessionId,
              phone: numero,
              instancia: instance,
              api_instancia: apiInstancia,
              company: session?.company?.name,
              sender_name: session?.user?.name,
              sender_email: session?.user?.email,
            }),
          }).catch(e => console.warn('webhook cancelamento:', e))
        }
      }

      // Criação: confirma agendamento via WhatsApp
      if (isNew && ag?.notify_created !== false && session?.company?.notify_agenda_created !== false) {
        const criacaoMsg = `Olá ${payload.contact_nome.split(' ')[0]}, seu agendamento foi criado para ${dateStr}${ag ? ` — ${ag.name}` : ''}. Estamos aguardando você!`
        fetch('https://n8n.nexladesenvolvimento.com.br/webhook/envioNexla', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: criacaoMsg,
            session_id: sessionId,
            phone: numero,
            instancia: instance,
            api_instancia: apiInstancia,
            company: session?.company?.name,
          }),
        }).catch(e => console.warn('webhook criação:', e))
      }

      // Confirmação: avisa paciente via WhatsApp ao mudar status para confirmado
      if (!isNew && prevStatus !== 'confirmado' && payload.status === 'confirmado' && ag?.notify_confirmed !== false && session?.company?.notify_agenda_confirmed !== false) {
        const confirmMsg = `Olá ${payload.contact_nome.split(' ')[0]}, seu agendamento de ${dateStr} está confirmado! Estamos aguardando você.`
        fetch('https://n8n.nexladesenvolvimento.com.br/webhook/envioNexla', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: confirmMsg,
            session_id: sessionId,
            phone: numero,
            instancia: instance,
            api_instancia: apiInstancia,
            company: session?.company?.name,
          }),
        }).catch(e => console.warn('webhook confirmação:', e))
      }
    }
    setApptModal(null)
  }

  function handleDeleteAppt() {
    if (!apptModal?.id) return
    setConfirmDeleteAppt(true)
  }
  async function confirmDeleteApptAction() {
    if (!apptModal?.id) return
    setDeletingNow(true)
    await supabase.from('appointments').delete().eq('id', apptModal.id)
    setDeletingNow(false)
    setConfirmDeleteAppt(false)
    setApptModal(null)
  }

  const selectedAgenda = agendas.find(a => a.id === selectedAgendaId)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Slots de horário com base na agenda selecionada
  const slots = useMemo(() => {
    if (!selectedAgenda) return []
    const start = timeToMinutes(selectedAgenda.start_time)
    const end = timeToMinutes(selectedAgenda.end_time)
    const step = selectedAgenda.slot_minutes
    const arr = []
    for (let m = start; m < end; m += step) arr.push(minutesToTime(m))
    return arr
  }, [selectedAgenda])

  function apptsAt(day, hhmm) {
    if (!selectedAgenda) return []
    const slotMs = new Date(`${fmtDateInput(day)}T${hhmm}:00`).getTime()
    return appointments.filter(a => {
      if (a.agenda_id !== selectedAgenda.id) return false
      return new Date(a.starts_at).getTime() === slotMs
    })
  }

  function isWorkingDay(day) {
    if (!selectedAgenda) return false
    return (selectedAgenda.working_days || []).includes(day.getDay())
  }

  // Gera múltiplas linhas para agendamento recorrente
  function buildRecurringRows(base, startsAt, recurrence, count) {
    const rows = []
    for (let i = 0; i < count; i++) {
      let d = new Date(startsAt)
      if (recurrence === 'semanal')    d = new Date(startsAt.getTime() + i * 7 * 86400000)
      else if (recurrence === 'quinzenal') d = new Date(startsAt.getTime() + i * 14 * 86400000)
      else if (recurrence === 'mensal') { d = new Date(startsAt); d.setMonth(d.getMonth() + i) }
      rows.push({ ...base, starts_at: d.toISOString() })
    }
    return rows
  }

  // Drag & drop: move agendamento para outro slot (otimista + rollback)
  async function handleDrop(e, day, hhmm) {
    e.preventDefault()
    setDragOverSlot(null)
    const id = draggingId
    setDraggingId(null)
    if (!id) return
    const appt = appointments.find(a => a.id === id)
    if (!appt) return
    const newStartsAt = new Date(`${fmtDateInput(day)}T${hhmm}:00`)
    if (new Date(appt.starts_at).getTime() === newStartsAt.getTime()) return
    const prev = appointments
    setAppointments(p => p.map(a => a.id === id ? { ...a, starts_at: newStartsAt.toISOString() } : a))
    const { error } = await supabase.from('appointments')
      .update({ starts_at: newStartsAt.toISOString() }).eq('id', id)
    if (error) setAppointments(prev)
  }

  async function toggleAgendaNotification(key) {
    if (!selectedAgenda) return
    const newVal = selectedAgenda[key] === false ? true : !selectedAgenda[key]
    setAgendas(prev => prev.map(a => a.id === selectedAgenda.id ? { ...a, [key]: newVal } : a))
    await supabase.from('agendas').update({ [key]: newVal }).eq('id', selectedAgenda.id)
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)' }}>Agenda</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? 'Carregando...' : `${agendas.length} agenda(s) — ${appointments.length} agendamento(s) nesta semana`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setTab('calendario')}
            className={tab === 'calendario' ? 'nx-btn-primary' : 'nx-btn-ghost'}
            style={{ fontSize: 12, padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={13} /> Calendário
          </button>
          <button onClick={() => setTab('agendas')}
            className={tab === 'agendas' ? 'nx-btn-primary' : 'nx-btn-ghost'}
            style={{ fontSize: 12, padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Settings size={13} /> Agendas
          </button>
        </div>
      </div>

      {tab === 'agendas' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {agendas.length} de {formatLimit(limits.agendas)} agendas
              {reachedLimit(agendas.length, limits.agendas) && <span style={{ marginLeft: 8, color: '#C9A074', fontWeight: 700 }}>· limite atingido</span>}
            </div>
            <button
              className="nx-btn-primary"
              onClick={openNewAgenda}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                opacity: reachedLimit(agendas.length, limits.agendas) ? 0.7 : 1,
              }}>
              {reachedLimit(agendas.length, limits.agendas) ? <Lock size={13} /> : <Plus size={14} />} Nova agenda
            </button>
          </div>
          {agendas.length === 0 ? (
            <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Calendar size={28} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 14 }}>Nenhuma agenda criada. Crie a primeira para começar a agendar.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {agendas.map(a => (
                <div key={a.id} className="nx-card"
                  style={{ padding: '1.1rem 1.25rem', cursor: 'pointer', transition: 'all 0.15s' }}
                  onClick={() => { setSelectedAgendaId(a.id); setTab('calendario') }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.boxShadow = `0 4px 12px ${a.color}22` }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: a.color }} />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button className="table-action" onClick={() => openEditAgenda(a)}>
                        <Pencil size={11} /> Editar
                      </button>
                      <button className="table-action danger" onClick={() => handleDeleteAgenda(a)}>
                        <Trash2 size={11} /> Excluir
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} /> {a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)} (slots de {a.slot_minutes} min)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {DAYS_OF_WEEK.map(d => (
                        <span key={d.num} style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                          background: (a.working_days || []).includes(d.num) ? a.color + '22' : '#F1F5F9',
                          color: (a.working_days || []).includes(d.num) ? a.color : '#94A3B8',
                          border: `1px solid ${(a.working_days || []).includes(d.num) ? a.color + '44' : 'var(--border)'}`,
                        }}>
                          {d.label}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedAgendaId(a.id); setTab('calendario') }}
                      style={{
                        marginTop: 4,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: a.color, color: '#fff', border: 'none',
                        borderRadius: 6, padding: '7px 12px',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}>
                      <Calendar size={12} /> Abrir agenda
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'calendario' && (
        <>
          {!agendas.length ? (
            <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Calendar size={28} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 14 }}>Crie ao menos uma agenda na aba "Agendas" para começar.</div>
              <button className="nx-btn-primary" onClick={() => setTab('agendas')} style={{ marginTop: 8 }}>Ir para Agendas</button>
            </div>
          ) : (
            <>
            {/* Card de notificações WhatsApp */}
            {selectedAgenda && (
              <div style={{
                marginBottom: 12,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 1,
                    background: selectedAgenda.color + '18',
                    border: `1px solid ${selectedAgenda.color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bell size={15} style={{ color: selectedAgenda.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      Notificações WhatsApp — {selectedAgenda.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                      Escolha em quais momentos o paciente recebe um aviso automático via WhatsApp sobre o agendamento.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                      {[
                        { key: 'notify_created',   label: 'Criação do agendamento',   desc: 'Avisa ao criar' },
                        { key: 'notify_confirmed', label: 'Confirmação',               desc: 'Avisa ao confirmar' },
                        { key: 'notify_cancelled', label: 'Cancelamento',              desc: 'Avisa ao cancelar' },
                        { key: 'notify_updated',   label: 'Atualização de status',     desc: 'Avisa em qualquer mudança' },
                      ].map(({ key, label, desc }) => {
                        const active = selectedAgenda[key] !== false && selectedAgenda[key] !== undefined
                          ? selectedAgenda[key] !== false
                          : key !== 'notify_updated'
                        return (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleAgendaNotification(key)}
                              style={{ width: 15, height: 15, accentColor: selectedAgenda.color, cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{desc}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="nx-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Toolbar */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select className="nx-select" style={{ fontSize: 13 }}
                  value={selectedAgendaId || ''} onChange={e => setSelectedAgendaId(e.target.value)}>
                  {agendas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <button className="nx-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setWeekStart(addDays(weekStart, -7))}>
                    <ChevronLeft size={14} />
                  </button>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 140, textAlign: 'center' }}>
                    {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}
                  </div>
                  <button className="nx-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setWeekStart(addDays(weekStart, 7))}>
                    <ChevronRight size={14} />
                  </button>
                  <button className="nx-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setWeekStart(getMonday(new Date()))}>
                    Hoje
                  </button>
                </div>
                <button
                  className="nx-btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px' }}
                  onClick={() => {
                    const now = new Date()
                    const slotMin = selectedAgenda?.slot_minutes || 30
                    const roundedMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / slotMin) * slotMin
                    const hh = String(Math.floor(roundedMin / 60) % 24).padStart(2, '0')
                    const mm = String(roundedMin % 60).padStart(2, '0')
                    openNewAppt(now, `${hh}:${mm}`)
                  }}
                >
                  <Plus size={13} /> Novo agendamento
                </button>
              </div>

              {/* Grid */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 880 }}>
                  {/* Header dias */}
                  <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                    <div />
                    {weekDays.map((d, i) => {
                      const isToday = d.toDateString() === new Date().toDateString()
                      return (
                        <div key={i} style={{
                          padding: '8px 6px', textAlign: 'center', borderLeft: '1px solid var(--border)',
                          fontSize: 12, fontWeight: 600,
                          color: isToday ? '#2563EB' : 'var(--text-secondary)',
                          background: isToday ? '#EFF6FF' : 'transparent',
                        }}>
                          <div>{DAYS_OF_WEEK[d.getDay()].label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}</div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Slots */}
                  {slots.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      Configure horários nesta agenda.
                    </div>
                  ) : slots.map((hhmm, idx) => (
                    <div key={hhmm} style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', borderBottom: idx === slots.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                      <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                        {hhmm}
                      </div>
                      {weekDays.map((d, i) => {
                        const working = isWorkingDay(d)
                        const appts = working ? apptsAt(d, hhmm) : []
                        const dateStr = fmtDateInput(d)
                        const isDragOver = dragOverSlot?.dateStr === dateStr && dragOverSlot?.hhmm === hhmm
                        const cellBg = !working ? '#F9FAFB' : isDragOver ? '#DBEAFE' : 'transparent'
                        return (
                          <div key={i}
                            onClick={() => working && !draggingId && openNewAppt(d, hhmm)}
                            onDragOver={e => {
                              if (!draggingId || !working) return
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                              setDragOverSlot({ dateStr, hhmm })
                            }}
                            onDragLeave={() => setDragOverSlot(null)}
                            onDrop={e => working && handleDrop(e, d, hhmm)}
                            style={{
                              height: 46, borderLeft: '1px solid var(--border)',
                              background: cellBg,
                              cursor: working ? 'pointer' : 'not-allowed',
                              padding: 3, position: 'relative',
                              display: 'flex', flexDirection: 'column', gap: 2,
                              overflow: 'visible',
                              outline: isDragOver ? '2px dashed #2563EB' : 'none',
                              outlineOffset: -2,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { if (working && appts.length === 0 && !draggingId) e.currentTarget.style.background = '#EFF6FF' }}
                            onMouseLeave={e => { if (working && appts.length === 0 && !draggingId) e.currentTarget.style.background = 'transparent' }}
                          >
                            {appts.map(appt => {
                              const status = STATUS_OPTIONS.find(s => s.value === appt.status)
                              if (!status) return null
                              const isSource = draggingId && appt.id === draggingId
                              const isEncaixe = appts.length > 1
                              const slotMin = selectedAgenda?.slot_minutes || 30
                              const spanSlots = isEncaixe ? 1 : Math.max(1, Math.round((appt.duration_minutes || slotMin) / slotMin))
                              const isSpanning = spanSlots > 1
                              return (
                                <div key={appt.id}
                                  draggable
                                  onDragStart={e => { setDraggingId(appt.id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation() }}
                                  onDragEnd={() => { setDraggingId(null); setDragOverSlot(null) }}
                                  onMouseEnter={e => setTooltip({ appt, x: e.clientX, y: e.clientY })}
                                  onMouseMove={e => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                  onMouseLeave={() => setTooltip(null)}
                                  onClick={e => { e.stopPropagation(); if (!draggingId) openEditAppt(appt) }}
                                  style={{
                                    ...(isSpanning ? {
                                      position: 'absolute', top: 2, left: 2, right: 2,
                                      height: spanSlots * 46 - 4, zIndex: 2,
                                    } : {}),
                                    background: status.color,
                                    color: '#fff',
                                    borderLeft: `3px solid ${status.color}`,
                                    borderRadius: 5,
                                    padding: '4px 7px',
                                    fontSize: 10, fontWeight: 700, lineHeight: 1.3,
                                    display: 'flex', flexDirection: 'column',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    opacity: isSource ? 0.45 : 1,
                                    cursor: 'grab',
                                    transition: 'opacity 0.15s',
                                  }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {appt.contact_nome}
                                  </div>
                                  <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.85, marginTop: 1 }}>
                                    {status.label}{isEncaixe ? ' · Encaixe' : ''}
                                  </div>
                                  {appt.created_by_email && (
                                    <div style={{ fontSize: 8, opacity: 0.7, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      por {getUserName(appt.created_by_email)}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </>
          )}
        </>
      )}

      {/* Modal agenda */}
      {agendaModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{agendaModal.id ? 'Editar agenda' : 'Nova agenda'}</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setAgendaModal(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input className="nx-input" autoFocus placeholder="Ex: Dr. João — Cardiologia"
                  value={agendaModal.name} onChange={e => setAgendaModal(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Cor</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {AGENDA_COLORS.map(c => (
                    <button key={c} onClick={() => setAgendaModal(p => ({ ...p, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: agendaModal.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Dias de funcionamento</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAYS_OF_WEEK.map(d => {
                    const active = (agendaModal.working_days || []).includes(d.num)
                    return (
                      <button key={d.num}
                        onClick={() => setAgendaModal(p => ({
                          ...p,
                          working_days: active
                            ? p.working_days.filter(n => n !== d.num)
                            : [...(p.working_days || []), d.num].sort()
                        }))}
                        style={{
                          padding: '6px 12px', borderRadius: 20,
                          border: `1.5px solid ${active ? agendaModal.color : 'var(--border)'}`,
                          background: active ? agendaModal.color : 'transparent',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Início</label>
                  <input className="nx-input" type="time" value={agendaModal.start_time?.slice(0, 5) || '08:00'}
                    onChange={e => setAgendaModal(p => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Fim</label>
                  <input className="nx-input" type="time" value={agendaModal.end_time?.slice(0, 5) || '18:00'}
                    onChange={e => setAgendaModal(p => ({ ...p, end_time: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Slot</label>
                  <select className="nx-select" value={agendaModal.slot_minutes}
                    onChange={e => setAgendaModal(p => ({ ...p, slot_minutes: parseInt(e.target.value) }))}>
                    {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
              </div>
              {professionals.length > 0 && (
                <div>
                  <label style={labelStyle}>Profissional vinculado (opcional)</label>
                  <select className="nx-select" value={agendaModal.professional_id || ''}
                    onChange={e => setAgendaModal(p => ({ ...p, professional_id: e.target.value || null }))}>
                    <option value="">Sem profissional vinculado</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` — ${p.specialty}` : ''}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Quando vinculado, os procedimentos do profissional + da clínica ficam disponíveis no agendamento.
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Notificações WhatsApp ao paciente</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'notify_created',   label: 'Aviso de criação do agendamento' },
                    { key: 'notify_confirmed', label: 'Aviso de confirmação' },
                    { key: 'notify_cancelled', label: 'Aviso de cancelamento' },
                    { key: 'notify_updated',   label: 'Aviso de atualização de status' },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                      <input type="checkbox"
                        checked={agendaModal[key] !== false && agendaModal[key] !== undefined ? agendaModal[key] : false}
                        onChange={e => setAgendaModal(p => ({ ...p, [key]: e.target.checked }))}
                        style={{ width: 15, height: 15, accentColor: agendaModal.color, cursor: 'pointer' }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Mensagens enviadas via WhatsApp quando marcadas como ativas.
                </div>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {agendaErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{agendaErr}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setAgendaModal(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveAgenda} disabled={savingAgenda}>
                  {savingAgenda ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      <ConfirmModal
        open={!!confirmDeleteAgenda}
        variant="delete"
        title="Excluir agenda"
        message={`Tem certeza que deseja excluir a agenda "${confirmDeleteAgenda?.name || ''}"? Todos os agendamentos vinculados serão removidos. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir agenda"
        loading={deletingNow}
        onConfirm={confirmDeleteAgendaAction}
        onCancel={() => setConfirmDeleteAgenda(null)}
      />

      <ConfirmModal
        open={confirmDeleteAppt}
        variant="delete"
        title="Excluir agendamento"
        message="Tem certeza que deseja excluir este agendamento? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deletingNow}
        onConfirm={confirmDeleteApptAction}
        onCancel={() => setConfirmDeleteAppt(false)}
      />

      <LimitReachedModal
        open={!!limitModal}
        title={limitModal?.title}
        body={limitModal?.body}
        cta={limitModal?.cta}
        planName={limits.plan}
        onClose={() => setLimitModal(null)}
      />

      {/* Modal agendamento */}
      {apptModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{apptModal.id ? 'Editar agendamento' : 'Novo agendamento'}</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setApptModal(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Agenda</label>
                <select className="nx-select" value={apptModal.agenda_id}
                  onChange={e => setApptModal(p => ({ ...p, agenda_id: e.target.value }))}>
                  {agendas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nome do paciente</label>
                <input className="nx-input" autoFocus list="agenda-contact-list" placeholder="Digite ou escolha um contato salvo"
                  value={apptModal.contact_nome}
                  onChange={e => {
                    const value = e.target.value
                    const match = allContacts.find(c => c.nome === value)
                    setApptModal(p => ({ ...p, contact_nome: value, contact_numero: match?.numero || p.contact_numero }))
                  }} />
                <datalist id="agenda-contact-list">
                  {allContacts.map((c, i) => <option key={c.id || i} value={c.nome}>{c.numero}</option>)}
                </datalist>
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input className="nx-input" placeholder="Ex: 5561991234567"
                  value={apptModal.contact_numero || ''}
                  onChange={e => setApptModal(p => ({ ...p, contact_numero: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Data</label>
                  <input className="nx-input" type="date" value={apptModal.date}
                    onChange={e => setApptModal(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Hora</label>
                  <input className="nx-input" type="time" value={apptModal.time}
                    onChange={e => setApptModal(p => ({ ...p, time: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Duração</label>
                  <input className="nx-input" type="number" min={5} step={5} value={apptModal.duration_minutes}
                    onChange={e => setApptModal(p => ({ ...p, duration_minutes: e.target.value }))} />
                </div>
              </div>

              {professionals.length > 0 && (
                <div>
                  <label style={labelStyle}>Profissional</label>
                  <select className="nx-select" value={apptModal.professional_id || ''}
                    onChange={e => setApptModal(p => ({ ...p, professional_id: e.target.value || null, procedure_id: null }))}>
                    <option value="">— Selecione —</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` — ${p.specialty}` : ''}</option>)}
                  </select>
                </div>
              )}

              {procedures.length > 0 && (
                <div>
                  <label style={labelStyle}>Procedimento / Consulta / Exame</label>
                  <select className="nx-select" value={apptModal.procedure_id || ''}
                    onChange={e => {
                      const procId = e.target.value || null
                      const proc = procedures.find(x => x.id === procId)
                      // Auto-preenche valor (do convênio se houver, senão particular) e duração
                      let newPrice = apptModal.price
                      let newDuration = apptModal.duration_minutes
                      if (proc) {
                        newDuration = proc.duration_minutes || newDuration
                        const planId = apptModal.insurance_plan_id
                        const priceRow = planId ? procedurePrices.find(pr => pr.procedure_id === procId && pr.insurance_plan_id === planId) : null
                        newPrice = priceRow?.price ?? proc.price_particular ?? 0
                      }
                      setApptModal(p => ({ ...p, procedure_id: procId, price: newPrice, duration_minutes: newDuration }))
                    }}>
                    <option value="">— Selecione —</option>
                    {procedures
                      .filter(pr => !apptModal.professional_id || !pr.professional_id || pr.professional_id === apptModal.professional_id)
                      .map(pr => <option key={pr.id} value={pr.id}>{pr.name} ({pr.duration_minutes} min)</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Forma</label>
                  <select className="nx-select" value={apptModal.insurance_plan_id || ''}
                    onChange={e => {
                      const planId = e.target.value || null
                      const procId = apptModal.procedure_id
                      let newPrice = apptModal.price
                      if (procId) {
                        const proc = procedures.find(x => x.id === procId)
                        const priceRow = planId ? procedurePrices.find(pr => pr.procedure_id === procId && pr.insurance_plan_id === planId) : null
                        newPrice = priceRow?.price ?? proc?.price_particular ?? 0
                      }
                      setApptModal(p => ({ ...p, insurance_plan_id: planId, price: newPrice }))
                    }}>
                    <option value="">Particular</option>
                    {insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Valor (R$)</label>
                  <input className="nx-input" type="number" step="0.01" min={0}
                    value={apptModal.price ?? 0}
                    onChange={e => setApptModal(p => ({ ...p, price: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Pagamento</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { value: 'pendente', label: 'Pendente', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                    { value: 'pago',     label: 'Pago',     color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
                    { value: 'cancelado', label: 'Cancelado', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                  ].map(s => {
                    const active = apptModal.payment_status === s.value
                    return (
                      <button key={s.value}
                        onClick={() => setApptModal(p => ({ ...p, payment_status: s.value, paid_at: s.value === 'pago' ? new Date().toISOString() : null }))}
                        style={{
                          flex: 1, padding: '7px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          border: `1.5px solid ${active ? s.color : 'var(--border)'}`,
                          background: active ? s.bg : 'transparent',
                          color: active ? s.color : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}>
                        {s.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Marcar status do agendamento como "Concluído" também marca o pagamento como Pago automaticamente.
                </div>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.map(s => {
                    const active = apptModal.status === s.value
                    return (
                      <button key={s.value}
                        onClick={() => setApptModal(p => ({ ...p, status: s.value }))}
                        style={{
                          padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          border: `1.5px solid ${active ? s.color : 'var(--border)'}`,
                          background: active ? s.bg : 'transparent',
                          color: active ? s.color : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                        <s.icon size={11} /> {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {!apptModal.id && (
                <div>
                  <label style={labelStyle}>Recorrência</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { value: null,         label: 'Única' },
                      { value: 'semanal',    label: 'Semanal' },
                      { value: 'quinzenal',  label: 'Quinzenal' },
                      { value: 'mensal',     label: 'Mensal' },
                    ].map(opt => {
                      const active = apptModal.recurrence === opt.value
                      return (
                        <button key={String(opt.value)}
                          onClick={() => setApptModal(p => ({ ...p, recurrence: opt.value }))}
                          style={{
                            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            border: `1.5px solid ${active ? '#2563EB' : 'var(--border)'}`,
                            background: active ? '#EFF6FF' : 'transparent',
                            color: active ? '#2563EB' : 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {apptModal.recurrence && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Ocorrências</label>
                      <input className="nx-input" type="number" min={2} max={52}
                        style={{ width: 72 }}
                        value={apptModal.recurrence_count}
                        onChange={e => setApptModal(p => ({
                          ...p,
                          recurrence_count: Math.min(52, Math.max(2, parseInt(e.target.value) || 2)),
                        }))} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        sessões (máx 52)
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label style={labelStyle}>Observações (opcional)</label>
                <textarea className="nx-input" rows={2} placeholder="Anotações sobre este agendamento..."
                  value={apptModal.notes || ''}
                  onChange={e => setApptModal(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {apptModal.id && apptModal.created_by_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <UserIcon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Agendado por <strong style={{ color: 'var(--text-secondary)' }}>
                      {(session?.company?.users || []).find(u => u.email === apptModal.created_by_email)?.name || apptModal.created_by_email}
                    </strong>
                  </span>
                </div>
              )}

              {apptModal.contact_numero && (
                <div style={{
                  background: '#F8FAFC', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <History size={11} /> Últimas mensagens
                    </div>
                    <button onClick={() => navigate(`/painel/conversas?contact=${apptModal.contact_numero.replace(/\D/g, '')}`)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: '#16A34A', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>
                      <MessageSquare size={11} /> Abrir conversa
                    </button>
                  </div>
                  {loadingHistory ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>Carregando histórico...</div>
                  ) : patientHistory.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>Sem mensagens anteriores deste número.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {patientHistory.map(m => {
                        const t = (m.type || '').toLowerCase()
                        const isAt = t === 'atendente'
                        const isCli = t === 'cliente'
                        const txt = (m.mensagem || '').replace(/^\*[^*]+\*:\n/, '').trim().slice(0, 90)
                        return (
                          <div key={m.id} style={{
                            fontSize: 11, lineHeight: 1.4,
                            color: 'var(--text-secondary)',
                            paddingLeft: 6, borderLeft: `2px solid ${isAt ? '#16A34A' : isCli ? '#94A3B8' : '#2563EB'}`,
                          }}>
                            <strong style={{ color: isAt ? '#16A34A' : isCli ? '#475569' : '#2563EB' }}>
                              {isAt ? 'Atendente' : isCli ? 'Cliente' : 'IA'}:
                            </strong> {txt}{txt.length >= 90 ? '...' : ''}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {apptErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{apptErr}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                {apptModal.id && (
                  <button onClick={handleDeleteAppt}
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Trash2 size={13} /> Excluir
                  </button>
                )}
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setApptModal(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveAppt} disabled={savingAppt}>
                  {savingAppt
                    ? 'Salvando...'
                    : (!apptModal.id && apptModal.recurrence)
                      ? `Criar ${Math.min(apptModal.recurrence_count, 52)} agendamentos`
                      : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

    {tooltip && (() => {
      const a = tooltip.appt
      const st = STATUS_OPTIONS.find(s => s.value === a.status)
      const startDt = new Date(a.starts_at)
      const endDt = new Date(startDt.getTime() + (a.duration_minutes || 30) * 60000)
      const fmtTime = dt => dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      const pro = professionals.find(p => p.id === a.professional_id)
      const proc = procedures.find(p => p.id === a.procedure_id)
      const vx = Math.min(tooltip.x + 14, window.innerWidth - 260)
      const vy = Math.min(tooltip.y - 10, window.innerHeight - 220)
      return createPortal(
        <div style={{
          position: 'fixed', zIndex: 9999, pointerEvents: 'none',
          left: vx, top: vy,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
          border: '1px solid #E2E8F0',
          padding: '12px 16px', minWidth: 220, maxWidth: 280, fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 8, lineHeight: 1.3 }}>
            {a.contact_nome}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, color: '#475569' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} style={{ flexShrink: 0 }} />
              {fmtTime(startDt)} – {fmtTime(endDt)} · {a.duration_minutes} min
            </div>
            {st && (
              <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                {st.label}
              </span>
            )}
            {pro && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <UserIcon size={12} style={{ flexShrink: 0 }} />
                {pro.name}{pro.specialty ? ` — ${pro.specialty}` : ''}
              </div>
            )}
            {proc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ListChecks size={12} style={{ flexShrink: 0 }} />
                {proc.name}
              </div>
            )}
            {a.notes && (
              <div style={{ color: '#94A3B8', fontStyle: 'italic', borderTop: '1px solid #F1F5F9', paddingTop: 5, marginTop: 2 }}>
                {a.notes}
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    })()}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
