import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'
import { useContactTags, TAG_COLORS } from '../../hooks/useContactTags'
import {
  Users, Search, Pencil, Trash2, X, Plus, Phone, Copy, Check, MessageSquare,
  Mail, ShieldCheck, Sparkles, Tag,
} from 'lucide-react'
import './Company.css'

function fmtCpf(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function calcAge(d) {
  if (!d) return null
  const dt = new Date(`${d}T12:00:00`)
  if (isNaN(dt.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dt.getFullYear()
  const m = now.getMonth() - dt.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--
  return age
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

function TagChip({ tag, onRemove, onClick, small }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: small ? 3 : 4,
        padding: small ? '1px 6px' : '3px 8px',
        borderRadius: 20,
        background: tag.cor + '22',
        border: `1px solid ${tag.cor}55`,
        color: tag.cor,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        cursor: onClick || onRemove ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        lineHeight: '16px',
      }}
    >
      <span style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: '50%', background: tag.cor, flexShrink: 0 }} />
      {tag.nome}
      {onRemove && (
        <span
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{ marginLeft: 2, opacity: 0.7, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <X size={small ? 9 : 10} />
        </span>
      )}
    </span>
  )
}

export default function CompanyContacts() {
  const { session } = useAuth()
  const instance = session?.company?.instance
  const navigate = useNavigate()

  // Tags hook — no topo, antes de qualquer early return
  const { tags, tagsByContact, createTag, updateTag, deleteTag } = useContactTags(instance)

  const [patients, setPatients] = useState([])
  const [insurancePlans, setInsurancePlans] = useState([])
  const [chatPhones, setChatPhones] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState(null) // tag id | null
  const [newModal, setNewModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingNow, setDeletingNow] = useState(false)
  const [phoneFocus, setPhoneFocus] = useState(false)
  // Tag management modal
  const [tagModal, setTagModal] = useState(false)
  const [newTagNome, setNewTagNome] = useState('')
  const [newTagCor, setNewTagCor] = useState(TAG_COLORS[5])
  const [savingTag, setSavingTag] = useState(false)
  const [tagErr, setTagErr] = useState('')
  const [editingTag, setEditingTag] = useState(null) // { id, nome, cor }

  useEffect(() => {
    if (!instance) return
    setLoading(true)
    Promise.all([
      supabase.from('saved_contacts').select('*').eq('instancia', instance).order('nome', { ascending: true }),
      supabase.from('insurance_plans').select('id, name').eq('instancia', instance).eq('active', true).order('name'),
      supabase.from('mensagens_geral').select('numero').eq('instancia', instance).limit(5000),
    ]).then(([{ data: pat }, { data: plans }, { data: msgs }]) => {
      if (pat) setPatients(pat)
      if (plans) setInsurancePlans(plans)
      if (msgs) {
        const savedSet = new Set((pat || []).map(p => p.numero))
        const uniques = [...new Set(msgs.map(m =>
          m.numero?.replace(/@.*/, '').replace(/\D/g, '')
        ).filter(Boolean))]
        const unsaved = uniques.filter(n => !savedSet.has(n) && !uniques.includes(n + '@g.us'))
        setChatPhones(unsaved.slice(0, 200))
      }
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
    setNewModal({ nome: '', numero: '' })
    setErr('')
  }

  async function handleCreate() {
    if (!newModal.nome?.trim()) { setErr('Nome é obrigatório'); return }
    setSaving(true)
    const numero = newModal.numero?.toString().replace(/\D/g, '') || ''
    const payload = {
      numero,
      instancia: instance,
      nome: newModal.nome.trim(),
      created_by_email: session?.user?.email,
    }
    const { data, error } = await supabase.from('saved_contacts').insert(payload).select().single()
    setSaving(false)
    if (error) { setErr('Erro: ' + error.message); return }
    setNewModal(null)
    if (data?.id) navigate(`/painel/contatos/${data.id}`)
  }

  function handleDelete(patient) { setConfirmDelete(patient) }
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

  async function handleCreateTag() {
    if (!newTagNome.trim()) { setTagErr('Nome é obrigatório'); return }
    setSavingTag(true)
    setTagErr('')
    const { error } = await createTag(newTagNome, newTagCor)
    setSavingTag(false)
    if (error) { setTagErr(error.message.includes('unique') ? 'Já existe uma etiqueta com esse nome.' : 'Erro: ' + error.message); return }
    setNewTagNome('')
    setNewTagCor(TAG_COLORS[5])
  }

  async function handleUpdateTag() {
    if (!editingTag?.nome?.trim()) return
    setSavingTag(true)
    await updateTag(editingTag.id, editingTag.nome, editingTag.cor)
    setSavingTag(false)
    setEditingTag(null)
  }

  async function handleDeleteTag(id) {
    await deleteTag(id)
    if (tagFilter === id) setTagFilter(null)
  }

  const filtered = useMemo(() => patients.filter(c => {
    const s = search.toLowerCase()
    const matchSearch = (
      c.nome?.toLowerCase().includes(s) ||
      (c.numero || '').includes(search) ||
      (c.cpf || '').includes(search.replace(/\D/g, '')) ||
      (c.email || '').toLowerCase().includes(s)
    )
    if (!matchSearch) return false
    if (tagFilter) {
      const cTags = tagsByContact[c.id] || []
      return cTags.some(t => t.id === tagFilter)
    }
    return true
  }), [patients, search, tagFilter, tagsByContact])

  const phoneSuggestions = useMemo(() => {
    const q = (newModal?.numero || '').replace(/\D/g, '')
    if (!q || q.length < 3) return []
    return chatPhones.filter(p => p.includes(q)).slice(0, 6)
  }, [newModal?.numero, chatPhones])

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            Pacientes
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Carregando...' : `${patients.length} paciente${patients.length === 1 ? '' : 's'} cadastrado${patients.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nx-btn-ghost" onClick={() => { setTagModal(true); setTagErr(''); setNewTagNome(''); setNewTagCor(TAG_COLORS[5]); setEditingTag(null) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Tag size={14} /> Etiquetas
          </button>
          <button className="nx-btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Novo paciente
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="nx-card" style={{ padding: '12px 16px', marginBottom: tags.length ? 10 : 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <input
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)' }}
          placeholder="Buscar por nome, telefone, CPF ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Filtrar:</span>
          <button
            onClick={() => setTagFilter(null)}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              border: `1px solid ${tagFilter === null ? '#2563EB' : 'var(--border)'}`,
              background: tagFilter === null ? '#EFF6FF' : 'transparent',
              color: tagFilter === null ? '#2563EB' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Todos
          </button>
          {tags.map(t => (
            <span
              key={t.id}
              onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 20,
                background: tagFilter === t.id ? t.cor + '22' : 'transparent',
                border: `1px solid ${tagFilter === t.id ? t.cor : 'var(--border)'}`,
                color: tagFilter === t.id ? t.cor : 'var(--text-muted)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.cor }} />
              {t.nome}
            </span>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="nx-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Users size={28} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: 14 }}>
            {search || tagFilter ? 'Nenhum paciente encontrado com esse filtro.' : 'Nenhum paciente cadastrado. Cadastre o primeiro ou use o botão direito numa conversa para salvar rápido.'}
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
                const cTags = tagsByContact[c.id] || []
                return (
                  <tr key={c.id}>
                    <td className="td-name" onClick={() => navigate(`/painel/contatos/${c.id}`)} style={{ cursor: 'pointer' }}>
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
                          <div style={{ fontWeight: 600, color: '#2563EB' }}>{c.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                            {c.cpf && <span>CPF {fmtCpf(c.cpf)}</span>}
                            {age != null && <span>{age} anos</span>}
                          </div>
                          {cTags.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              {cTags.map(t => <TagChip key={t.id} tag={t} small />)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {c.numero && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
                          <Phone size={11} style={{ color: '#6B7280' }} />
                          {c.numero}
                          <button onClick={() => copyNumber(c.id, c.numero)}
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
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {c.numero && (
                          <button className="table-action"
                            style={{ background: '#16A34A', color: '#fff', border: 'none' }}
                            onClick={() => navigate(`/painel/conversas?contact=${c.numero}`)}>
                            <MessageSquare size={11} /> Conversar
                          </button>
                        )}
                        <button className="table-action" onClick={() => navigate(`/painel/contatos/${c.id}`)}>
                          <Pencil size={11} /> Abrir ficha
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

      {/* Modal: Gerenciar Etiquetas */}
      {tagModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 460 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={16} style={{ color: '#6B7280' }} /> Gerenciar Etiquetas
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => { setTagModal(false); setEditingTag(null) }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1rem 1.5rem', maxHeight: '50vh', overflowY: 'auto' }}>
              {tags.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '1.5rem 0' }}>
                  Nenhuma etiqueta criada ainda.
                </div>
              )}
              {tags.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                }}>
                  {editingTag?.id === t.id ? (
                    <>
                      <input
                        className="nx-input"
                        style={{ flex: 1, fontSize: 13, padding: '5px 10px' }}
                        value={editingTag.nome}
                        onChange={e => setEditingTag(p => ({ ...p, nome: e.target.value }))}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        {TAG_COLORS.map(c => (
                          <button key={c} onClick={() => setEditingTag(p => ({ ...p, cor: c }))}
                            style={{
                              width: 18, height: 18, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                              outline: editingTag.cor === c ? `2px solid ${c}` : 'none',
                              outlineOffset: 2,
                            }} />
                        ))}
                      </div>
                      <button className="nx-btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}
                        onClick={handleUpdateTag} disabled={savingTag}>
                        {savingTag ? '...' : 'Salvar'}
                      </button>
                      <button className="nx-btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}
                        onClick={() => setEditingTag(null)}>
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <TagChip tag={t} />
                      <span style={{ flex: 1 }} />
                      <button className="nx-btn-ghost" style={{ padding: '4px 8px' }}
                        onClick={() => setEditingTag({ id: t.id, nome: t.nome, cor: t.cor })}>
                        <Pencil size={12} />
                      </button>
                      <button className="nx-btn-ghost" style={{ padding: '4px 8px', color: '#DC2626' }}
                        onClick={() => handleDeleteTag(t.id)}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nova etiqueta
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="nx-input"
                  style={{ flex: 1, minWidth: 120, fontSize: 13 }}
                  placeholder="Ex: VIP, Urgente, Convênio..."
                  value={newTagNome}
                  onChange={e => setNewTagNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setNewTagCor(c)}
                      style={{
                        width: 20, height: 20, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                        outline: newTagCor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 2, flexShrink: 0,
                      }} />
                  ))}
                </div>
                <button className="nx-btn-primary" style={{ padding: '7px 14px', fontSize: 13 }}
                  onClick={handleCreateTag} disabled={savingTag || !newTagNome.trim()}>
                  <Plus size={13} /> {savingTag ? '...' : 'Criar'}
                </button>
              </div>
              {tagErr && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#DC2626', marginTop: 8 }}>
                  {tagErr}
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal: Novo paciente */}
      {newModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 460 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Novo paciente</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Cadastre o básico — depois você completa a ficha.</div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setNewModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input className="nx-input" autoFocus placeholder="Ex: Maria Silva Santos"
                  value={newModal.nome} onChange={e => setNewModal(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Telefone (WhatsApp)</label>
                <input className="nx-input" placeholder="Ex: 5561991234567"
                  value={newModal.numero}
                  onChange={e => setNewModal(p => ({ ...p, numero: e.target.value }))}
                  onFocus={() => setPhoneFocus(true)}
                  onBlur={() => setTimeout(() => setPhoneFocus(false), 180)}
                />
                {phoneFocus && phoneSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5,
                    background: 'white', border: '1px solid var(--border)',
                    borderRadius: 10, marginTop: 4, padding: 4,
                    boxShadow: '0 12px 28px -10px rgba(15,14,27,0.18)',
                    maxHeight: 220, overflowY: 'auto',
                  }}>
                    <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Sparkles size={10} /> Já conversou com a clínica
                    </div>
                    {phoneSuggestions.map(p => (
                      <button key={p}
                        onClick={() => setNewModal(prev => ({ ...prev, numero: p }))}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '7px 10px', borderRadius: 7,
                          background: 'transparent', border: 'none',
                          fontFamily: 'monospace', fontSize: 13, color: '#0F0E1B',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          fontWeight: 500,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F5F3FF'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Phone size={11} style={{ color: '#7C3AED' }} /> {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={12} style={{ color: '#7C3AED' }} />
                Comece a digitar o número — a gente sugere quem já conversou e ainda não foi cadastrado.
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setNewModal(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCreate} disabled={saving}>
                  {saving ? 'Criando...' : 'Continuar para ficha'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
