import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isNewClient } from '../../lib/loyalty'
import { Search, AlertCircle, History, MessageSquare, Users, Send, Check, Lock, Zap, Clock } from 'lucide-react'
import './Company.css'

const FIDELIDADE_WEBHOOK = 'https://n8n.nexladesenvolvimento.com.br/webhook/recebe-info'
// Horário do disparo automático é fixo pra todas as empresas — só o dia do mês é configurável.
const FIDELIDADE_HORA_FIXA = '08:00'

function normPhoneKey(sid) {
  const n = (sid || '').replace(/@.*$/, '').replace(/\D/g, '')
  return n.startsWith('55') && n.length > 10 ? n.slice(2) : n
}

function fmtWhen(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Rótulo do mês de calendário anterior — o mesmo período usado por isNewClient()
function prevMonthLabel(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function CompanyFidelidade() {
  const { session } = useAuth()
  const instance = session?.company?.instance
  const navigate = useNavigate()
  const isOfficialApi = (session?.company?.whatsapp_api_type || 'evolution') === 'oficial'

  const [contacts, setContacts] = useState([])
  const [savedByPhone, setSavedByPhone] = useState({}) // numero (só dígitos) → { nome, photo }
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'
  const [mensagem, setMensagem] = useState('')
  const [sentMap, setSentMap] = useState({}) // numero (só dígitos) → { sent_at, scheduled_for }
  const [agendarDiaMes, setAgendarDiaMes] = useState('') // 1..31 | '' = sem agendamento (envia sempre)
  const [dispararStatus, setDispararStatus] = useState('idle') // idle | disparando | concluido | erro
  const [dispararInfo, setDispararInfo] = useState(null) // { total, resposta }

  async function dispararFidelidade(msgOverride) {
    if (!instance) return
    setDispararStatus('disparando')
    setDispararInfo(null)
    try {
      // Clientes novos do mês anterior que ainda não receberam
      const now = new Date()
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [{ data: allClients }, { data: jaEnviados }] = await Promise.all([
        supabase.from('fidelidade_clientes_novos')
          .select('numero, nome, primeiro_contato')
          .eq('instancia', instance)
          .gte('primeiro_contato', prevStart)
          .lt('primeiro_contato', prevEnd),
        supabase.from('fidelidade_envios').select('numero').eq('instancia', instance),
      ])

      const jaSet = new Set((jaEnviados || []).map(c => normPhoneKey(c.numero)))
      const clientes = (allClients || [])
        .filter(c => !jaSet.has(normPhoneKey(c.numero)))
        .map(c => ({ numero: c.numero, nome: c.nome || null }))

      const mesRef = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}` // mês anterior
      const apiType = session?.company?.whatsapp_api_type || 'evolution'

      const payload = {
        empresa: {
          nome: session?.company?.name || null,
          instancia: instance,
          api_instancia: session?.company?.api_instancia || null,
          whatsapp_api_type: apiType,
          webhook_envio: apiType === 'oficial'
            ? 'https://n8n.nexladesenvolvimento.com.br/webhook/respondeplataforma'
            : 'https://n8n.nexladesenvolvimento.com.br/webhook/envioNexla',
        },
        mensagem: msgOverride || mensagem,
        clientes,
        total: clientes.length,
        mes_referencia: mesRef,
      }

      const res = await fetch(FIDELIDADE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const resText = await res.text()
      setDispararStatus('concluido')
      setDispararInfo({ total: clientes.length, resposta: resText })
    } catch (err) {
      setDispararStatus('erro')
      setDispararInfo({ resposta: err.message })
    }
  }

  // Mensagem configurada e histórico de envios — carrega direto do banco (não confia
  // no session.company em cache, que pode ter sido salvo antes da coluna existir)
  useEffect(() => {
    if (!instance || !session?.company?.id) return

    supabase.from('companies').select('fidelidade_mensagem, fidelidade_dia_mes').eq('id', session.company.id).single()
      .then(({ data }) => {
        if (data?.fidelidade_mensagem) setMensagem(data.fidelidade_mensagem)
        if (data?.fidelidade_dia_mes) setAgendarDiaMes(String(data.fidelidade_dia_mes))

        // Auto-disparo: verifica se hoje é o dia configurado e já passou das 08h fixas
        if (data?.fidelidade_dia_mes && data?.fidelidade_mensagem) {
          const now = new Date()
          const todayDay = now.getDate()
          const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          const storageKey = `fidelidade_auto_${instance}_${mesRef}`

          if (Number(data.fidelidade_dia_mes) === todayDay
              && currentHHmm >= FIDELIDADE_HORA_FIXA
              && !localStorage.getItem(storageKey)) {
            localStorage.setItem(storageKey, now.toISOString())
            setTimeout(() => dispararFidelidade(data.fidelidade_mensagem), 800)
          }
        }
      })

    supabase.from('fidelidade_envios').select('numero, sent_at, scheduled_for').eq('instancia', instance)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(r => { map[normPhoneKey(r.numero)] = { sent_at: r.sent_at, scheduled_for: r.scheduled_for } })
        setSentMap(map)
      })

    const ch = supabase.channel(`fidelidade-envios-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fidelidade_envios', filter: `instancia=eq.${instance}` },
        (p) => {
          const row = p.new || p.old
          if (!row?.numero) return
          setSentMap(prev => ({ ...prev, [normPhoneKey(row.numero)]: p.new ? { sent_at: p.new.sent_at, scheduled_for: p.new.scheduled_for } : null }))
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance, session?.company?.id])


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

    // Usa a view fidelidade_clientes_novos (agrega no banco) em vez de puxar
    // mensagens_geral direto — empresas com muita mensagem passavam do limite
    // de linhas buscadas e o primeiro contato real (mais antigo) ficava de fora.
    supabase.from('fidelidade_clientes_novos')
      .select('numero, nome, primeiro_contato, ultima_interacao, total_mensagens')
      .eq('instancia', instance)
      .then(({ data, error }) => {
        if (!error && data) {
          const unique = data.map(row => ({
            session_id: row.numero,
            phone: row.numero,
            norm: normPhoneKey(row.numero),
            pushname: row.nome || null,
            lastTs: row.ultima_interacao,
            msgCount: row.total_mensagens,
            firstSeenAt: row.primeiro_contato,
          }))
          unique.sort((a, b) => new Date(b.lastTs || 0) - new Date(a.lastTs || 0))
          setContacts(unique)
        } else if (error) {
          console.warn('fidelidade_clientes_novos (rode a migration 20260819_fidelidade_clientes_novos_view.sql):', error.message)
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

  // A tela só existe pra mostrar clientes novos — "novo" já é definido como
  // "primeiro contato no mês de calendário anterior" (isNewClient), sem filtro
  // extra de data em cima — senão quase ninguém bate as duas condições juntas.
  const filtered = useMemo(() => enriched.filter(c => {
    if (!c.novo) return false
    const s = search.toLowerCase()
    return !s || c.nome?.toLowerCase().includes(s) || c.phone.includes(search)
  }), [enriched, search])

  const periodLabel = prevMonthLabel()

  const DIAS_DO_MES = Array.from({ length: 31 }, (_, i) => i + 1)
  const agendarAtivo = agendarDiaMes !== ''

  // Salvar só grava a config (mensagem + dia do mês) na empresa — hora é fixa
  // (FIDELIDADE_HORA_FIXA) pra todo mundo, não é mais escolhida aqui.
  async function saveMensagem() {
    if (!mensagem.trim()) return
    setSaveStatus('sending')
    const diaMes = agendarAtivo ? Number(agendarDiaMes) : null
    const hora = agendarAtivo ? FIDELIDADE_HORA_FIXA : null
    const { error } = await supabase.from('companies')
      .update({ fidelidade_mensagem: mensagem, fidelidade_dia_mes: diaMes, fidelidade_hora: hora })
      .eq('id', session.company.id)
    if (error) {
      console.warn('companies.fidelidade_* (rode a migration 20260818h_fidelidade_recorrente.sql):', error.message)
      setSaveStatus('error')
    } else {
      setSaveStatus('sent')
    }
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  // ── Acesso restrito: tela só existe pra quem usa Evolution API ──────────────
  if (isOfficialApi) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '2rem', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Lock size={26} style={{ color: '#DC2626' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Acesso restrito</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.5 }}>
          A tela de Fidelidade não está disponível pra empresas com API Oficial.
        </p>
      </div>
    )
  }

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

      <div className="nx-card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mensagem enviada ao cliente novo
        </label>
        <textarea
          className="nx-input"
          rows={2}
          style={{ width: '100%', resize: 'vertical', fontSize: 13, fontFamily: 'inherit' }}
          placeholder='Ex: "Olá! Vimos que você é novo(a) por aqui, seja bem-vindo(a)..."'
          value={mensagem}
          onChange={e => setMensagem(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Repetir todo dia:
            </label>
            <select
              className="nx-select"
              style={{ fontSize: 12, padding: '5px 8px' }}
              value={agendarDiaMes}
              onChange={e => setAgendarDiaMes(e.target.value)}
            >
              <option value="">Dia do mês...</option>
              {DIAS_DO_MES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              às {FIDELIDADE_HORA_FIXA} (fixo)
            </span>
            {agendarDiaMes !== '' && (
              <button className="nx-btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }}
                onClick={() => setAgendarDiaMes('')}>
                Enviar sempre (sem repetição)
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!mensagem.trim() && (
              <span style={{ fontSize: 11, color: '#DC2626' }}>Configure uma mensagem pra poder salvar.</span>
            )}
            <button
              disabled={saveStatus === 'sending' || !mensagem.trim()}
              onClick={saveMensagem}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                ...(saveStatus === 'error'
                  ? { background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }
                  : saveStatus === 'sent'
                    ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }
                    : { background: '#DC2626', color: '#fff', border: 'none' }),
              }}
            >
              {saveStatus === 'sent' ? <Check size={13} /> : saveStatus === 'error' ? <AlertCircle size={13} /> : <Send size={13} />}
              {saveStatus === 'sending' ? 'Salvando...'
                : saveStatus === 'sent' ? 'Salvo ✓'
                : saveStatus === 'error' ? 'Erro, tentar de novo'
                : agendarAtivo ? `Salvar e repetir todo mês às ${FIDELIDADE_HORA_FIXA}` : 'Salvar e ativar envio'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          O horário do disparo automático é sempre {FIDELIDADE_HORA_FIXA}, igual pra todas as empresas — só o dia do mês é escolhido aqui. Deixe em branco pra ativar o envio contínuo (assim que salvar, sem repetição). Escolhendo um dia, vira recorrente: dispara todo mês nesse dia às {FIDELIDADE_HORA_FIXA}.
          {' '}O próprio sistema identifica os clientes novos (verificando as conversas) e envia pra eles — sem precisar clicar um por um.
        </div>
      </div>

      {/* Banner de status do disparo */}
      {dispararStatus !== 'idle' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 14,
          background: dispararStatus === 'concluido' ? '#F0FDF4' : dispararStatus === 'erro' ? '#FEF2F2' : '#EFF6FF',
          border: `1px solid ${dispararStatus === 'concluido' ? '#BBF7D0' : dispararStatus === 'erro' ? '#FECACA' : '#BFDBFE'}`,
        }}>
          {dispararStatus === 'disparando' && <><Zap size={15} style={{ color: '#2563EB', flexShrink: 0 }} /><span style={{ fontSize: 13, color: '#1D4ED8' }}>Disparando mensagens para clientes novos de {periodLabel}...</span></>}
          {dispararStatus === 'concluido' && <><Check size={15} style={{ color: '#16A34A', flexShrink: 0 }} /><span style={{ fontSize: 13, color: '#15803D' }}>Disparo concluído — {dispararInfo?.total || 0} cliente{dispararInfo?.total === 1 ? '' : 's'} notificado{dispararInfo?.total === 1 ? '' : 's'} em {periodLabel}.</span></>}
          {dispararStatus === 'erro' && <><AlertCircle size={15} style={{ color: '#DC2626', flexShrink: 0 }} /><span style={{ fontSize: 13, color: '#B91C1C' }}>Erro no disparo: {dispararInfo?.resposta}</span></>}
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }} onClick={() => setDispararStatus('idle')}>×</button>
        </div>
      )}

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

        <button
          className="nx-btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px', whiteSpace: 'nowrap', opacity: dispararStatus === 'disparando' ? 0.5 : 1 }}
          disabled={dispararStatus === 'disparando' || !mensagem.trim()}
          onClick={() => dispararFidelidade()}
          title={!mensagem.trim() ? 'Configure uma mensagem antes de disparar' : ''}
        >
          {dispararStatus === 'disparando' ? <Clock size={13} /> : <Zap size={13} />}
          {dispararStatus === 'disparando' ? 'Disparando...' : 'Disparar agora'}
        </button>

        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Cliente entra como novo se o primeiro contato caiu em {periodLabel.toLowerCase()} (mês passado).
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
              {filtered.map(c => {
                const entry = sentMap[c.norm]
                return (
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
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button className="table-action"
                        style={{ background: '#16A34A', color: '#fff', border: 'none' }}
                        onClick={() => navigate(`/painel/conversas?contact=${c.session_id}`)}>
                        <MessageSquare size={11} /> Conversar
                      </button>
                      <button className="table-action" onClick={() => navigate(`/painel/historico?contact=${c.session_id}`)}>
                        <History size={11} /> Histórico
                      </button>
                      {entry?.sent_at && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 20, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <Check size={10} /> Enviado {fmtWhen(entry.sent_at)}
                        </span>
                      )}
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
  )
}
