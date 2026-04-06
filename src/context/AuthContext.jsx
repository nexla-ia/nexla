import React, { createContext, useContext, useState } from 'react'

// ─── Mock database ────────────────────────────────────────────────────────────
export const mockDB = {
  companies: [
    {
      id: 'comp-1',
      name: 'Clínica Saúde Total',
      slug: 'saude-total',
      plan: 'Pro',
      active: true,
      createdAt: '2024-10-15',
      users: [
        { id: 'u1', name: 'Dr. Marcos Lima',    email: 'marcos@saudetotal.com', password: '123456', role: 'admin',  active: true },
        { id: 'u2', name: 'Ana Fernanda',        email: 'ana@saudetotal.com',    password: '123456', role: 'viewer', active: true },
      ],
    },
    {
      id: 'comp-2',
      name: 'Imobiliária Novolar',
      slug: 'novolar',
      plan: 'Business',
      active: true,
      createdAt: '2024-11-02',
      users: [
        { id: 'u3', name: 'Carla Mendes',  email: 'carla@novolar.com.br', password: '123456', role: 'admin',  active: true },
        { id: 'u4', name: 'Rafael Torres', email: 'rafael@novolar.com.br', password: '123456', role: 'viewer', active: false },
      ],
    },
    {
      id: 'comp-3',
      name: 'Pet Shop Amigo Fiel',
      slug: 'amigo-fiel',
      plan: 'Starter',
      active: true,
      createdAt: '2025-01-20',
      users: [
        { id: 'u5', name: 'Juliana Costa', email: 'ju@amigofiel.com', password: '123456', role: 'admin', active: true },
      ],
    },
  ],
}

// ─── Mock contacts per company ────────────────────────────────────────────────
export const mockContacts = {
  'comp-1': [
    { id: 'c1', name: 'Roberto Alves',    phone: '+55 11 91234-5678', status: 'attended',  lastMsg: 'Quero agendar uma consulta para amanhã.', time: '14:32', unread: 0 },
    { id: 'c2', name: 'Patrícia Souza',   phone: '+55 11 99876-5432', status: 'waiting',   lastMsg: 'Olá, vocês têm horário na sexta?',          time: '13:10', unread: 2 },
    { id: 'c3', name: 'Fernando Rocha',   phone: '+55 21 98765-4321', status: 'help',      lastMsg: 'Não consigo entender o que a IA disse...',  time: '12:55', unread: 1 },
    { id: 'c4', name: 'Camila Nunes',     phone: '+55 11 94567-8901', status: 'scheduled', lastMsg: 'Confirmado! Às 15h de quinta.',              time: '11:30', unread: 0 },
    { id: 'c5', name: 'Tiago Moreira',    phone: '+55 31 93456-7890', status: 'attended',  lastMsg: 'Ok, obrigado pelo atendimento.',             time: '10:05', unread: 0 },
  ],
  'comp-2': [
    { id: 'c6', name: 'Bruna Cavalcanti', phone: '+55 81 97654-3210', status: 'waiting',   lastMsg: 'Gostaria de ver o apartamento no centro.',  time: '15:00', unread: 3 },
    { id: 'c7', name: 'Henrique Leal',    phone: '+55 11 96543-2109', status: 'help',      lastMsg: 'A IA não sabe responder sobre o contrato.', time: '14:20', unread: 1 },
    { id: 'c8', name: 'Monique Farias',   phone: '+55 85 95432-1098', status: 'scheduled', lastMsg: 'Visita marcada para sábado às 10h.',         time: '09:45', unread: 0 },
  ],
  'comp-3': [
    { id: 'c9',  name: 'Lucas Pimentel',  phone: '+55 11 94321-0987', status: 'waiting',   lastMsg: 'Quanto custa banho e tosa poodle médio?',   time: '16:10', unread: 1 },
    { id: 'c10', name: 'Vanessa Lima',    phone: '+55 11 93210-9876', status: 'attended',  lastMsg: 'Perfeito! Até amanhã então.',                time: '13:25', unread: 0 },
  ],
}

