import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, X, UserMinus, RefreshCw, UserCheck, UserX } from 'lucide-react'
import './Company.css'

const SECTOR_COLORS = ['#2563EB', '#16A34A', '#7C3AED', '#DC2626', '#D97706', '#0891B2']

function slugify(name) {
  return (name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}
function generatePassword(base) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return slugify(base).slice(0, 5) + '@' + suffix
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function CompanyAdmin() {
  const { session } = useAuth()
  const instance  = session?.company?.instance
  const companyId = session?.company?.id
  const maxUsers  = session?.company?.max_users ?? 5

  const [users, setUsers]               = useState([])
  const [sectors, setSectors]           = useState([])
  const [sectorMembers, setSectorMembers] = useState([])
  const [saving, setSaving]             = useState(false)

  const [sectorModal, setSectorModal]   = useState(false)
  const [sectorForm, setSectorForm]     = useState({ name: '', color: SECTOR_COLORS[0] })
  const [sectorErr, setSectorErr]       = useState('')
  const [assignModal, setAssignModal]   = useState(null)

  const [userModal, setUserModal]       = useState(false)
  const [userForm, setUserForm]         = useState({ name: '', email: '', password: '', role: 'viewer' })
  const [userErr, setUserErr]           = useState('')

  useEffect(() => {
    if (!companyId) return
    supabase.from('users').select('*').eq('company_id', companyId).order('name')
      .then(({ data }) => { if (data) setUsers(data) })
  }, [companyId])

  useEffect(() => {
    if (!instance) return
    supabase.from('sectors').select('*').eq('instancia', instance).order('created_at')
      .then(({ data }) => { if (data) setSectors(data) })
  }, [instance])

  useEffect(() => {
    if (!sectors.length) { setSectorMembers([]); return }
    supabase.from('sector_members').select('*').in('sector_id', sectors.map(s => s.id))
      .then(({ data }) => { if (data) setSectorMembers(data) })
  }, [sectors])

  async function handleCreateSector() {
    if (!sectorForm.name.trim()) { setSectorErr('Nome é obrigatório.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('sectors').insert({
      name: sectorForm.name.trim(), instancia: instance, color: sectorForm.color,
    }).select().single()
    setSaving(false)
    if (error) { setSectorErr('Erro: ' + error.message); return }
    setSectors(prev => [...prev, data])
    setSectorModal(false)
    setSectorForm({ name: '', color: SECTOR_COLORS[0] })
    setSectorErr('')
  }

  async function handleDeleteSector(sectorId) {
    await supabase.from('sectors').delete().eq('id', sectorId)
    setSectors(prev => prev.filter(s => s.id !== sectorId))
    setSectorMembers(prev => prev.filter(m => m.sector_id !== sectorId))
  }

  async function handleAssignUser(userId) {
    if (!assignModal) return
    await supabase.from('sector_members').delete().eq('user_id', userId)
    const { data } = await supabase.from('sector_members')
      .insert({ sector_id: assignModal.id, user_id: userId }).select().single()
    if (data) setSectorMembers(prev => [...prev.filter(m => m.user_id !== userId), data])
  }

  async function handleRemoveMember(userId) {
    await supabase.from('sector_members').delete().eq('user_id', userId)
    setSectorMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  async function handleToggleUser(userId, active) {
    await supabase.from('users').update({ active: !active }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !active } : u))
  }

  async function handleCreateUser() {
    if (!userForm.name || !userForm.email || !userForm.password) {
      setUserErr('Preencha todos os campos.'); return
    }
    const activeCount = users.filter(u => u.active !== false).length
    if (activeCount >= maxUsers) {
      setUserErr(`Limite de ${maxUsers} usuários atingido. Contate o administrador para aumentar o limite.`); return
    }
    setSaving(true)
    const { error } = await supabase.rpc('create_user', {
      p_name: userForm.name,
      p_email: userForm.email,
      p_password: userForm.password,
      p_role: userForm.role,
      p_company_id: companyId,
    })
    setSaving(false)
    if (error) { setUserErr(error.message); return }
    const { data } = await supabase.from('users').select('*').eq('company_id', companyId).order('name')
    if (data) setUsers(data)
    setUserModal(false)
    setUserErr('')
  }

  const domain = slugify(session?.company?.name || 'empresa') + '.com'
  const activeUsers = users.filter(u => u.active !== false)

  return (
    <div className="page-enter">
      {/* Setores */}
      <div className="page-body">
        <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-title">Setores / Departamentos</div>
          {instance && (
            <button className="nx-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => { setSectorForm({ name: '', color: SECTOR_COLORS[0] }); setSectorErr(''); setSectorModal(true) }}>
              <Plus size={13} /> Novo setor
            </button>
          )}
        </div>

        {!instance ? (
          <div className="nx-card" style={{ padding: '1.5rem', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            Instância WhatsApp não configurada. Contate o administrador.
          </div>
        ) : !sectors.length ? (
          <div className="nx-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhum setor criado ainda. Crie setores e atribua funcionários.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {sectors.map(sector => {
              const memberUsers = sectorMembers
                .filter(m => m.sector_id === sector.id)
                .map(m => users.find(u => u.id === m.user_id))
                .filter(Boolean)
              return (
                <div key={sector.id} className="nx-card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: sector.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{sector.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="table-action" onClick={() => setAssignModal(sector)}>
                        <Plus size={11} /> Atribuir
                      </button>
                      <button className="table-action danger" onClick={() => handleDeleteSector(sector.id)}>
                        <X size={11} /> Excluir
                      </button>
                    </div>
                  </div>
                  {!memberUsers.length ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum funcionário atribuído.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {memberUsers.map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', borderRadius: 6, padding: '5px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: sector.color + '22', border: `1px solid ${sector.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: sector.color }}>
                              {u.name.charAt(0)}
                            </div>
                            {u.name}
                          </div>
                          <button className="table-action danger" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => handleRemoveMember(u.id)}>
                            <UserMinus size={9} /> Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Usuários */}
      <div className="page-body" style={{ marginTop: 0 }}>
        <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="section-title">Usuários ({activeUsers.length} / {maxUsers})</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Limite configurado pelo administrador: <strong>{maxUsers}</strong> usuários ativos
            </div>
          </div>
          <button
            className="nx-btn-primary"
            style={{ fontSize: 12, padding: '6px 14px', opacity: activeUsers.length >= maxUsers ? 0.5 : 1 }}
            disabled={activeUsers.length >= maxUsers}
            onClick={() => { setUserForm({ name: '', email: '', password: '', role: 'viewer' }); setUserErr(''); setUserModal(true) }}
          >
            <Plus size={13} /> Novo usuário
          </button>
        </div>

        <div className="nx-card">
          {!users.length ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum usuário.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Setor</th><th>Status</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const memberSectorId = sectorMembers.find(m => m.user_id === u.id)?.sector_id
                  const userSector = sectors.find(s => s.id === memberSectorId)
                  return (
                    <tr key={u.id}>
                      <td className="td-name">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#2563EB' }}>
                            {u.name.charAt(0)}
                          </div>
                          {u.name}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</td>
                      <td>
                        <span className={`nx-badge ${u.role === 'admin' ? 'nx-badge-cyan' : 'nx-badge-gray'}`}>
                          {u.role === 'admin' ? 'Admin' : 'Operador'}
                        </span>
                      </td>
                      <td>
                        {userSector ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#fff', background: userSector.color }}>
                            {userSector.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`nx-badge ${u.active !== false ? 'nx-badge-green' : 'nx-badge-red'}`}>
                          {u.active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <button className={`table-action ${u.active !== false ? 'danger' : ''}`}
                          onClick={() => handleToggleUser(u.id, u.active !== false)}>
                          {u.active !== false ? <><UserX size={12} /> Desativar</> : <><UserCheck size={12} /> Ativar</>}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal criar setor */}
      {sectorModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Novo setor</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSectorModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input className="nx-input" placeholder="Ex: Comercial, Suporte..." autoFocus
                  value={sectorForm.name} onChange={e => setSectorForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Cor identificadora</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {SECTOR_COLORS.map(c => (
                    <button key={c} onClick={() => setSectorForm(p => ({ ...p, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: sectorForm.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {sectorErr && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 10 }}>{sectorErr}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setSectorModal(false)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCreateSector} disabled={saving}>
                  {saving ? 'Criando...' : 'Criar setor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal atribuir usuário ao setor */}
      {assignModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Atribuir ao setor</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: assignModal.color }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{assignModal.name}</span>
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setAssignModal(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {users.filter(u => u.role !== 'admin').map(u => {
                const inThisSector = sectorMembers.find(m => m.user_id === u.id)?.sector_id === assignModal.id
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, background: inThisSector ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${inThisSector ? '#BBF7D0' : 'var(--border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#2563EB' }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                    {inThisSector ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>✓ Atribuído</span>
                    ) : (
                      <button className="nx-btn-primary" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => handleAssignUser(u.id)}>
                        Atribuir
                      </button>
                    )}
                  </div>
                )
              })}
              {users.filter(u => u.role !== 'admin').length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  Nenhum operador disponível.
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button className="nx-btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setAssignModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal criar usuário */}
      {userModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 440 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Novo usuário</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {activeUsers.length} / {maxUsers} usuários ativos
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setUserModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input className="nx-input" placeholder="Nome completo" autoFocus
                  value={userForm.name}
                  onChange={e => {
                    const name = e.target.value
                    const email = name ? `${slugify(name)}@${domain}` : ''
                    setUserForm(p => ({ ...p, name, email }))
                  }} />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input className="nx-input" type="email" value={userForm.email}
                  onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Senha</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="nx-input" value={userForm.password}
                    onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" className="nx-btn-ghost" style={{ flexShrink: 0, padding: '0 12px' }}
                    onClick={() => setUserForm(p => ({ ...p, password: generatePassword(p.name || 'user') }))}>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Perfil de acesso</label>
                <select className="nx-select" value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="viewer">Operador — acesso ao painel de conversas</option>
                  <option value="admin">Admin — acesso completo + configurações</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {userErr && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 10 }}>{userErr}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setUserModal(false)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCreateUser} disabled={saving}>
                  {saving ? 'Criando...' : 'Criar acesso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
