# MedicinaMKT — API de Integração

> API JSON pura — **todas as operações são `POST` com body JSON**. Nenhum parâmetro fica exposto na URL.
>
> Implementada via **Supabase RPC** (Postgres functions). Pra ativar, rodar `supabase/migrations/20260430_api_rpc.sql` uma vez no SQL Editor.
>
> **Não inclui endpoints administrativos** (super ADM, empresas, billing).

---

## Sumário

1. [Setup](#1-setup)
2. [Convenção](#2-convenção)
3. [Pacientes](#3-pacientes)
4. [Mensagens](#4-mensagens)
5. [Conversas / Tickets](#5-conversas--tickets)
6. [Catálogo Clínico](#6-catálogo-clínico)
7. [Agenda](#7-agenda)
8. [Alertas](#8-alertas)
9. [Atividades / Kanban](#9-atividades--kanban)
10. [Fidelidade](#10-fidelidade)
11. [Receitas comuns para IA](#11-receitas-comuns-para-ia)

---

## 1. Setup

**Base URL:**
```
https://pllvpbzskmargpdpvumg.supabase.co/rest/v1/rpc
```

**Headers obrigatórios em TODA requisição:**
```http
apikey: {{anon_key}}
Authorization: Bearer {{anon_key}}
Content-Type: application/json
```

**Variáveis:**

| Variável     | Exemplo            |
|--------------|--------------------|
| `base_url`   | `https://pllvpbzskmargpdpvumg.supabase.co` |
| `anon_key`   | `eyJhbGci...`      |
| `instancia`  | `clinicaolhos`     |

---

## 2. Convenção

Todas as operações são chamadas como:

```http
POST {{base_url}}/rest/v1/rpc/{nome_da_funcao}
Content-Type: application/json

{
  "p_param1": "valor",
  "p_param2": 123
}
```

- Os parâmetros são prefixados com `p_` (convenção PostgREST).
- Funções de criar/atualizar registro recebem `{ "p_data": { ... } }` com o objeto completo.
- Listagens retornam **array**, lookups por ID/telefone retornam **array de 1 elemento ou vazio**.
- Operações que retornam o registro completo usam `RETURNS record`/tabela.

> **Importante:** todas as funções são `SECURITY DEFINER` e bypassam RLS. O controle de acesso é por `instancia` — sempre passe esse parâmetro filtrando pela empresa correta.

---

## 3. Pacientes

### `api_pacientes_list` — listar pacientes

```json
POST /rpc/api_pacientes_list
{
  "p_instancia": "clinicaolhos",
  "p_search": null,        // ou "maria" pra buscar por nome/numero/cpf
  "p_limit": 100,
  "p_offset": 0
}
```

### `api_paciente_by_phone` — buscar por número

```json
POST /rpc/api_paciente_by_phone
{
  "p_instancia": "clinicaolhos",
  "p_numero": "5511987654321@s.whatsapp.net"
}
```

### `api_paciente_create`

```json
POST /rpc/api_paciente_create
{
  "p_data": {
    "instancia": "clinicaolhos",
    "nome": "Maria Silva",
    "numero": "5511987654321@s.whatsapp.net",
    "birth_date": "1985-03-15",
    "gender": "feminino",
    "email": "maria@email.com",
    "insurance_plan_id": null,
    "insurance_card": null,
    "allergies": "Penicilina",
    "referral_source": "Instagram"
  }
}
```

Campos opcionais aceitos no `p_data`: `phone_secondary`, `address`, `cpf`, `rg`, `profession`, `nome_social`, `marital_status`, `blood_type`, `weight`, `height`, `guardian_name`, `guardian_phone`, `chronic_conditions`, `medications`, `clinical_notes`, `photo` (base64), `emergency_contact`, `emergency_phone`, `notes`.

### `api_paciente_update`

```json
POST /rpc/api_paciente_update
{
  "p_id": "uuid-do-paciente",
  "p_data": {
    "allergies": "Penicilina, dipirona",
    "chronic_conditions": "Hipertensão"
  }
}
```

> Só campos que vierem no `p_data` são atualizados (COALESCE).

### `api_paciente_delete`

```json
POST /rpc/api_paciente_delete
{ "p_id": "uuid-do-paciente" }
```

---

## 4. Mensagens

### `api_messages_by_phone` — últimas N do paciente

```json
POST /rpc/api_messages_by_phone
{
  "p_instancia": "clinicaolhos",
  "p_numero": "5511987654321@s.whatsapp.net",
  "p_limit": 20,
  "p_only_client": false
}
```

> `p_only_client: true` retorna só `type = 'cliente'` — útil pra inferir origem/contexto.

### `api_message_create` — registrar resposta da IA

```json
POST /rpc/api_message_create
{
  "p_data": {
    "instancia": "clinicaolhos",
    "numero": "5511987654321@s.whatsapp.net",
    "mensagem": "Olá Maria! Posso te ajudar a agendar a consulta.",
    "type": "ia"
  }
}
```

> O envio efetivo via WhatsApp é feito pelo Evolution API separadamente. Esta função registra o histórico.

---

## 5. Conversas / Tickets

### `api_conversation_close` — encerrar com motivo

```json
POST /rpc/api_conversation_close
{
  "p_session_id": "5511987654321@s.whatsapp.net",
  "p_instancia": "clinicaolhos",
  "p_reason": "agendado"
}
```

`p_reason`: `agendado` / `resolvido` / `encaminhado` / `desistiu` / `auto_encerrado`

> A função também limpa `attendances` automaticamente.

### `api_conversation_status` — está aberta?

```json
POST /rpc/api_conversation_status
{
  "p_session_id": "5511987654321@s.whatsapp.net",
  "p_instancia": "clinicaolhos"
}
```

Retorno:
```json
{
  "is_open": true,
  "last_close": null
}
```

---

## 6. Catálogo Clínico

### `api_professionals_list`

```json
POST /rpc/api_professionals_list
{ "p_instancia": "clinicaolhos", "p_only_active": true }
```

### `api_procedures_list`

```json
POST /rpc/api_procedures_list
{ "p_instancia": "clinicaolhos", "p_only_active": true }
```

### `api_insurance_plans_list`

```json
POST /rpc/api_insurance_plans_list
{ "p_instancia": "clinicaolhos", "p_only_active": true }
```

### `api_procedure_price` — preço por convênio

```json
POST /rpc/api_procedure_price
{
  "p_procedure_id": "uuid-do-procedimento",
  "p_insurance_plan_id": "uuid-do-convenio"
}
```

Retorno:
```json
{ "price": 180.00, "is_default": false }
```

> Se não houver preço cadastrado pra essa combinação, usa `default_price` do procedimento e marca `is_default: true`.

---

## 7. Agenda

### `api_agendas_list`

```json
POST /rpc/api_agendas_list
{ "p_instancia": "clinicaolhos" }
```

### `api_appointments_by_date`

```json
POST /rpc/api_appointments_by_date
{ "p_instancia": "clinicaolhos", "p_date": "2026-04-30" }
```

### `api_appointments_by_phone`

```json
POST /rpc/api_appointments_by_phone
{
  "p_instancia": "clinicaolhos",
  "p_phone": "5511987654321@s.whatsapp.net",
  "p_limit": 10
}
```

### `api_appointments_busy_slots` — slots ocupados pra calcular livres

```json
POST /rpc/api_appointments_busy_slots
{
  "p_instancia": "clinicaolhos",
  "p_professional_id": "uuid-do-profissional",
  "p_from": "2026-04-29T00:00:00Z",
  "p_to":   "2026-05-06T00:00:00Z"
}
```

### `api_appointment_create`

```json
POST /rpc/api_appointment_create
{
  "p_data": {
    "instancia": "clinicaolhos",
    "agenda_id": "uuid",
    "professional_id": "uuid",
    "procedure_id": "uuid",
    "insurance_plan_id": null,
    "contact_nome": "Maria Silva",
    "contact_numero": "5511987654321@s.whatsapp.net",
    "starts_at": "2026-05-02T14:00:00Z",
    "duration_minutes": 30,
    "status": "agendado",
    "payment_status": "pendente",
    "price": 180.00,
    "notes": "Primeira consulta"
  }
}
```

### `api_appointment_update_status`

```json
POST /rpc/api_appointment_update_status
{
  "p_id": "uuid-do-agendamento",
  "p_status": "concluido",
  "p_payment_status": "pago"
}
```

> `p_payment_status` é opcional. `p_status`: `agendado`/`confirmado`/`concluido`/`faltou`/`cancelado`.

---

## 8. Alertas

### `api_alert_create` — IA pedindo ajuda

```json
POST /rpc/api_alert_create
{
  "p_data": {
    "instancia": "clinicaolhos",
    "numero": "5511987654321@s.whatsapp.net",
    "mensagem": "Paciente perguntou se Bradesco cobre cirurgia refrativa.",
    "resolved": false
  }
}
```

### `api_alerts_pending`

```json
POST /rpc/api_alerts_pending
{ "p_instancia": "clinicaolhos" }
```

### `api_alert_resolve`

```json
POST /rpc/api_alert_resolve
{ "p_id": "uuid-do-alerta" }
```

---

## 9. Atividades / Kanban

### `api_kanban_columns`

```json
POST /rpc/api_kanban_columns
{ "p_instancia": "clinicaolhos" }
```

### `api_kanban_cards`

```json
POST /rpc/api_kanban_cards
{ "p_instancia": "clinicaolhos" }
```

### `api_kanban_card_create`

```json
POST /rpc/api_kanban_card_create
{
  "p_data": {
    "instancia": "clinicaolhos",
    "column_id": "uuid",
    "title": "Confirmar consulta de Maria amanhã 14h",
    "description": "Paciente não respondeu confirmação automática.",
    "priority": "alta",
    "due_date": "2026-05-02",
    "position": 0
  }
}
```

---

## 10. Fidelidade

> Só se aplica a empresas com WhatsApp via **Evolution API** (`whatsapp_api_type` diferente de `oficial`).

Fluxo simples: a tela Fidelidade do painel só configura (mensagem + recorrência,
salvos em `companies`). Quem descobre pra quem enviar é sempre o banco — não
existe mais botão de "Enviar" por cliente nem fila gravada manualmente.

A recorrência é **dia do mês + hora**, não uma data única — `fidelidade_dia_mes`
(1 a 31) e `fidelidade_hora` ('HH:mm'). Deixando os dois em branco, o envio fica
sempre ativo (dispara em todo tick do worker). Preenchendo, só dispara quando
`extract(day from now())` bater com `fidelidade_dia_mes` **e** a hora atual bater
com `fidelidade_hora` — todo mês, nesse dia e hora.

**"Cliente novo"** = primeiro contato caiu no **mês de calendário anterior** ao
atual (janela fixa, não móvel — mesma regra de `src/lib/loyalty.js`). No dia 1º
de cada mês a lista pula de uma vez pra quem chegou no mês inteiro anterior.

### 10.1 `api_fidelidade_processar` — endpoint único do worker (via RPC)

Essa é a **única chamada** que o Schedule Trigger do n8n precisa fazer, a cada
tick (rode a cada 30min pra não perder horários configurados em `:30`). Ela:

1. Lê `fidelidade_mensagem`, `fidelidade_dia_mes` e `fidelidade_hora` da empresa.
2. Se não tiver mensagem configurada, ou se tiver dia/hora configurados e não
   for esse dia+hora agora, devolve **array vazio** — nada a fazer nessa rodada.
3. Senão, varre `mensagens_geral` procurando clientes novos (primeiro contato no
   mês de calendário anterior) que ainda não estão em `fidelidade_envios`, e
   devolve todo mundo pronto pra receber, já com a mensagem configurada.

```json
POST /rpc/api_fidelidade_processar
{ "p_instancia": "clinicaolhos" }
```

Retorno (array, pode vir vazio):
```json
[
  {
    "numero": "556196622676",
    "nome": "Clínica AcolheDor",
    "mensagem": "Olá! Vimos que você é novo por aqui, seja bem-vindo...",
    "primeiro_contato": "2026-08-17T13:02:00+00:00",
    "ultima_interacao": "2026-08-18T09:40:00+00:00",
    "total_mensagens": 4
  }
]
```

Pra cada item: gerar a mensagem final (IA, usando `mensagem` como base — ver
prompt da Jade) e mandar pela Evolution API (`POST /message/sendText/{{instancia}}`,
seção final deste doc). Depois do envio dar certo, **grave em `fidelidade_envios`**
pra não reenviar pro mesmo cliente no próximo tick:

```json
POST /rest/v1/fidelidade_envios
{
  "instancia": "clinicaolhos",
  "numero": "556196622676",
  "nome": "Clínica AcolheDor",
  "mensagem": "texto que foi enviado",
  "sent_at": "2026-08-18T21:00:00Z",
  "delivered_at": "2026-08-18T21:00:00Z",
  "sent_by_email": "automacao@n8n"
}
```

> **Importante:** sem essa gravação, o próximo tick do Schedule Trigger vai achar
> o mesmo cliente de novo (`api_fidelidade_processar` só exclui quem já está
> registrado em `fidelidade_envios`) e reenviar a mensagem.

### 10.2 `fidelidade_clientes_novos` — mesma coisa, sem RPC (pra montar com nodes visuais)

Se preferir montar o fluxo só com o node nativo "Supabase → Get many rows" do
n8n (sem HTTP Request chamando RPC), essa **view** já vem com a parte pesada
pronta — agrupa `mensagens_geral` por telefone e calcula o primeiro contato de
cada um. Consulta ela como se fosse uma tabela normal:

```
Tabela: fidelidade_clientes_novos
Filtros (Must Match: All Filters):
  instancia         eq   {{ $json.instance }}
  primeiro_contato  gte  {{ $now.startOf('month').minus({months: 1}).toISO() }}
  primeiro_contato  lt   {{ $now.startOf('month').toISO() }}
```

Colunas: `instancia`, `numero_norm`, `numero`, `nome`, `primeiro_contato`,
`ultima_interacao`, `total_mensagens`. Depois, exclui quem já está em
`fidelidade_envios` com um node **Merge** (comparando por `numero`) — como as
duas consultas já vêm pequenas (uma linha por cliente, não por mensagem), não
precisa de Code node pra essa parte.

---

## 11. Receitas comuns para IA

### 11.1 Mensagem nova chega — montar contexto

1. `api_paciente_by_phone` → pega lead/paciente
2. `api_messages_by_phone` (limit 20) → últimas mensagens
3. `api_appointments_by_phone` → próximos agendamentos
4. `api_professionals_list`, `api_procedures_list`, `api_insurance_plans_list` → catálogo (cachear 1h)

### 11.2 IA agendou consulta

1. `api_professionals_list` → escolhe profissional
2. `api_appointments_busy_slots` → slots ocupados na semana
3. `api_procedure_price` → valor com base no convênio
4. `api_appointment_create` → cria
5. `api_message_create` → registra confirmação no histórico
6. `api_conversation_close` com `p_reason: agendado` → fecha ticket

### 11.3 IA não soube responder

1. `api_alert_create` → pra atendente humano com contexto
2. `api_message_create` → mensagem amigável: *"Vou passar sua dúvida pra alguém da equipe agora."*

---

## Envio efetivo de WhatsApp

Não faz parte desta API. Use **Evolution API** diretamente:

```http
POST {{evolution_url}}/message/sendText/{{instancia}}
apikey: {{api_instancia}}
Content-Type: application/json

{
  "number": "5511987654321",
  "text": "Sua consulta amanhã 14h está confirmada."
}
```

---

*Última atualização: 2026-08-19 · v6 (Fidelidade — "novo" = mês de calendário anterior; view pra montagem sem RPC)*
