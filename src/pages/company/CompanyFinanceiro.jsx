import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Plus, X, Pencil, Trash2, ChevronLeft, ChevronRight,
  Wallet, CheckCircle2, Clock, XCircle, Search, Tag,
  Download, AlertCircle, TrendingDown, Lock,
} from 'lucide-react'
import './Company.css'

const TIPO_COLORS = {
  receita: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Receita' },
  despesa: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Despesa' },
}
const STATUS_OPTIONS = [
  { value: 'pendente',  label: 'Pendente',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'pago',      label: 'Pago',      color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { value: 'cancelado', label: 'Cancelado', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
]
const FORMA_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Cheque', 'Outro']

function fmtMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function monthRange(offset = 0) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last  = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return {
    start: first.toISOString().slice(0, 10),
    end:   last.toISOString().slice(0, 10),
    label: first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  }
}

const LS = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

// ── Bar chart (6 months) ──────────────────────────────────────────────────
function MonthlyChart({ data }) {
  const [hover, setHover] = useState(null)
  if (!data.length) return (
    <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
      Carregando dados...
    </div>
  )
  const maxVal = Math.max(...data.flatMap(d => [d.receita, d.despesa]), 1)
  const H = 110
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: H + 30, padding: '0 4px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flex: 1 }}
              onMouseEnter={() => setHover({ ...d, i })}
              onMouseLeave={() => setHover(null)}>
              <div style={{ flex: 1, background: '#16A34A', borderRadius: '3px 3px 0 0', height: Math.max((d.receita / maxVal) * H, d.receita > 0 ? 2 : 0), opacity: hover?.i === i ? 1 : 0.8, transition: 'opacity 0.1s', cursor: 'default' }} />
              <div style={{ flex: 1, background: '#DC2626', borderRadius: '3px 3px 0 0', height: Math.max((d.despesa / maxVal) * H, d.despesa > 0 ? 2 : 0), opacity: hover?.i === i ? 1 : 0.8, transition: 'opacity 0.1s', cursor: 'default' }} />
            </div>
            <div style={{ borderTop: '1px solid var(--border)', width: '100%' }} />
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 3, textTransform: 'capitalize' }}>{d.label}</div>
          </div>
        ))}
      </div>
      {hover && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11, zIndex: 10, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 175 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)', fontSize: 12, textTransform: 'capitalize' }}>{hover.fullLabel}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', marginBottom: 2 }}><span>Receitas</span><span style={{ fontWeight: 700 }}>{fmtMoney(hover.receita)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', marginBottom: 4 }}><span>Despesas</span><span style={{ fontWeight: 700 }}>{fmtMoney(hover.despesa)}</span></div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: hover.receita - hover.despesa >= 0 ? '#16A34A' : '#DC2626' }}>
            <span>Saldo</span><span>{fmtMoney(hover.receita - hover.despesa)}</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#16A34A', marginRight: 4 }} />Receitas</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#DC2626', marginRight: 4 }} />Despesas</span>
      </div>
    </div>
  )
}

