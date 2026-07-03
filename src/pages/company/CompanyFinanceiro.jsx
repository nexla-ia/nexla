import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  DollarSign, Plus, X, Pencil, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock, XCircle,
  Filter, Search, Tag, Calendar, RefreshCw, ChevronDown,
} from 'lucide-react'
import './Company.css'

const TIPO_COLORS = {
  receita: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Receita' },
  despesa: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Despesa' },
}
const STATUS_OPTIONS = [
  { value: 'pendente',  label: 'Pendente',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Clock },
  { value: 'pago',      label: 'Pago',      color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
  { value: 'cancelado', label: 'Cancelado', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', icon: XCircle },
]
const FORMA_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Cheque', 'Outro']
const RECORRENCIA_OPTIONS = ['diario', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual']

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
function monthRange(offset = 0) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + offset
  const first = new Date(y, m, 1)
  const last  = new Date(y, m + 1, 0)
  return {
    start: first.toISOString().slice(0, 10),
    end:   last.toISOString().slice(0, 10),
    label: first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  }
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function CompanyFinanceiro() {
  const { session } = useAuth()
  const instance = session?.company?.instance_name || session?.company?.instancia
  const userEmail = session?.user?.email

  const [transactions, setTransactions]   = useState([])
  const [categories, setCategories]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [monthOffset, setMonthOffset]     = useState(0)
  const [filterTipo, setFilterTipo]       = useState('todos')
  const [filterStatus, setFilterStatus]   = useState('todos')
  const [filterCat, setFilterCat]         = useState('todas')
  const [search, setSearch]               = useState('')
  const [modal, setModal]                 = useState(null)   // null | 'new' | transaction object
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(null)
  const [err, setErr]                     = useState('')
  const [catModal, setCatModal]           = useState(false)
  const [catForm, setCatForm]             = useState({ nome: '', tipo: 'receita', cor: '#16A34A' })
  const [savingCat, setSavingCat]         = useState(false)

  const range = useMemo(() => monthRange(monthOffset), [monthOffset])

  // Seed categorias padrão se a instância não tiver nenhuma
  async function seedDefaultCategories(inst) {
    const { data: defaults } = await supabase
      .from('financial_categories').select('nome, tipo, cor').eq('instancia', '_default_')
    if (!defaults?.length) return
    const toInsert = defaults.map(d => ({ ...d, instancia: inst }))
    await supabase.from('financial_categories').insert(toInsert)
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('financial_categories').select('*')
      .eq('instancia', instance).order('nome')
    if (data) {
      if (data.length === 0) {
        await seedDefaultCategories(instance)
        loadCategories()
      } else {
        setCategories(data)
      }
    }
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

  useEffect(() => {
    if (!instance) return
    loadCategories()
  }, [instance])

  useEffect(() => {
    if (!instance) return
    loadTransactions()
  }, [instance, range.start])

  // ── Form state ──────────────────────────────────────────────────────────
  const emptyForm = () => ({
    tipo: 'receita',
    descricao: '',
    valor: '',
    status: 'pendente',
    categoria_id: '',
    vencimento: todayStr(),
    pagamento_at: '',
    forma_pagamento: '',
    parcelas: 1,
    recorrente: false,
    recorrencia_tipo: 'mensal',
    centro_custo: '',
    observacoes: '',
    contact_nome: '',
  })
  const [form, setForm] = useState(emptyForm())

  function openNew(tipo = 'receita') {
    setForm({ ...emptyForm(), tipo })
    setModal('new')
    setErr('')
  }
  function openEdit(tx) {
    setForm({
      tipo: tx.tipo,
      descricao: tx.descricao,
      valor: String(tx.valor || ''),
      status: tx.status,
      categoria_id: tx.categoria_id || '',
      vencimento: tx.vencimento || '',
      pagamento_at: tx.pagamento_at || '',
      forma_pagamento: tx.forma_pagamento || '',
      parcelas: tx.total_parcelas || 1,
      recorrente: tx.recorrente || false,
      recorrencia_tipo: tx.recorrencia_tipo || 'mensal',
      centro_custo: tx.centro_custo || '',
      observacoes: tx.observacoes || '',
      contact_nome: tx.contact_nome || '',
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
      instancia: instance,
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor,
      status: form.status,
      categoria_id: form.categoria_id || null,
      vencimento: form.vencimento,
      pagamento_at: form.pagamento_at || null,
      forma_pagamento: form.forma_pagamento || null,
      centro_custo: form.centro_custo || null,
      observacoes: form.observacoes || null,
      contact_nome: form.contact_nome || null,
      created_by: userEmail,
      recorrente: form.recorrente,
      recorrencia_tipo: form.recorrente ? form.recorrencia_tipo : null,
    }

    if (modal === 'new') {
      const parcelas = Math.max(1, parseInt(form.parcelas) || 1)
      if (parcelas > 1) {
        // Lançamento parcelado
        const grupoParcelas = crypto.randomUUID()
        const rows = []
        for (let i = 1; i <= parcelas; i++) {
          const d = new Date(form.vencimento + 'T12:00:00')
          d.setMonth(d.getMonth() + (i - 1))
          rows.push({
            ...base,
            parcela_atual: i,
            total_parcelas: parcelas,
            grupo_parcelas: grupoParcelas,
            vencimento: d.toISOString().slice(0, 10),
          })
        }
        await supabase.from('financial_transactions').insert(rows)
      } else if (form.recorrente) {
        // Recorrente — cria 12 ocorrências futuras
        const grupoRec = crypto.randomUUID()
        const rows = []
        for (let i = 0; i < 12; i++) {
          const d = new Date(form.vencimento + 'T12:00:00')
          d.setMonth(d.getMonth() + i)
          rows.push({ ...base, grupo_recorrencia: grupoRec, vencimento: d.toISOString().slice(0, 10) })
        }
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
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('financial_transactions').delete().eq('id', id)
    setDeleting(null)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  async function handleToggleStatus(tx) {
    const next = tx.status === 'pago' ? 'pendente' : 'pago'
    const patch = { status: next, pagamento_at: next === 'pago' ? todayStr() : null }
    await supabase.from('financial_transactions').update(patch).eq('id', tx.id)
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, ...patch } : t))
  }

  async function handleSaveCat() {
    if (!catForm.nome.trim()) return
    setSavingCat(true)
    await supabase.from('financial_categories').insert([{ ...catForm, instancia: instance }])
    setSavingCat(false)
    setCatModal(false)
    setCatForm({ nome: '', tipo: 'receita', cor: '#16A34A' })
    loadCategories()
  }

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterTipo !== 'todos' && t.tipo !== filterTipo) return false
      if (filterStatus !== 'todos' && t.status !== filterStatus) return false
      if (filterCat !== 'todas' && t.categoria_id !== filterCat) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (t.descricao || '').toLowerCase().includes(q) ||
               (t.contact_nome || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [transactions, filterTipo, filterStatus, filterCat, search])

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const paid   = transactions.filter(t => t.status === 'pago')
    const pend   = transactions.filter(t => t.status === 'pendente')
    const receita_realiz = paid.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0)
    const despesa_realiz = paid.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0)
    const receita_prev   = transactions.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0)
    const despesa_prev   = transactions.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0)
    const a_receber = pend.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0)
    const a_pagar   = pend.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0)
    return { receita_realiz, despesa_realiz, receita_prev, despesa_prev, a_receber, a_pagar,
             saldo: receita_realiz - despesa_realiz }
  }, [transactions])

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="company-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Financeiro
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Receitas e despesas · {range.label}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="nx-btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => setCatModal(true)}>
            <Tag size={13} /> Categorias
          </button>
          <button className="nx-btn-ghost" style={{ fontSize: 12, padding: '6px 12px', color: '#DC2626' }}
            onClick={() => openNew('despesa')}>
            <TrendingDown size={13} /> Nova despesa
          </button>
          <button className="nx-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => openNew('receita')}>
            <Plus size={13} /> Nova receita
          </button>
        </div>
      </div>

      {/* Navegação de mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button className="nx-btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setMonthOffset(p => p - 1)}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 150, textAlign: 'center', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {range.label}
        </span>
        <button className="nx-btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setMonthOffset(p => p + 1)}>
          <ChevronRight size={15} />
        </button>
        {monthOffset !== 0 && (
          <button className="nx-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setMonthOffset(0)}>
            Mês atual
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Saldo realizado', value: kpis.saldo, color: kpis.saldo >= 0 ? '#16A34A' : '#DC2626', bg: kpis.saldo >= 0 ? '#F0FDF4' : '#FEF2F2' },
          { label: 'Receitas pagas',  value: kpis.receita_realiz, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Despesas pagas',  value: kpis.despesa_realiz, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'A receber',       value: kpis.a_receber,      color: '#D97706', bg: '#FFFBEB' },
          { label: 'A pagar',         value: kpis.a_pagar,        color: '#9333EA', bg: '#FAF5FF' },
        ].map(k => (
          <div key={k.label} className="nx-card" style={{ padding: '14px 16px', background: k.bg }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{fmtMoney(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="nx-input" placeholder="Buscar lançamento..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28, fontSize: 12, height: 32 }} />
        </div>
        {[
          { value: filterTipo, set: setFilterTipo, options: [['todos','Todos'], ['receita','Receitas'], ['despesa','Despesas']] },
          { value: filterStatus, set: setFilterStatus, options: [['todos','Todos os status'], ['pendente','Pendente'], ['pago','Pago'], ['cancelado','Cancelado']] },
        ].map((f, i) => (
          <select key={i} className="nx-select" style={{ fontSize: 12, height: 32 }}
            value={f.value} onChange={e => f.set(e.target.value)}>
            {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <select className="nx-select" style={{ fontSize: 12, height: 32 }}
          value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="todas">Todas as categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="nx-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Wallet size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
            <div>Nenhum lançamento encontrado.</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Clique em "Nova receita" ou "Nova despesa" para começar.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                  {['Vencimento', 'Descrição', 'Categoria', 'Forma', 'Valor', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => {
                  const st = STATUS_OPTIONS.find(s => s.value === tx.status)
                  const tp = TIPO_COLORS[tx.tipo]
                  const cat = catMap[tx.categoria_id]
                  const isOverdue = tx.status === 'pendente' && tx.vencimento && tx.vencimento < todayStr()
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 12px', color: isOverdue ? '#DC2626' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {fmtDate(tx.vencimento)}
                        {isOverdue && <span style={{ fontSize: 10, marginLeft: 4, color: '#DC2626', fontWeight: 700 }}>VENCIDO</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.descricao}</div>
                        {tx.contact_nome && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tx.contact_nome}</div>}
                        {tx.total_parcelas > 1 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tx.parcela_atual}/{tx.total_parcelas}x</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {cat ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: (cat.cor || '#6B7280') + '22', color: cat.cor || '#6B7280', border: `1px solid ${cat.cor || '#6B7280'}44` }}>
                            {cat.nome}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {tx.forma_pagamento || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: tp?.color, whiteSpace: 'nowrap' }}>
                        {tx.tipo === 'despesa' ? '−' : '+'}{fmtMoney(tx.valor)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => handleToggleStatus(tx)}
                          title={tx.status === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${st?.border}`, background: st?.bg, color: st?.color }}>
                          {st?.label}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="table-action" onClick={() => openEdit(tx)}>
                            <Pencil size={11} />
                          </button>
                          <button className="table-action" style={{ color: '#DC2626' }}
                            onClick={() => handleDelete(tx.id)}
                            disabled={deleting === tx.id}>
                            <Trash2 size={11} />
                          </button>
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

      {/* Resumo rodapé */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'flex-end', fontSize: 12 }}>
          <span style={{ color: '#16A34A', fontWeight: 700 }}>
            Receitas: {fmtMoney(filtered.filter(t => t.tipo === 'receita').reduce((s, t) => s + +t.valor, 0))}
          </span>
          <span style={{ color: '#DC2626', fontWeight: 700 }}>
            Despesas: {fmtMoney(filtered.filter(t => t.tipo === 'despesa').reduce((s, t) => s + +t.valor, 0))}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{filtered.length} lançamento(s)</span>
        </div>
      )}

      {/* Modal novo/editar transação */}
      {modal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {modal === 'new' ? 'Novo lançamento' : 'Editar lançamento'}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tipo */}
              <div>
                <label style={labelStyle}>Tipo</label>
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
                <label style={labelStyle}>Descrição *</label>
                <input className="nx-input" placeholder="Ex: Consulta Dr. Silva" value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              {/* Valor + Data */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Valor (R$) *</label>
                  <input className="nx-input" type="number" min="0" step="0.01" placeholder="0,00"
                    value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Vencimento *</label>
                  <input className="nx-input" type="date" value={form.vencimento}
                    onChange={e => setForm(p => ({ ...p, vencimento: e.target.value }))} />
                </div>
              </div>
              {/* Categoria + Forma */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select className="nx-select" value={form.categoria_id}
                    onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value }))}>
                    <option value="">— Sem categoria —</option>
                    {categories.filter(c => c.tipo === form.tipo || c.tipo === 'ambos').map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Forma de pagamento</label>
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
                  <label style={labelStyle}>Status</label>
                  <select className="nx-select" value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Data de pagamento</label>
                  <input className="nx-input" type="date" value={form.pagamento_at}
                    onChange={e => setForm(p => ({ ...p, pagamento_at: e.target.value }))} />
                </div>
              </div>
              {/* Paciente */}
              <div>
                <label style={labelStyle}>Paciente (opcional)</label>
                <input className="nx-input" placeholder="Nome do paciente" value={form.contact_nome}
                  onChange={e => setForm(p => ({ ...p, contact_nome: e.target.value }))} />
              </div>
              {/* Parcelamento / Recorrência (só novo) */}
              {modal === 'new' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Parcelas</label>
                    <input className="nx-input" type="number" min="1" max="60" value={form.parcelas}
                      onChange={e => setForm(p => ({ ...p, parcelas: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Recorrente</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <input type="checkbox" checked={form.recorrente}
                        onChange={e => setForm(p => ({ ...p, recorrente: e.target.checked }))}
                        style={{ width: 15, height: 15, cursor: 'pointer' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gera 12 meses automaticamente</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Centro de custo + Observações */}
              <div>
                <label style={labelStyle}>Centro de custo</label>
                <input className="nx-input" placeholder="Ex: Clínica, Setor A..." value={form.centro_custo}
                  onChange={e => setForm(p => ({ ...p, centro_custo: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <textarea className="nx-input" rows={2} placeholder="Notas internas..."
                  value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  style={{ resize: 'vertical', minHeight: 52 }} />
              </div>
              {err && <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>{err}</div>}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 2, justifyContent: 'center' }}
                onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : modal === 'new' ? 'Criar lançamento' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal categorias */}
      {catModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setCatModal(false) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Categorias</h3>
              <button onClick={() => setCatModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '1rem 1.5rem', maxHeight: 300, overflowY: 'auto' }}>
              {categories.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{c.nome}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.tipo}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={labelStyle}>Nova categoria</label>
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
