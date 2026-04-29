import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'
import {
  Users, Search, Pencil, Trash2, X, Plus, Phone, Copy, Check, MessageSquare,
  Mail, Calendar, MapPin, ShieldCheck, FileText, IdCard, User as UserIcon,
} from 'lucide-react'
import './Company.css'

function fmtCpf(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function fmtDateBR(d) {
  if (!d) return ''
  const dt = new Date(`${d}T12:00:00`)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('pt-BR')
}

function calcAge(d) {
  if (!d) return null
  const dt = new Date(`${d}T12:00:00`)
  if (isNaN(dt.getTime())) return null
  const diff = Date.now() - dt.getTime()
  return Math.floor(diff / (365.25 * 86400000))
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function CompanyContacts() {
  const { session } = useAuth()
  const instance = session?.company?.instance
  const navigate = useNavigate()

  const [patients, setPatients] = useState([])
  const [insurancePlans, setInsurancePlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingNow, setDeletingNow] = useState(false)

  useEffect(() => {
    if (!instance) return
    setLoading(true)
    Promise.all([
      supabase.from('saved_contacts').select('*').eq('instancia', instance).order('nome', { ascending: true }),
      supabase.from('insurance_plans').select('id, name').eq('instancia', instance).eq('active', true).order('name'),
    ]).then(([{ data: pat }, { data: plans }]) => {
      if (pat) setPatients(pat)
      if (plans) setInsurancePlans(plans)
      setLoading(false)
    })

    const ch = supabase.channel(`patients-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_contacts', filter: `instancia=eq.${instance}` },
        (p) => {
          if (p.eventType === 'DELETE') {
            setPatients(prev => prev.filter(c => c.id !== p.old.id))
          } else if (p.new) {
            setPatients(prev => {
              const exists = prev.find(c => c.id === p.new.id)
              if (exists) return prev.map(c => c.id === p.new.id ? p.new : c).sort((a, b) => a.nome.localeCompare(b.nome))
              return [...prev, p.new].sort((a, b) => a.nome.localeCompare(b.nome))
            })
          }
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  function openNew() {
    setEditing({
      nome: '', numero: '', cpf: '', birth_date: '', email: '',
      address: '', insurance_plan_id: null, insurance_card: '', notes: '',
    })
    setErr('')
  }

  function openEdit(p) {
    setEditing({ ...p })
    setErr('')
  }

  async function handleSave() {
    if (!editing.nome?.trim()) { setErr('Nome é obrigatório'); return }
    setSaving(true)
    const numero = editing.numero?.toString().replace(/\D/g, '') || ''
    const cpf    = editing.cpf?.toString().replace(/\D/g, '') || null
    const isNew = !editing.id
    const payload = {
      numero,
      instancia: instance,
      nome: editing.nome.trim(),
      cpf,
      birth_date: editing.birth_date || null,
      email: editing.email?.trim() || null,
      address: editing.address?.trim() || null,
      insurance_plan_id: editing.insurance_plan_id || null,
      insurance_card: editing.insurance_card?.trim() || null,
      notes: editing.notes?.trim() || null,
      created_by_email: session?.user?.email,
    }
    const { error } = isNew
      ? await supabase.from('saved_contacts').insert(payload)
      : await supabase.from('saved_contacts').update({
          nome: payload.nome, cpf: payload.cpf, birth_date: payload.birth_date,
          email: payload.email, address: payload.address,
          insurance_plan_id: payload.insurance_plan_id, insurance_card: payload.insurance_card,
          notes: payload.notes, numero: payload.numero,
        }).eq('id', editing.id)
    setSaving(false)
    if (error) { setErr('Erro: ' + error.message); return }
    setEditing(null)
  }

  function handleDelete(patient) {
    setConfirmDelete(patient)
  }
  async function confirmDeleteAction() {
    if (!confirmDelete) return
    setDeletingNow(true)
    await supabase.from('saved_contacts').delete().eq('id', confirmDelete.id)
    setDeletingNow(false)
    setConfirmDelete(null)
  }

  function copyNumber(id, num) {
    navigator.clipboard.writeText(num).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    })
  }

  const filtered = patients.filter(c => {
    const s = search.toLowerCase()
    return (
      c.nome?.toLowerCase().includes(s) ||
      (c.numero || '').includes(search) ||
      (c.cpf || '').includes(search.replace(/\D/g, '')) ||
      (c.email || '').toLowerCase().includes(s)
    )
  })

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            Pacientes
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Carregando...' : `${patients.length} paciente${patients.length === 1 ? '' : 's'} cadastrado${patients.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <button className="nx-btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Novo paciente
        </button>
      </div>

      <div className="nx-card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <input
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)' }}
          placeholder="Buscar por nome, telefone, CPF ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {!loading && filtered.length === 0 && (
        <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Users size={28} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: 14 }}>
            {search ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado. Cadastre o primeiro ou use o botão direito numa conversa para salvar rápido.'}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="nx-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Contato</th>
                <th>Convênio</th>
                <th>Notas</th>
                <th style={{ textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const plan = insurancePlans.find(p => p.id === c.insurance_plan_id)
                const age = calcAge(c.birth_date)
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/painel/contatos/${c.id}`)}>
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
                          <div style={{ fontWeight: 600 }}>{c.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                            {c.cpf && <span>CPF {fmtCpf(c.cpf)}</span>}
                            {age != null && <span>{age} anos</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {c.numero && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
                          <Phone size={11} style={{ color: '#6B7280' }} />
                          {c.numero}
                          <button onClick={(e) => { e.stopPropagation(); copyNumber(c.id, c.numero) }}
                            title="Copiar número"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              background: copiedId === c.id ? '#F0FDF4' : 'transparent',
                              border: `1px solid ${copiedId === c.id ? '#BBF7D0' : 'var(--border)'}`,
                              color: copiedId === c.id ? '#16A34A' : '#6B7280',
                              borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            }}>
                            {copiedId === c.id ? <Check size={9} /> : <Copy size={9} />}
                          </button>
                        </div>
                      )}
                      {c.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', marginTop: 3, fontSize: 11 }}>
                          <Mail size={10} /> {c.email}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {plan ? (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                            <ShieldCheck size={10} /> {plan.name}
                          </span>
                          {c.insurance_card && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                              {c.insurance_card}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Particular</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {c.numero && (
                          <button className="table-action"
                            style={{ background: '#16A34A', color: '#fff', border: 'none' }}
                            onClick={() => navigate(`/painel/conversas?contact=${c.numero}`)}>
                            <MessageSquare size={11} /> Conversar
                          </button>
                        )}
                        <button className="table-action" onClick={() => navigate(`/painel/contatos/${c.id}`)}>
                          <Pencil size={11} /> Abrir
                        </button>
                        <button className="table-action danger" onClick={() => handleDelete(c)}>
                          <Trash2 size={11} /> Excluir
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

      <ConfirmModal
        open={!!confirmDelete}
        variant="delete"
        title="Excluir paciente"
        message={`Tem certeza que deseja excluir o paciente "${confirmDelete?.nome || ''}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir paciente"
        loading={deletingNow}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />

      {editing && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{editing.id ? 'Editar paciente' : 'Novo paciente'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Cadastro completo do paciente
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setEditing(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Bloco — Identificação */}
              <Section title="Identificação" icon={UserIcon}>
                <div>
                  <label style={labelStyle}>Nome completo</label>
                  <input className="nx-input" autoFocus placeholder="Ex: Maria Silva Santos"
                    value={editing.nome} onChange={e => setEditing(p => ({ ...p, nome: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>CPF</label>
                    <input className="nx-input" placeholder="000.000.000-00"
                      value={fmtCpf(editing.cpf || '')}
                      onChange={e => setEditing(p => ({ ...p, cpf: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Data de nascimento</label>
                    <input className="nx-input" type="date"
                      value={editing.birth_date || ''}
                      onChange={e => setEditing(p => ({ ...p, birth_date: e.target.value }))} />
                  </div>
                </div>
              </Section>

              {/* Bloco — Contato */}
              <Section title="Contato" icon={Phone}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Telefone (WhatsApp)</label>
                    <input className="nx-input" placeholder="Ex: 5561991234567"
                      value={editing.numero || ''}
                      onChange={e => setEditing(p => ({ ...p, numero: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>E-mail</label>
                    <input className="nx-input" type="email" placeholder="paciente@email.com"
                      value={editing.email || ''}
                      onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Endereço</label>
                  <input className="nx-input" placeholder="Rua, número, bairro, cidade"
                    value={editing.address || ''}
                    onChange={e => setEditing(p => ({ ...p, address: e.target.value }))} />
                </div>
              </Section>

              {/* Bloco — Convênio */}
              <Section title="Convênio" icon={ShieldCheck}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Plano</label>
                    <select className="nx-select" value={editing.insurance_plan_id || ''}
                      onChange={e => setEditing(p => ({ ...p, insurance_plan_id: e.target.value || null }))}>
                      <option value="">Particular</option>
                      {insurancePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Carteirinha</label>
                    <input className="nx-input" placeholder="Número"
                      value={editing.insurance_card || ''}
                      onChange={e => setEditing(p => ({ ...p, insurance_card: e.target.value }))} />
                  </div>
                </div>
                {insurancePlans.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Cadastre convênios em <strong>Catálogo Clínico → Convênios</strong> para escolher aqui.
                  </div>
                )}
              </Section>

              {/* Bloco — Notas */}
              <Section title="Notas internas" icon={FileText}>
                <textarea className="nx-input" rows={3}
                  placeholder="Anotações privadas (alergias, preferências, observações clínicas...)"
                  value={editing.notes || ''}
                  onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
              </Section>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar paciente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-muted)',
        paddingBottom: 6, borderBottom: '1px solid var(--border)',
      }}>
        <Icon size={12} /> {title}
      </div>
      {children}
    </div>
  )
}