// ── Pending table shared between A Receber / A Pagar ──────────────────────
function PendingTable({ items, catMap, onEdit, onDelete, onToggle, deleting }) {
  if (!items.length) return (
    <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      <CheckCircle2 size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
      <div>Nenhum lançamento neste filtro.</div>
    </div>
  )
  const today = todayStr()
  return (
    <div className="nx-card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
              {['Vencimento', 'Descrição', 'Categoria', 'Paciente', 'Profissional', 'Valor', 'Ação', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(tx => {
              const st = STATUS_OPTIONS.find(s => s.value === tx.status)
              const tp = TIPO_COLORS[tx.tipo]
              const cat = catMap[tx.categoria_id]
              const isOverdue = tx.vencimento && tx.vencimento < today
              return (
                <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ color: isOverdue ? '#DC2626' : 'var(--text-secondary)' }}>{fmtDate(tx.vencimento)}</div>
                    {isOverdue && <div style={{ fontSize: 9, color: '#DC2626', fontWeight: 700 }}>VENCIDO</div>}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.descricao}</div>
                    {tx.total_parcelas > 1 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tx.parcela_atual}/{tx.total_parcelas}x</div>}
                    {tx.recorrente && <div style={{ fontSize: 9, color: '#0891B2', fontWeight: 700 }}>RECORRENTE</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {cat ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: (cat.cor || '#6B7280') + '22', color: cat.cor || '#6B7280', border: `1px solid ${cat.cor || '#6B7280'}44` }}>{cat.nome}</span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{tx.contact_nome || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{tx.profissional || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: tp?.color, whiteSpace: 'nowrap' }}>{fmtMoney(tx.valor)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => onToggle(tx)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${st?.border}`, background: st?.bg, color: st?.color }}>
                      {st?.label}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="table-action" onClick={() => onEdit(tx)}><Pencil size={11} /></button>
                      <button className="table-action" style={{ color: '#DC2626' }} onClick={() => onDelete(tx.id)} disabled={deleting === tx.id}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function CompanyFinanceiro() {
  const { session } = useAuth()
  // Era session?.company?.instance_name || session?.company?.instancia — nenhum dos dois
  // existe no schema real de `companies` (só `instance`). Isso deixava o módulo inteiro
  // sempre vazio pra qualquer empresa real (confirmei: 0 lançamentos reais no banco).
  const instance = session?.company?.instance
  const userEmail = session?.user?.email
  const isAdmin = session?.user?.role === 'admin'

  const [activeTab, setActiveTab]       = useState('overview')
  const [transactions, setTransactions] = useState([])
  const [allPending, setAllPending]     = useState([])
  const [chartData, setChartData]       = useState([])
  const [categories, setCategories]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [monthOffset, setMonthOffset]   = useState(0)
  const [filterTipo, setFilterTipo]     = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterCat, setFilterCat]       = useState('todas')
  const [filterQuick, setFilterQuick]   = useState('todos')
  const [agingBucket, setAgingBucket]   = useState('all')
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(null)
  const [err, setErr]                   = useState('')
  const [catModal, setCatModal]         = useState(false)
  const [catForm, setCatForm]           = useState({ nome: '', tipo: 'receita', cor: '#16A34A' })
  const [savingCat, setSavingCat]       = useState(false)
  const [deletingCat, setDeletingCat]   = useState(null)

  const range = useMemo(() => monthRange(monthOffset), [monthOffset])

  // ── Data loading ─────────────────────────────────────────────────────────
  async function seedDefaultCategories(inst) {
    const { data: defaults } = await supabase
      .from('financial_categories').select('nome, tipo, cor').eq('instancia', '_default_')
    if (!defaults?.length) return
    await supabase.from('financial_categories').insert(defaults.map(d => ({ ...d, instancia: inst })))
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('financial_categories').select('*').eq('instancia', instance).order('nome')
    if (!data) return
    if (data.length === 0) { await seedDefaultCategories(instance); loadCategories() }
    else setCategories(data)
  }

  async function loadTransactions() {
    setLoading(true)
    const { data } = await supabase
      .from('financial_transactions').select('*, financial_categories(nome, cor, tipo)')
      .eq('instancia', instance)
      .gte('vencimento', range.start)
      .lte('vencimento', range.end)
      .order('vencimento', { ascending: true })
    setTransactions(data || [])
    setLoading(false)
  }

  async function loadAllPending() {
    // PostgREST corta em 1000 linhas por request. Clínica com muito pendente acumulado
    // perderia lançamentos vencidos antigos e o cálculo de inadimplência ficaria errado
    // se a gente aceitasse isso — então pagina em loop até trazer tudo.
    const PAGE = 1000
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('financial_transactions').select('*, financial_categories(nome, cor, tipo)')
        .eq('instancia', instance)
        .eq('status', 'pendente')
        .order('vencimento', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error || !data) break
      all = all.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }
    setAllPending(all)
  }

  async function loadChartData() {
    const now = new Date()
    const startD = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const endD   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const { data } = await supabase
      .from('financial_transactions').select('tipo, valor, vencimento')
      .eq('instancia', instance)
      .gte('vencimento', startD.toISOString().slice(0, 10))
      .lte('vencimento', endD.toISOString().slice(0, 10))
    if (!data) return
    const months = []
    for (let i = -5; i <= 0; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        fullLabel: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        receita: 0, despesa: 0,
      })
    }
    for (const tx of data) {
      const key = (tx.vencimento || '').slice(0, 7)
      const m = months.find(m => m.key === key)
      if (m) m[tx.tipo] = (m[tx.tipo] || 0) + +(tx.valor || 0)
    }
    setChartData(months)
  }

  useEffect(() => { if (instance) loadCategories() }, [instance])
  useEffect(() => { if (instance) loadTransactions() }, [instance, range.start])
  useEffect(() => { if (instance) { loadAllPending(); loadChartData() } }, [instance])

  // ── Form ─────────────────────────────────────────────────────────────────
  const emptyForm = () => ({
    tipo: 'receita', descricao: '', valor: '', status: 'pendente',
    categoria_id: '', vencimento: todayStr(), pagamento_at: '',
    forma_pagamento: '', parcelas: 1, recorrente: false,
    recorrencia_tipo: 'mensal', centro_custo: '', observacoes: '',
    contact_nome: '', profissional: '',
  })
  const [form, setForm] = useState(emptyForm())

  function openNew(tipo = 'receita') {
    setForm({ ...emptyForm(), tipo })
    setModal('new')
    setErr('')
  }
  function openEdit(tx) {
    setForm({
      tipo: tx.tipo, descricao: tx.descricao, valor: String(tx.valor || ''),
      status: tx.status, categoria_id: tx.categoria_id || '',
      vencimento: tx.vencimento || '', pagamento_at: tx.pagamento_at || '',
      forma_pagamento: tx.forma_pagamento || '', parcelas: tx.total_parcelas || 1,
      recorrente: tx.recorrente || false, recorrencia_tipo: tx.recorrencia_tipo || 'mensal',
      centro_custo: tx.centro_custo || '', observacoes: tx.observacoes || '',
      contact_nome: tx.contact_nome || '', profissional: tx.profissional || '',
    })
    setModal(tx)
    setErr('')
  }

  async function handleSave() {
    if (!form.descricao.trim()) { setErr('Descrição obrigatória'); return }
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setErr('Valor inválido'); return }
    if (!form.vencimento) { setErr('Data de vencimento obrigatória'); return }
    setSaving(true); setErr('')

    const base = {
      instancia: instance, tipo: form.tipo, descricao: form.descricao.trim(),
      valor, status: form.status, categoria_id: form.categoria_id || null,
      vencimento: form.vencimento, pagamento_at: form.pagamento_at || null,
      forma_pagamento: form.forma_pagamento || null, centro_custo: form.centro_custo || null,
      observacoes: form.observacoes || null, contact_nome: form.contact_nome || null,
      profissional: form.profissional || null, created_by: userEmail,
      recorrente: form.recorrente, recorrencia_tipo: form.recorrente ? form.recorrencia_tipo : null,
    }

    if (modal === 'new') {
      const parcelas = Math.max(1, parseInt(form.parcelas) || 1)
      if (parcelas > 1) {
        const grupoParcelas = crypto.randomUUID()
        const rows = Array.from({ length: parcelas }, (_, idx) => {
          const d = new Date(form.vencimento + 'T12:00:00')
          d.setMonth(d.getMonth() + idx)
          return { ...base, parcela_atual: idx + 1, total_parcelas: parcelas, grupo_parcelas: grupoParcelas, vencimento: d.toISOString().slice(0, 10) }
        })
        await supabase.from('financial_transactions').insert(rows)
      } else if (form.recorrente) {
        const grupoRec = crypto.randomUUID()
        const rows = Array.from({ length: 12 }, (_, idx) => {
          const d = new Date(form.vencimento + 'T12:00:00')
          d.setMonth(d.getMonth() + idx)
          return { ...base, grupo_recorrencia: grupoRec, vencimento: d.toISOString().slice(0, 10) }
        })
        await supabase.from('financial_transactions').insert(rows)
      } else {
        await supabase.from('financial_transactions').insert([base])
      }
    } else {
      await supabase.from('financial_transactions').update(base).eq('id', modal.id)
    }

    setSaving(false)
    setModal(null)
    loadTransactions()
    loadAllPending()
    loadChartData()
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('financial_transactions').delete().eq('id', id)
    setDeleting(null)
    setTransactions(prev => prev.filter(t => t.id !== id))
    setAllPending(prev => prev.filter(t => t.id !== id))
  }

  async function handleToggleStatus(tx) {
    const next = tx.status === 'pago' ? 'pendente' : 'pago'
    const patch = { status: next, pagamento_at: next === 'pago' ? todayStr() : null }
    await supabase.from('financial_transactions').update(patch).eq('id', tx.id)
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, ...patch } : t))
    setAllPending(prev => prev.filter(t => t.id !== tx.id))
    loadChartData()
  }

  async function handleSaveCat() {
    if (!catForm.nome.trim()) return
    setSavingCat(true)
    await supabase.from('financial_categories').insert([{ ...catForm, instancia: instance }])
    setSavingCat(false)
    setCatForm({ nome: '', tipo: 'receita', cor: '#16A34A' })
    loadCategories()
  }

  async function handleDeleteCat(id) {
    setDeletingCat(id)
    await supabase.from('financial_categories').delete().eq('id', id)
    setDeletingCat(null)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  function exportCSV(rows) {
    const headers = ['Vencimento', 'Descrição', 'Tipo', 'Categoria', 'Forma Pagamento', 'Valor', 'Status', 'Data Pagamento', 'Paciente', 'Profissional', 'Centro de Custo', 'Observações']
    const lines = [
      headers.join(';'),
      ...rows.map(t => [
        fmtDate(t.vencimento),
        `"${(t.descricao || '').replace(/"/g, '""')}"`,
        t.tipo,
        t.financial_categories?.nome || '',
        t.forma_pagamento || '',
        String(t.valor || '0').replace('.', ','),
        t.status,
        fmtDate(t.pagamento_at),
        t.contact_nome || '',
        t.profissional || '',
        t.centro_custo || '',
        `"${(t.observacoes || '').replace(/"/g, '""')}"`,
      ].join(';'))
    ]
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financeiro_${range.start.slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])

  const today = todayStr()
  const in7   = addDays(today, 7)
  const in30  = addDays(today, 30)

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterTipo !== 'todos' && t.tipo !== filterTipo) return false
      if (filterStatus !== 'todos' && t.status !== filterStatus) return false
      if (filterCat !== 'todas' && t.categoria_id !== filterCat) return false
      if (filterQuick === 'overdue' && !(t.status === 'pendente' && t.vencimento < today)) return false
      if (filterQuick === 'hoje' && t.vencimento !== today) return false
      if (filterQuick === 'semana' && !(t.vencimento >= today && t.vencimento <= in7)) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (t.descricao || '').toLowerCase().includes(q) ||
               (t.contact_nome || '').toLowerCase().includes(q) ||
               (t.profissional || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [transactions, filterTipo, filterStatus, filterCat, filterQuick, search])

  const kpis = useMemo(() => {
    const paid = transactions.filter(t => t.status === 'pago')
    const pend = transactions.filter(t => t.status === 'pendente')
    const receita_realiz = paid.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0)
    const despesa_realiz = paid.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0)
    const receita_prev   = transactions.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0)
    const despesa_prev   = transactions.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0)
    const a_receber = pend.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0)
    const a_pagar   = pend.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0)
    const inadimplente = allPending.filter(t => t.tipo === 'receita' && t.vencimento < today).reduce((s, t) => s + +t.valor, 0)
    return { receita_realiz, despesa_realiz, receita_prev, despesa_prev, a_receber, a_pagar, inadimplente, saldo: receita_realiz - despesa_realiz }
  }, [transactions, allPending])

  const catBreakdown = useMemo(() => {
    const map = {}
    transactions.filter(t => t.categoria_id && t.tipo === 'receita').forEach(t => {
      const c = catMap[t.categoria_id]
      if (!c) return
      if (!map[t.categoria_id]) map[t.categoria_id] = { nome: c.nome, cor: c.cor, total: 0 }
      map[t.categoria_id].total += +t.valor
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [transactions, catMap])

  const agingReceiver = useMemo(() => {
    const rx = allPending.filter(t => t.tipo === 'receita')
    return {
      all:    rx,
      overdue: rx.filter(t => t.vencimento < today),
      hoje:   rx.filter(t => t.vencimento === today),
      semana: rx.filter(t => t.vencimento > today && t.vencimento <= in7),
      mes:    rx.filter(t => t.vencimento > in7 && t.vencimento <= in30),
      futuro: rx.filter(t => t.vencimento > in30),
    }
  }, [allPending])

  const agingPayer = useMemo(() => {
    const px = allPending.filter(t => t.tipo === 'despesa')
    return {
      all:    px,
      overdue: px.filter(t => t.vencimento < today),
      hoje:   px.filter(t => t.vencimento === today),
      semana: px.filter(t => t.vencimento > today && t.vencimento <= in7),
      mes:    px.filter(t => t.vencimento > in7 && t.vencimento <= in30),
      futuro: px.filter(t => t.vencimento > in30),
    }
  }, [allPending])

  // ── Shared aging buckets config ───────────────────────────────────────────
  function agingBuckets(ag, tipo) {
    const isReceita = tipo === 'receita'
    return [
      { key: 'all',    label: isReceita ? 'Total a receber' : 'Total a pagar', color: isReceita ? '#16A34A' : '#9333EA', bg: isReceita ? '#F0FDF4' : '#FAF5FF', items: ag.all },
      { key: 'overdue',label: 'Vencido',        color: '#DC2626', bg: '#FEF2F2', items: ag.overdue },
      { key: 'hoje',   label: 'Vence hoje',     color: '#D97706', bg: '#FFFBEB', items: ag.hoje },
      { key: 'semana', label: 'Próx. 7 dias',   color: '#0891B2', bg: '#F0F9FF', items: ag.semana },
      { key: 'mes',    label: 'Próx. 30 dias',  color: '#7C3AED', bg: '#F5F3FF', items: ag.mes },
      { key: 'futuro', label: 'Futuro',          color: '#64748B', bg: '#F8FAFC', items: ag.futuro },
    ]
  }

  const TABS = [
    { key: 'overview',    label: 'Visão Geral' },
    { key: 'lancamentos', label: 'Lançamentos' },
    { key: 'receber',     label: `A Receber${agingReceiver.overdue.length > 0 ? ` · ${agingReceiver.overdue.length} vencido` : ''}` },
    { key: 'pagar',       label: `A Pagar${agingPayer.overdue.length > 0 ? ` · ${agingPayer.overdue.length} vencido` : ''}` },
  ]

  // ── Month nav helper ──────────────────────────────────────────────────────
  const MonthNav = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <button className="nx-btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setMonthOffset(p => p - 1)}><ChevronLeft size={15} /></button>
      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 150, textAlign: 'center', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{range.label}</span>
      <button className="nx-btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setMonthOffset(p => p + 1)}><ChevronRight size={15} /></button>
      {monthOffset !== 0 && <button className="nx-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setMonthOffset(0)}>Mês atual</button>}
    </div>
  )

  // ── Acesso restrito: só admin da empresa entra no Financeiro ────────────────
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '2rem', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Lock size={26} style={{ color: '#DC2626' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Acesso restrito</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.5 }}>
          O módulo Financeiro é visível só pra administradores da empresa. Se você precisa de acesso, peça pro admin da sua clínica.
        </p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="company-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Financeiro</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>Gestão de receitas e despesas</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="nx-btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setCatModal(true)}>
            <Tag size={13} /> Categorias
          </button>
          <button className="nx-btn-ghost" style={{ fontSize: 12, padding: '6px 12px', color: '#DC2626' }} onClick={() => openNew('despesa')}>
            <TrendingDown size={13} /> Nova despesa
          </button>
          <button className="nx-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => openNew('receita')}>
            <Plus size={13} /> Nova receita
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setAgingBucket('all') }}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? 'var(--brand, #2563EB)' : 'var(--text-muted)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? 'var(--brand, #2563EB)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1, transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ VISÃO GERAL ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && <>
        <MonthNav />

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Saldo realizado',  value: kpis.saldo,         color: kpis.saldo >= 0 ? '#16A34A' : '#DC2626', bg: kpis.saldo >= 0 ? '#F0FDF4' : '#FEF2F2', sub: 'Receitas − Despesas pagas' },
            { label: 'Receitas pagas',   value: kpis.receita_realiz, color: '#16A34A', bg: '#F0FDF4', sub: `Prev.: ${fmtMoney(kpis.receita_prev)}` },
            { label: 'Despesas pagas',   value: kpis.despesa_realiz, color: '#DC2626', bg: '#FEF2F2', sub: `Prev.: ${fmtMoney(kpis.despesa_prev)}` },
            { label: 'A receber',        value: kpis.a_receber,      color: '#D97706', bg: '#FFFBEB', sub: 'Receitas pendentes do mês' },
            { label: 'A pagar',          value: kpis.a_pagar,        color: '#9333EA', bg: '#FAF5FF', sub: 'Despesas pendentes do mês' },
            { label: 'Inadimplência',    value: kpis.inadimplente,   color: '#DC2626', bg: '#FEF2F2', sub: 'Receitas vencidas (geral)', border: kpis.inadimplente > 0 ? '2px solid #FECACA' : undefined },
          ].map(k => (
            <div key={k.label} className="nx-card" style={{ padding: '14px 16px', background: k.bg, border: k.border }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: k.color }}>{fmtMoney(k.value)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Chart + Category breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 20 }}>
          <div className="nx-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Evolução — últimos 6 meses</div>
            <MonthlyChart data={chartData} />
          </div>
          <div className="nx-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Receitas por categoria · {range.label.split(' ')[0]}</div>
            {catBreakdown.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 32 }}>Sem dados de categoria</div>
            ) : (() => {
              const maxCat = Math.max(...catBreakdown.map(c => c.total), 1)
              return catBreakdown.map(c => (
                <div key={c.nome} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.nome}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{fmtMoney(c.total)}</span>
                  </div>
                  <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: c.cor || '#16A34A', borderRadius: 3, width: `${(c.total / maxCat) * 100}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* Overdue alerts */}
        {(agingReceiver.overdue.length > 0 || agingPayer.overdue.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {agingReceiver.overdue.length > 0 && (
              <div className="nx-card" style={{ padding: '14px 16px', borderLeft: '4px solid #DC2626' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} /> {agingReceiver.overdue.length} recebimento(s) vencido(s)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>{fmtMoney(agingReceiver.overdue.reduce((s, t) => s + +t.valor, 0))}</div>
                <button onClick={() => { setActiveTab('receber'); setAgingBucket('overdue') }}
                  style={{ marginTop: 8, fontSize: 11, color: '#DC2626', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                  Ver detalhes →
                </button>
              </div>
            )}
            {agingPayer.overdue.length > 0 && (
              <div className="nx-card" style={{ padding: '14px 16px', borderLeft: '4px solid #9333EA' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9333EA', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} /> {agingPayer.overdue.length} pagamento(s) vencido(s)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#9333EA' }}>{fmtMoney(agingPayer.overdue.reduce((s, t) => s + +t.valor, 0))}</div>
                <button onClick={() => { setActiveTab('pagar'); setAgingBucket('overdue') }}
                  style={{ marginTop: 8, fontSize: 11, color: '#9333EA', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                  Ver detalhes →
                </button>
              </div>
            )}
          </div>
        )}
      </>}

      {/* ══ LANÇAMENTOS ══════════════════════════════════════════════════════ */}
      {activeTab === 'lancamentos' && <>
        {/* Month nav + quick filters + export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="nx-btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setMonthOffset(p => p - 1)}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 150, textAlign: 'center', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{range.label}</span>
          <button className="nx-btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setMonthOffset(p => p + 1)}><ChevronRight size={15} /></button>
          {monthOffset !== 0 && <button className="nx-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setMonthOffset(0)}>Mês atual</button>}
          <div style={{ flex: 1 }} />
          {[
            { key: 'todos',   label: 'Todos' },
            { key: 'overdue', label: 'Vencidos',     color: '#DC2626' },
            { key: 'hoje',    label: 'Hoje',         color: '#D97706' },
            { key: 'semana',  label: 'Próx. 7 dias', color: '#0891B2' },
          ].map(q => (
            <button key={q.key} onClick={() => setFilterQuick(q.key)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `1px solid ${filterQuick === q.key ? (q.color || '#2563EB') : 'var(--border)'}`, background: filterQuick === q.key ? (q.color || '#2563EB') + '18' : 'transparent', color: filterQuick === q.key ? (q.color || '#2563EB') : 'var(--text-muted)', cursor: 'pointer', fontWeight: filterQuick === q.key ? 700 : 400, whiteSpace: 'nowrap' }}>
              {q.label}
            </button>
          ))}
          <button className="nx-btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => exportCSV(filtered)}>
            <Download size={12} /> Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 150 }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="nx-input" placeholder="Buscar..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28, fontSize: 12, height: 32 }} />
          </div>
          <select className="nx-select" style={{ fontSize: 12, height: 32 }} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
          <select className="nx-select" style={{ fontSize: 12, height: 32 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="nx-select" style={{ fontSize: 12, height: 32 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="todas">Todas as categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="nx-card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <Wallet size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
              <div>Nenhum lançamento encontrado.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                    {['Vencimento', 'Descrição', 'Categoria', 'Forma', 'Profissional', 'Valor', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => {
                    const st = STATUS_OPTIONS.find(s => s.value === tx.status)
                    const tp = TIPO_COLORS[tx.tipo]
                    const cat = catMap[tx.categoria_id]
                    const isOverdue = tx.status === 'pendente' && tx.vencimento && tx.vencimento < today
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ color: isOverdue ? '#DC2626' : 'var(--text-secondary)' }}>{fmtDate(tx.vencimento)}</div>
                          {isOverdue && <div style={{ fontSize: 9, color: '#DC2626', fontWeight: 700 }}>VENCIDO</div>}
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.descricao}</div>
                          {tx.contact_nome && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tx.contact_nome}</div>}
                          {tx.total_parcelas > 1 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tx.parcela_atual}/{tx.total_parcelas}x · {fmtMoney(tx.valor)} cada</div>}
                          {tx.recorrente && <div style={{ fontSize: 9, color: '#0891B2', fontWeight: 700 }}>RECORRENTE</div>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {cat ? (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: (cat.cor || '#6B7280') + '22', color: cat.cor || '#6B7280', border: `1px solid ${cat.cor || '#6B7280'}44` }}>{cat.nome}</span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{tx.forma_pagamento || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{tx.profissional || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: tp?.color, whiteSpace: 'nowrap' }}>
                          {tx.tipo === 'despesa' ? '−' : '+'}{fmtMoney(tx.valor)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={() => handleToggleStatus(tx)}
                            title={tx.status === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${st?.border}`, background: st?.bg, color: st?.color }}>
                            {st?.label}
                          </button>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="table-action" onClick={() => openEdit(tx)}><Pencil size={11} /></button>
                            <button className="table-action" style={{ color: '#DC2626' }} onClick={() => handleDelete(tx.id)} disabled={deleting === tx.id}><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer summary */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'flex-end', fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ color: '#16A34A', fontWeight: 700 }}>Receitas: {fmtMoney(filtered.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0))}</span>
            <span style={{ color: '#DC2626', fontWeight: 700 }}>Despesas: {fmtMoney(filtered.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0))}</span>
            <span style={{ color: 'var(--text-muted)' }}>{filtered.length} lançamento(s)</span>
          </div>
        )}
      </>}

      {/* ══ A RECEBER ════════════════════════════════════════════════════════ */}
      {activeTab === 'receber' && (() => {
        const buckets = agingBuckets(agingReceiver, 'receita')
        const activeItems = agingReceiver[agingBucket] || agingReceiver.all
        return <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            {buckets.map(b => (
              <div key={b.key} onClick={() => setAgingBucket(b.key)} className="nx-card"
                style={{ padding: '12px 14px', background: agingBucket === b.key ? b.bg : undefined, border: `1px solid ${agingBucket === b.key ? b.color + '66' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: b.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{b.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: b.color }}>{fmtMoney(b.items.reduce((s, t) => s + +t.valor, 0))}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{b.items.length} lançamento(s)</div>
              </div>
            ))}
          </div>
          <PendingTable items={activeItems} catMap={catMap} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggleStatus} deleting={deleting} />
        </>
      })()}

      {/* ══ A PAGAR ══════════════════════════════════════════════════════════ */}
      {activeTab === 'pagar' && (() => {
        const buckets = agingBuckets(agingPayer, 'despesa')
        const activeItems = agingPayer[agingBucket] || agingPayer.all
        return <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            {buckets.map(b => (
              <div key={b.key} onClick={() => setAgingBucket(b.key)} className="nx-card"
                style={{ padding: '12px 14px', background: agingBucket === b.key ? b.bg : undefined, border: `1px solid ${agingBucket === b.key ? b.color + '66' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: b.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{b.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: b.color }}>{fmtMoney(b.items.reduce((s, t) => s + +t.valor, 0))}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{b.items.length} lançamento(s)</div>
              </div>
            ))}
          </div>
          <PendingTable items={activeItems} catMap={catMap} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggleStatus} deleting={deleting} />
        </>
      })()}

      {/* ══ MODAL NOVO/EDITAR ════════════════════════════════════════════════ */}
      {modal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{modal === 'new' ? 'Novo lançamento' : 'Editar lançamento'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tipo */}
              <div>
                <label style={LS}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['receita', 'despesa'].map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, tipo: t }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${form.tipo === t ? TIPO_COLORS[t].color : 'var(--border)'}`, background: form.tipo === t ? TIPO_COLORS[t].bg : 'transparent', color: form.tipo === t ? TIPO_COLORS[t].color : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
                      {TIPO_COLORS[t].label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Descrição */}
              <div>
                <label style={LS}>Descrição *</label>
                <input className="nx-input" placeholder="Ex: Consulta Dr. Silva" value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              {/* Valor + Data vencimento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LS}>Valor (R$) *</label>
                  <input className="nx-input" type="number" min="0" step="0.01" placeholder="0,00"
                    value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <label style={LS}>Vencimento *</label>
                  <input className="nx-input" type="date" value={form.vencimento}
                    onChange={e => setForm(p => ({ ...p, vencimento: e.target.value }))} />
                </div>
              </div>
              {/* Categoria + Forma */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LS}>Categoria</label>
                  <select className="nx-select" value={form.categoria_id}
                    onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value }))}>
                    <option value="">— Sem categoria —</option>
                    {categories.filter(c => c.tipo === form.tipo || c.tipo === 'ambos').map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={LS}>Forma de pagamento</label>
                  <select className="nx-select" value={form.forma_pagamento}
                    onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value }))}>
                    <option value="">— Selecione —</option>
                    {FORMA_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              {/* Status + Data pagamento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LS}>Status</label>
                  <select className="nx-select" value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Data de pagamento</label>
                  <input className="nx-input" type="date" value={form.pagamento_at}
                    onChange={e => setForm(p => ({ ...p, pagamento_at: e.target.value }))} />
                </div>
              </div>
              {/* Paciente + Profissional */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LS}>Paciente</label>
                  <input className="nx-input" placeholder="Nome do paciente" value={form.contact_nome}
                    onChange={e => setForm(p => ({ ...p, contact_nome: e.target.value }))} />
                </div>
                <div>
                  <label style={LS}>Profissional</label>
                  <input className="nx-input" placeholder="Dr(a). responsável" value={form.profissional}
                    onChange={e => setForm(p => ({ ...p, profissional: e.target.value }))} />
                </div>
              </div>
              {/* Parcelamento / Recorrência — só no cadastro */}
              {modal === 'new' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={LS}>Parcelas (1 = à vista)</label>
                    <input className="nx-input" type="number" min="1" max="60" value={form.parcelas}
                      onChange={e => setForm(p => ({ ...p, parcelas: e.target.value }))} />
                  </div>
                  <div>
                    <label style={LS}>Recorrente</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <input type="checkbox" checked={form.recorrente}
                        onChange={e => setForm(p => ({ ...p, recorrente: e.target.checked }))}
                        style={{ width: 15, height: 15, cursor: 'pointer' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gera 12 meses automaticamente</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Centro de custo */}
              <div>
                <label style={LS}>Centro de custo</label>
                <input className="nx-input" placeholder="Ex: Clínica principal, Setor A..." value={form.centro_custo}
                  onChange={e => setForm(p => ({ ...p, centro_custo: e.target.value }))} />
              </div>
              {/* Observações */}
              <div>
                <label style={LS}>Observações</label>
                <textarea className="nx-input" rows={2} placeholder="Notas internas..."
                  value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  style={{ resize: 'vertical', minHeight: 52 }} />
              </div>
              {err && <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>{err}</div>}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : modal === 'new' ? 'Criar lançamento' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══ MODAL CATEGORIAS ════════════════════════════════════════════════ */}
      {catModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setCatModal(false) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Categorias</h3>
              <button onClick={() => setCatModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '0.5rem 1.5rem 1rem', maxHeight: 320, overflowY: 'auto' }}>
              {categories.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{c.nome}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize', marginRight: 4 }}>{c.tipo}</span>
                  <button className="table-action" style={{ color: '#DC2626' }}
                    onClick={() => handleDeleteCat(c.id)} disabled={deletingCat === c.id}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={LS}>Nova categoria</label>
                  <input className="nx-input" placeholder="Nome" value={catForm.nome}
                    onChange={e => setCatForm(p => ({ ...p, nome: e.target.value }))} />
                </div>
                <select className="nx-select" style={{ fontSize: 12 }} value={catForm.tipo}
                  onChange={e => setCatForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                  <option value="ambos">Ambos</option>
                </select>
                <input type="color" value={catForm.cor}
                  onChange={e => setCatForm(p => ({ ...p, cor: e.target.value }))}
                  style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              </div>
              <button className="nx-btn-primary" style={{ justifyContent: 'center' }}
                onClick={handleSaveCat} disabled={savingCat || !catForm.nome.trim()}>
                {savingCat ? 'Salvando...' : 'Adicionar categoria'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