// ─── Mock conversation history ────────────────────────────────────────────────
export const mockConversations = {
  c1: [
    { id: 1, from: 'client', text: 'Boa tarde! Gostaria de agendar uma consulta.',        time: '14:20' },
    { id: 2, from: 'ai',     text: 'Olá! Sou a assistente da Clínica Saúde Total. Posso te ajudar com o agendamento. Qual especialidade você precisa?', time: '14:20' },
    { id: 3, from: 'client', text: 'Clínica geral, por favor.',                           time: '14:25' },
    { id: 4, from: 'ai',     text: 'Perfeito! Temos horários disponíveis na terça (manhã e tarde) e quinta (tarde). Qual preferir?', time: '14:25' },
    { id: 5, from: 'client', text: 'Terça de manhã seria ótimo.',                         time: '14:28' },
    { id: 6, from: 'ai',     text: 'Ótimo! Tenho disponível às 9h, 10h e 11h. Qual horário prefere?', time: '14:28' },
    { id: 7, from: 'client', text: 'Às 10h perfeito.',                                    time: '14:30' },
    { id: 8, from: 'ai',     text: '✅ Agendamento confirmado! Terça-feira às 10h com Dr. Marcos. Vou te enviar o endereço e instruções. Até lá!', time: '14:32', type: 'scheduled' },
  ],
  c2: [
    { id: 1, from: 'client', text: 'Olá, vocês têm horário disponível na sexta-feira?',  time: '13:05' },
    { id: 2, from: 'ai',     text: 'Olá! Sexta-feira temos alguns horários. Para qual especialidade você precisa?', time: '13:06' },
    { id: 3, from: 'client', text: 'Dermatologista.',                                     time: '13:10' },
    { id: 4, from: 'ai',     text: 'Verificando disponibilidade para dermatologia na sexta...', time: '13:10', pending: true },
  ],
  c3: [
    { id: 1, from: 'client', text: 'Oi, quero saber sobre exames de sangue.',            time: '12:40' },
    { id: 2, from: 'ai',     text: 'Claro! Realizamos diversos exames laboratoriais. Quer agendar ou tem alguma dúvida específica?', time: '12:41' },
    { id: 3, from: 'client', text: 'Preciso saber se o plano de saúde cobre.',           time: '12:50' },
    { id: 4, from: 'ai',     text: '🆘 Preciso de ajuda para responder sobre cobertura de plano de saúde. Aguardando atendente humano.', time: '12:55', type: 'help' },
  ],
}

// ─── Mock alerts (AI help requests) ──────────────────────────────────────────
export const mockAlerts = {
  'comp-1': [
    { id: 'a1', contactName: 'Fernando Rocha',   phone: '+55 21 98765-4321', type: 'help',      message: 'Cliente perguntou sobre cobertura de plano de saúde. IA não conseguiu responder adequadamente.', time: '12:55', resolved: false },
    { id: 'a2', contactName: 'Patrícia Souza',   phone: '+55 11 99876-5432', type: 'schedule',  message: 'Cliente quer agendar para sexta, mas sistema não tem disponibilidade. Verificar agenda manual.', time: '13:10', resolved: false },
    { id: 'a3', contactName: 'Camila Nunes',     phone: '+55 11 94567-8901', type: 'schedule',  message: 'Agendamento confirmado: quinta-feira às 15h. Contato notificado com sucesso.', time: '11:30', resolved: true },
  ],
  'comp-2': [
    { id: 'a4', contactName: 'Henrique Leal',    phone: '+55 11 96543-2109', type: 'help',      message: 'Dúvida sobre cláusulas contratuais. IA redirecionou para atendimento humano.', time: '14:20', resolved: false },
    { id: 'a5', contactName: 'Monique Farias',   phone: '+55 85 95432-1098', type: 'schedule',  message: 'Visita agendada: sábado 10h. Corretor Rafael designado.', time: '09:45', resolved: true },
  ],
  'comp-3': [
    { id: 'a6', contactName: 'Lucas Pimentel',   phone: '+55 11 94321-0987', type: 'schedule',  message: 'Cliente aguarda confirmação de preço para banho e tosa. Aguardando tabela atualizada.', time: '16:10', resolved: false },
  ],
}

// ─── Auth context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null) // { role: 'adm' | 'company', user, company }
  const [db, setDb] = useState(mockDB)

  function login(email, password, mode) {
    if (mode === 'adm') {
      if (email === 'admin@nexla.ai' && password === 'nexla123') {
        setSession({ role: 'adm', user: { name: 'Administrador NEXLA', email } })
        return { ok: true }
      }
      return { ok: false, error: 'Credenciais ADM inválidas.' }
    }

    // company mode
    for (const company of db.companies) {
      for (const user of company.users) {
        if (user.email === email && user.password === password && user.active) {
          setSession({ role: 'company', user, company })
          return { ok: true }
        }
      }
    }
    return { ok: false, error: 'E-mail ou senha incorretos.' }
  }

  function logout() { setSession(null) }

  function addCompany(data) {
    const newComp = {
      id: 'comp-' + Date.now(),
      name: data.name,
      slug: data.name.toLowerCase().replace(/\s+/g, '-'),
      plan: data.plan || 'Starter',
      active: true,
      createdAt: new Date().toISOString().split('T')[0],
      users: [],
    }
    setDb(prev => ({ ...prev, companies: [...prev.companies, newComp] }))
    return newComp
  }

  function addUser(companyId, userData) {
    setDb(prev => ({
      ...prev,
      companies: prev.companies.map(c =>
        c.id === companyId
          ? { ...c, users: [...c.users, { id: 'u-' + Date.now(), ...userData, active: true }] }
          : c
      ),
    }))
  }

  function toggleUserActive(companyId, userId) {
    setDb(prev => ({
      ...prev,
      companies: prev.companies.map(c =>
        c.id === companyId
          ? { ...c, users: c.users.map(u => u.id === userId ? { ...u, active: !u.active } : u) }
          : c
      ),
    }))
  }

  function toggleCompanyActive(companyId) {
    setDb(prev => ({
      ...prev,
      companies: prev.companies.map(c =>
        c.id === companyId ? { ...c, active: !c.active } : c
      ),
    }))
  }

  return (
    <AuthContext.Provider value={{ session, db, login, logout, addCompany, addUser, toggleUserActive, toggleCompanyActive }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
