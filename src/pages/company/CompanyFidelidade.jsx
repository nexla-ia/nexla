import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isNewClient, NEW_CLIENT_MAX_DAYS } from '../../lib/loyalty'
import { Search, AlertCircle, History, MessageSquare, Users, CalendarDays } from 'lucide-react'
import './Company.css'

function normPhoneKey(sid) {
  const n = (sid || '').replace(/@.*$/, '').replace(/\D/g, '')
  return n.startsWith('55') && n.length > 10 ? n.slice(2) : n
}

function formatPhone(val) {
  return (val || '').replace(/@.*$/, '')
}

// horaLastMessage vem como "DD/MM/AAAA HH:mm:ss" (não ISO) — precisa converter
// antes de qualquer new Date(), senão vira Invalid Date silenciosamente.
function parseTimestamp(val) {
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

function getTimestamp(row) { return parseTimestamp(row.horaLastMessage) || row.created_at || null }

// YYYY-MM-DD no fuso local (evita o desvio de toISOString, que usa UTC)
function toLocalDateStr(d) {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

function toLocalMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayStr() { return toLocalDateStr(new Date()) }
function currentMonthStr() { return toLocalMonthStr(new Date()) }

function sameLocalDay(ts, dateStr) {
  if (!ts) return false
  const d = new Date(ts)
  if (isNaN(d.getTime())) return false
  return toLocalDateStr(d) === dateStr
}

function sameLocalMonth(ts, monthStr) {
  if (!ts) return false
  const d = new Date(ts)
  if (isNaN(d.getTime())) return false
  return toLocalMonthStr(d) === monthStr
}

function fmtWhen(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function fmtMonthBR(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function CompanyFidelidade() {
  const { session } = useAuth()
  const instance = session?.company?.instance
  const navigate = useNavigate()

  const [contacts, setContacts] = useState([])
  const [savedByPhone, setSavedByPhone] = useState({}) // numero (só dígitos) → { nome, photo }
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('dia') // 'dia' | 'mes'
  const [dateFilter, setDateFilter] = useState(todayStr())
  const [monthFilter, setMonthFilter] = useState(currentMonthStr())

  useEffect(() => {
    if (!instance) return
    setLoading(true)

    supabase.from('saved_contacts').select('numero, nome, photo').eq('instancia', instance)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(c => { map[normPhoneKey(c.numero)] = { nome: c.nome, photo: c.photo } })
        setSavedByPhone(map)
      })

    supabase.from('mensagens_geral').select('numero, nome, horaLastMessage, created_at')
      .eq('instancia', instance)
      .order('id', { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (!error && data) {
          const seen = new Set()
          const msgCountByNum = new Map()
          const firstSeenByNum = new Map()
          for (const row of data) {
            if (!row.numero || row.numero.includes('@g.us')) continue
            const norm = normPhoneKey(row.numero)
            msgCountByNum.set(norm, (msgCountByNum.get(norm) || 0) + 1)
            const ts = getTimestamp(row)
            if (ts) {
              const prev = firstSeenByNum.get(norm)
              if (!prev || new Date(ts) < new Date(prev)) firstSeenByNum.set(norm, ts)
            }
          }
          const unique = []
          for (const row of data) {
            const sid = row.numero
            if (!sid || sid.includes('@g.us')) continue
            const norm = normPhoneKey(sid)
            if (seen.has(norm)) continue
            seen.add(norm)
            unique.push({
              session_id: sid,
              phone: formatPhone(sid),
              norm,
              pushname: row.nome || null,
              lastTs: getTimestamp(row),
              msgCount: msgCountByNum.get(norm) || 1,
              firstSeenAt: firstSeenByNum.get(norm) || null,
            })
          }
          unique.sort((a, b) => new Date(b.lastTs || 0) - new Date(a.lastTs || 0))
          setContacts(unique)
        }
        setLoading(false)
      })
  }, [instance])

  const enriched = useMemo(() => contacts.map(c => {
    const saved = savedByPhone[c.norm]
    return {
      ...c,
      nome: saved?.nome || c.pushname || c.phone,
      photo: saved?.photo || null,
      novo: isNewClient(c.firstSeenAt),
    }
  }), [contacts, savedByPhone])

  // A tela só existe pra mostrar clientes novos — o filtro é a data (dia ou mês) da última interação
  const filtered = useMemo(() => enriched.filter(c => {
    if (!c.novo) return false
    const matchesDate = mode === 'dia' ? sameLocalDay(c.lastTs, dateFilter) : sameLocalMonth(c.lastTs, monthFilter)
    if (!matchesDate) return false
    const s = search.toLowerCase()
    return !s || c.nome?.toLowerCase().includes(s) || c.phone.includes(search)
  }), [enriched, search, mode, dateFilter, monthFilter])

  const periodLabel = mode === 'dia' ? fmtDateBR(dateFilter) : fmtMonthBR(monthFilter)

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            Fidelidade
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Carregando...' : `${filtered.length} cliente${filtered.length === 1 ? '' : 's'} novo${filtered.length === 1 ? '' : 's'} em ${periodLabel}`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="nx-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 260px' }}>
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)' }}
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--border)', padding: 3, borderRadius: 8 }}>
          {[
            { key: 'dia', label: 'Dia' },
            { key: 'mes', label: 'Mês' },
          ].map(o => (
            <button
              key={o.key}
              onClick={() => setMode(o.key)}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: mode === o.key ? '#fff' : 'transparent',
                color: mode === o.key ? '#DC2626' : 'var(--text-muted)',
                boxShadow: mode === o.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="nx-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarDays size={15} style={{ color: 'var(--text-muted)' }} />
          {mode === 'dia' ? (
            <input
              type="date"
              className="nx-input"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', padding: 0 }}
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
          ) : (
            <input
              type="month"
              className="nx-input"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', padding: 0 }}
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
            />
          )}
          {mode === 'dia' && dateFilter !== todayStr() && (
            <button className="nx-btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setDateFilter(todayStr())}>
              Hoje
            </button>
          )}
          {mode === 'mes' && monthFilter !== currentMonthStr() && (
            <button className="nx-btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setMonthFilter(currentMonthStr())}>
              Este mês
            </button>
          )}
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Cliente entra como novo até {NEW_CLIENT_MAX_DAYS} dia{NEW_CLIENT_MAX_DAYS === 1 ? '' : 's'} após o primeiro contato.
        </span>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Users size={28} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: 14 }}>
            Nenhum cliente novo em {periodLabel}.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="nx-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Mensagens</th>
                <th>Última interação</th>
                <th style={{ textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.session_id}>
                  <td className="td-name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: c.photo ? 'transparent' : '#EFF6FF',
                        border: c.photo ? 'none' : '1px solid #BFDBFE',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#2563EB', flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {c.photo
                          ? <img src={c.photo} alt={c.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : c.nome?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{c.nome}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, color: '#DC2626', background: '#FEE2E2', border: '1px solid #FECACA', lineHeight: '14px' }}>
                            <AlertCircle size={8} /> Novo
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{c.msgCount}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtWhen(c.lastTs)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button className="table-action"
                        style={{ background: '#16A34A', color: '#fff', border: 'none' }}
                        onClick={() => navigate(`/painel/conversas?contact=${c.session_id}`)}>
                        <MessageSquare size={11} /> Conversar
                      </button>
                      <button className="table-action" onClick={() => navigate(`/painel/historico?contact=${c.session_id}`)}>
                        <History size={11} /> Histórico
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
