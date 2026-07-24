import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useContactTags } from '../../hooks/useContactTags'
import Recorder from 'opus-recorder'
import { MessageSquare, Bot, User, PhoneCall, CheckCircle2, X, Send, Headset, Sparkles, Inbox, UserCheck, Archive, Mic, Square, Trash2, Paperclip, FileText, Image as ImageIcon, Calendar, UserPlus, BookUser, Lock, ArrowRightLeft, ChevronLeft, ChevronDown, Plus, Pencil, Users, CheckCheck, MapPin, Crosshair, Smile } from 'lucide-react'
import './Company.css'

const CONV_TABLE = 'mensagens_geral'
const PAGE_SIZE  = 50

const EMOJI_CATEGORIES = [
  {
    key: 'smileys', label: 'Carinhas', icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','🫠','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫡','🤫','🤔','🫣','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  },
  {
    key: 'people', label: 'Pessoas', icon: '👋',
    emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','💋','🩸','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','😀','🙋','🙋‍♂️','🙋‍♀️','🧑‍⚕️','🧑‍🎓','🧑‍🏫','🧑‍💻','🧑‍🍳','🧑‍🔧','🧑‍🎨','🧑‍🚀','👮','🕵️','💂','👷','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🤱'],
  },
  {
    key: 'animals', label: 'Animais', icon: '🐶',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🕸️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔'],
  },
  {
    key: 'food', label: 'Comida', icon: '🍔',
    emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'],
  },
  {
    key: 'activities', label: 'Atividades', icon: '⚽',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩'],
  },
  {
    key: 'travel', label: 'Viagens', icon: '🚗',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽','🦼','🛴','🚲','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧','🚦','🚥','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋'],
  },
  {
    key: 'objects', label: 'Objetos', icon: '💡',
    emojis: ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🕹️','💽','💾','💿','📀','📷','📸','📹','🎥','📞','☎️','📟','📠','📺','📻','🎙️','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','🧾','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','💊','💉','🩸','🩹','🩺','🩻','🚪','🛗','🪞','🪟','🛏️','🛋️','🪑','🚽','🪠','🚿','🛁','🪥','🪒','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪒','🧽','🧯','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎉','🎊','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📮','📪','📦','📋','📁','📂','🗂️','📅','📆','🗓️','📇','📈','📉','📊','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️'],
  },
  {
    key: 'symbols', label: 'Símbolos', icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📶','🈁','🔣','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','🟰','♾️','💲','💱','™️','©️','®️'],
  },
  {
    key: 'flags', label: 'Bandeiras', icon: '🏳️',
    emojis: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇧🇷','🇺🇸','🇵🇹','🇪🇸','🇦🇷','🇨🇱','🇺🇾','🇵🇾','🇧🇴','🇨🇴','🇻🇪','🇵🇪','🇲🇽','🇫🇷','🇩🇪','🇮🇹','🇬🇧','🇨🇦','🇯🇵','🇨🇳','🇰🇷','🇮🇳','🇦🇺','🇿🇦'],
  },
]

function mapRow(r) {
  return {
    id: r.id,
    id_mensagem: r.id_mensagem || null,
    type: getMessageType(r),
    content: getMessageContent(r),
    base64: r.base64 || null,
    resumo: r.resumo || null,
    transcricao: r.transcricao || null,
    location: r.location || null,
    contato: parseContactInput(r.contato),
    // Aceita tanto { emoji, from } quanto só o emoji cru (string) — não depende do n8n
    // montar o objeto certinho, igual fizemos com location/contato.
    reacao: (() => {
      if (!r.reacao) return null
      if (typeof r.reacao === 'string') return r.reacao.trim() ? { emoji: r.reacao.trim() } : null
      return r.reacao.emoji ? r.reacao : null
    })(),
    ts: getTimestamp(r),
  }
}

function formatPhone(val) {
  return (val || '').replace(/@.*$/, '')
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => ctx.close()
  } catch (_) {}
}

// Normaliza para deduplicação: strip sufixo @, dígitos apenas, remove 55 de prefixo se presente
function normPhoneKey(sid) {
  const n = (sid || '').replace(/@.*$/, '').replace(/\D/g, '')
  return n.startsWith('55') && n.length > 10 ? n.slice(2) : n
}

function getMessageContent(row) {
  return (row.mensagem || '')
    .replace(/^\*[^*]+\*:\n/, '')
    .replace(/\\n/g, '\n')
    .trim()
}

// Extrai nome (FN) e telefone (TEL) de um vCard puro (texto, não base64).
function parseVcardText(vcard) {
  if (!vcard) return { name: null, phone: null }
  const nameMatch = vcard.match(/FN:(.*)/)
  const telMatch = vcard.match(/TEL[^:]*:([^\r\n]*)/)
  return {
    name: nameMatch?.[1]?.trim() || null,
    phone: telMatch?.[1]?.replace(/\D/g, '') || null,
  }
}

// Aceita o que o n8n mandar puro: string em base64 (como a Cloud API entrega), texto de
// vCard cru, ou já um objeto { name, phone, vcard } — normaliza tudo pro mesmo formato
// pra não depender de o n8n extrair nome/telefone antes de salvar.
function parseContactInput(contato) {
  if (!contato) return null
  const decodeIfBase64 = (raw) => {
    if (raw.includes('BEGIN:VCARD')) return raw
    try { return atob(raw) } catch { return raw }
  }
  if (typeof contato === 'string') {
    const vcardText = decodeIfBase64(contato)
    const { name, phone } = parseVcardText(vcardText)
    return { name, phone, vcard: vcardText }
  }
  if (contato.name || contato.phone) return contato
  if (contato.vcard) {
    const vcardText = decodeIfBase64(contato.vcard)
    const { name, phone } = parseVcardText(vcardText)
    return { name: name || contato.name || null, phone: phone || contato.phone || null, wa_id: contato.wa_id || null, vcard: vcardText }
  }
  return null
}

// Prévia curta da última mensagem, mostrada na lista de conversas.
function getLastMsgPreview(row) {
  if (row.location?.lat != null) return `📍 ${row.location.name?.trim() || 'Localização'}`
  const contato = parseContactInput(row.contato)
  if (contato && (contato.name || contato.phone)) return `👤 ${contato.name?.trim() || 'Contato'}`
  if (row.resumo?.trim()) return `🎤 ${row.resumo.trim()}`
  const content = getMessageContent(row)
  if (!content) return ''
  const fileLineMatch = content.match(/^(🎤 Áudio|🖼️ [^\n]+|📄 [^\n]+|📎 [^\n]+)(\n([\s\S]*))?$/)
  if (fileLineMatch) {
    const extra = fileLineMatch[3]?.trim()
    return extra ? `${fileLineMatch[1].split('\n')[0]} · ${extra}` : fileLineMatch[1]
  }
  const oneLine = content.replace(/\s+/g, ' ').trim()
  return oneLine.length > 60 ? oneLine.slice(0, 60) + '…' : oneLine
}

function getMessageType(row) { return (row.type || 'human').toLowerCase() }

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


function detectMedia(b64) {
  if (!b64 || b64.length < 10) return null
  if (b64.startsWith('T2dn')) return { type: 'audio', mime: 'audio/ogg' }
  if (b64.startsWith('//uQ') || b64.startsWith('SUQz')) return { type: 'audio', mime: 'audio/mpeg' }
  if (b64.startsWith('GkXf')) return { type: 'audio', mime: 'audio/webm' }
  if (b64.startsWith('/9j/')) return { type: 'image', mime: 'image/jpeg' }
  if (b64.startsWith('iVBOR')) return { type: 'image', mime: 'image/png' }
  if (b64.startsWith('UklGR')) return { type: 'image', mime: 'image/webp' }
  if (b64.startsWith('R0lGOD')) return { type: 'image', mime: 'image/gif' }
  if (b64.startsWith('JVBERi')) return { type: 'pdf', mime: 'application/pdf' }
  return null
}

// Formata texto de mensagem igual o WhatsApp: *negrito*, ~riscado~ e links clicáveis.
const FORMAT_TOKEN_RE = /(https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[^\s]+|\*[^\s*][^*]*\*|~[^\s~][^~]*~)/g

function renderFormattedText(text) {
  if (!text) return text
  const nodes = []
  let lastIndex = 0
  let match
  let key = 0
  FORMAT_TOKEN_RE.lastIndex = 0
  while ((match = FORMAT_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    let token = match[0]
    if (/^(https?:\/\/|www\.)/i.test(token)) {
      let trail = ''
      const trailMatch = token.match(/[.,;:!?)\]'"]+$/)
      if (trailMatch) { trail = trailMatch[0]; token = token.slice(0, -trail.length) }
      const href = /^https?:\/\//i.test(token) ? token : `https://${token}`
      nodes.push(
        <a key={key++} href={href} target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ color: 'inherit', textDecoration: 'underline' }}>
          {token}
        </a>
      )
      if (trail) nodes.push(trail)
    } else if (token.startsWith('*')) {
      nodes.push(<strong key={key++}>{token.slice(1, -1)}</strong>)
    } else if (token.startsWith('~')) {
      nodes.push(<s key={key++}>{token.slice(1, -1)}</s>)
    }
    lastIndex = FORMAT_TOKEN_RE.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

// Aceita "lat, lng" cru ou um link do Google Maps (@lat,lng / ?q=lat,lng / ?ll=lat,lng).
// Não resolve links encurtados (goo.gl/maps/...) — precisa do link completo com coordenadas.
function parseLocationInput(raw) {
  const text = (raw || '').trim()
  if (!text) return null
  const clean = text.replace(/%2C/gi, ',')
  const plain = clean.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (plain) return { lat: parseFloat(plain[1]), lng: parseFloat(plain[2]) }
  const atMatch = clean.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
  const qMatch = clean.match(/[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) }
  const llMatch = clean.match(/[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) }
  return null
}

// Mini "static maps" sem precisar de API key/billing: monta um mosaico 2x2 de tiles
// XYZ padrão (CARTO Voyager, cobertura mundial e sem key) e recorta na posição exata
// do pino — 2 tiles em cada eixo garantem cobertura mesmo quando o ponto cai perto
// de uma borda de tile.
function lonLatToPixel(lat, lng, zoom) {
  const n = Math.pow(2, zoom)
  const latRad = lat * Math.PI / 180
  const x = (lng + 180) / 360 * n * 256
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * 256
  return { x, y }
}

function getStaticMapTiles(lat, lng, zoom, width, height) {
  const { x: px, y: py } = lonLatToPixel(lat, lng, zoom)
  const left = px - width / 2
  const top = py - height / 2
  const tileX0 = Math.floor(left / 256)
  const tileY0 = Math.floor(top / 256)
  const n = Math.pow(2, zoom)
  const wrap = (t) => ((t % n) + n) % n
  const subs = ['a', 'b', 'c', 'd']
  const tiles = []
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const tx = wrap(tileX0 + dx)
      const ty = wrap(tileY0 + dy)
      const sub = subs[(tx + ty) % subs.length]
      tiles.push({ dx, dy, url: `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png` })
    }
  }
  return { tiles, offsetX: left - tileX0 * 256, offsetY: top - tileY0 * 256 }
}

// ── Apresentação de resumo/transcrição gerados por IA (documento e áudio) ──────
// Paleta violeta = "insight de IA" em todo o app (mesma linguagem do CRM); em cima
// da bolha verde do atendente vira um overlay translúcido branco pra não brigar de cor.
function AiToggleChip({ isAtendente, icon: Icon, label, expanded, onClick }) {
  const onGreen = isAtendente
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px 3px 8px', borderRadius: 20, cursor: 'pointer',
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.01em',
        border: `1px solid ${onGreen ? 'rgba(255,255,255,0.35)' : (expanded ? '#DDD6FE' : '#E9E4FB')}`,
        background: onGreen ? 'rgba(255,255,255,0.14)' : (expanded ? '#EDE7FE' : '#F8F6FE'),
        color: onGreen ? '#fff' : '#6D28D9',
        transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <Icon size={10.5} />
      {label}
      <ChevronDown size={10} style={{ transition: 'transform 0.18s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.75 }} />
    </button>
  )
}

function AiExpandedCard({ isAtendente, icon: Icon, title, children }) {
  const onGreen = isAtendente
  return (
    <div style={{
      marginTop: 6, borderRadius: 10, padding: '9px 12px',
      background: onGreen ? 'rgba(255,255,255,0.12)' : 'linear-gradient(180deg, #FBFAFF 0%, #F5F3FF 100%)',
      border: `1px solid ${onGreen ? 'rgba(255,255,255,0.22)' : '#E9E4FB'}`,
      animation: 'ai-card-in 0.16s ease-out',
      maxWidth: 280,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4,
        fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: onGreen ? 'rgba(255,255,255,0.7)' : '#8B5CF6',
      }}>
        <Icon size={10} /> {title}
      </div>
      <div style={{
        fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        color: onGreen ? 'rgba(255,255,255,0.95)' : '#1E1B3A',
      }}>
        {children}
      </div>
    </div>
  )
}

function AiLoadingDots({ isAtendente, label }) {
  const onGreen = isAtendente
  const dotColor = onGreen ? 'rgba(255,255,255,0.85)' : '#8B5CF6'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 10.5, fontStyle: 'italic', color: onGreen ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)' }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 0.15, 0.3].map(delay => (
          <span key={delay} style={{
            width: 5, height: 5, borderRadius: '50%', background: dotColor,
            animation: 'msg-dot-bounce 1.1s ease-in-out infinite', animationDelay: `${delay}s`,
          }} />
        ))}
      </span>
      {label}
    </div>
  )
}

function isToolMessage(row) {
  const type = getMessageType(row)
  const content = row.mensagem || ''
  if (type === 'tool') return true
  if (type === 'ia' && /^Calling \w+ with input:/i.test(content.trim())) return true
  return false
}

function formatMsgTime(ts, tz = 'America/Sao_Paulo') {
  if (!ts) return ''
  const date = new Date(ts)
  if (isNaN(date.getTime())) return ''
  const opts = { timeZone: tz }
  const hhmm = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...opts })
  const dateStr = date.toLocaleDateString('pt-BR', opts)
  const todayStr = new Date().toLocaleDateString('pt-BR', opts)
  if (dateStr === todayStr) return hhmm
  const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR', opts)
  if (dateStr === yesterdayStr) return `Ontem ${hhmm}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...opts })} ${hhmm}`
}

function formatApptShort(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d >= today && d < new Date(today.getTime() + 86400000)) return `hoje ${hh}`
  if (d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000)) return `amanhã ${hh}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hh}`
}

function formatContactTime(ts, tz = 'America/Sao_Paulo') {
  if (!ts) return ''
  const date = new Date(ts)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const diffMin = Math.floor((now - date) / 60000)
  const diffH = Math.floor(diffMin / 60)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  if (diffH < 24) return `${diffH}h`
  const opts = { timeZone: tz }
  const dateStr = date.toLocaleDateString('pt-BR', opts)
  const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR', opts)
  if (dateStr === yesterdayStr) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...opts })
}

const REASONS = [
  { value: 'agendado',       label: 'Agendado',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { value: 'resolvido',      label: 'Resolvido',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'encaminhado',    label: 'Encaminhado', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { value: 'desistiu',       label: 'Desistiu',    color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'auto_encerrado', label: 'Expirado',    color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
]

const AUTO_CLOSE_HOURS = 2
const MANUAL_REASONS = REASONS.filter(r => r.value !== 'auto_encerrado')

export default function CompanyConversations() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const instance      = session?.company?.instance
  const apiInstancia  = session?.company?.api_instancia
  // WhatsApp Cloud API (Meta) não tem endpoint de editar/apagar mensagem já enviada —
  // só a Evolution API (sessão própria) consegue. Some a opção de editar quando for Oficial.
  const isOfficialApi = (session?.company?.whatsapp_api_type || 'evolution') === 'oficial'
  const sendWebhookUrl = isOfficialApi
    ? 'https://n8n.nexladesenvolvimento.com.br/webhook/respondeplataforma'
    : 'https://n8n.nexladesenvolvimento.com.br/webhook/envioNexla'
  const contactsTable = session?.company?.contacts_table

  const isAdmin = session?.user?.role === 'admin'
  const userSector = session?.user?.sector // { id, name, color } or null
  const aiEnabled = session?.company?.ai_enabled !== false
  const companyTz = session?.company?.timezone || 'America/Sao_Paulo'

  // Prioridade: saved_contacts > contacts_table (clientes) > pushname > telefone
  function getContactName(contact) {
    const num = contact.phone.replace(/\D/g, '')
    return savedContacts[num]?.nome || clientesMap[num] || contact.pushname || contact.phone
  }

  function checkSession() {
    if (session) return true
    setToast({ message: 'Sessão expirada. Recarregue a página.', color: '#DC2626' })
    setTimeout(() => setToast(null), 5000)
    return false
  }

  // Tags — no topo, antes de qualquer early return
  const { tags, tagsByContact, addTag, removeTag } = useContactTags(instance)
  const [tagFilter, setTagFilter] = useState(null) // tag id | null
  const [chatTagPickerOpen, setChatTagPickerOpen] = useState(false)
  const [headerTagOpen, setHeaderTagOpen] = useState(false)

  useEffect(() => {
    if (!chatTagPickerOpen && !headerTagOpen) return
    const close = () => { setChatTagPickerOpen(false); setHeaderTagOpen(false) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [chatTagPickerOpen, headerTagOpen])

  const [contacts, setContacts]         = useState([])
  const [unreadMap, setUnreadMap]       = useState({}) // session_id → count
  const [closedMap, setClosedMap]       = useState({}) // session_id → reason
  const [attendancesMap, setAttendancesMap] = useState({}) // numero → attendance record
  const [assuming, setAssuming]         = useState(null)
  const [transferModal, setTransferModal] = useState(null)
  const [transferringTo, setTransferringTo] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [companyUsers, setCompanyUsers] = useState([]) // outros atendentes pra transferir
  const [tab, setTab]                 = useState('recepcao')
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [search, setSearch]           = useState('')
  const [msgMatchNums, setMsgMatchNums] = useState(null) // Set<string> | null
  const searchDebounce = useRef(null)
  const [selected, setSelected]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [hasMore, setHasMore]         = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [closeModal, setCloseModal]   = useState(null)
  const [reason, setReason]           = useState('')
  const [closing, setClosing]         = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toast, setToast]             = useState(null)
  const [msgText, setMsgText]         = useState('')
  const [sending, setSending]         = useState(false)
  const [otherTyping, setOtherTyping] = useState(null) // { name } | null
  const typingChRef = useRef(null)
  const lastTypingSentRef = useRef(0)
  const typingClearTimeoutRef = useRef(null)
  const [closedLoaded, setClosedLoaded] = useState(false)
  const [lightbox, setLightbox]       = useState(null)
  const [recording, setRecording]     = useState(false)
  const [recordedAudio, setRecordedAudio] = useState(null) // { base64, mime, duration }
  const [recordTime, setRecordTime]   = useState(0)
  const [attachedFile, setAttachedFile] = useState(null) // { base64, mime, name, size, kind: 'image'|'pdf'|'file' }
  const [savedContacts, setSavedContacts] = useState({}) // numero (só dígitos) → { id, nome, notes }
  const [clientesMap, setClientesMap]     = useState({}) // numero (só dígitos) → nome
  const [futureAppts, setFutureAppts]     = useState({}) // numero (só dígitos) → { starts_at, status, agenda_name }
  const [contextMenu, setContextMenu] = useState(null) // { x, y, contact }
  const [saveContactModal, setSaveContactModal] = useState(null) // { numero, nome, notes }
  const [savingContact, setSavingContact] = useState(false)
  const [editingMsgId, setEditingMsgId]   = useState(null)
  const [editingText, setEditingText]     = useState('')
  const [savingEdit, setSavingEdit]       = useState(false)
  const [expandedCaptions, setExpandedCaptions] = useState(new Set()) // ids com resumo do documento visível
  const [expandedTranscripts, setExpandedTranscripts] = useState(new Set()) // ids com transcrição do áudio visível
  const [locationModal, setLocationModal] = useState(false)
  const [locInput, setLocInput]       = useState('')
  const [locName, setLocName]         = useState('')
  const [locAddress, setLocAddress]   = useState('')
  const [locErr, setLocErr]           = useState('')
  const [sendingLocation, setSendingLocation] = useState(false)
  const [gettingGeo, setGettingGeo]   = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiCategory, setEmojiCategory] = useState(EMOJI_CATEGORIES[0].key)
  const emojiPickerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordTimerRef   = useRef(null)
  const recordStartRef   = useRef(0)
  const fileInputRef     = useRef(null)
  const messageInputRef  = useRef(null)
  const bottomRef        = useRef(null)
  const selectedRef      = useRef(null)
  const autoCloseDone    = useRef(false)
  const chatBodyRef      = useRef(null)
  const isLoadingMoreRef = useRef(false)
  const maxMsgIdRef      = useRef(0)

  useEffect(() => { selectedRef.current = selected }, [selected])
  const closedMapRef = useRef({})
  useEffect(() => { closedMapRef.current = closedMap }, [closedMap])

  // Carrega agendamentos futuros (próximo por contato)
  useEffect(() => {
    if (!instance) return
    const now = new Date().toISOString()
    supabase.from('appointments')
      .select('contact_numero, starts_at, status, agenda_id, agendas(name)')
      .eq('instancia', instance)
      .gte('starts_at', now)
      .neq('status', 'cancelado')
      .neq('status', 'concluido')
      .order('starts_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(a => {
            if (!a.contact_numero) return
            if (!map[a.contact_numero]) map[a.contact_numero] = {
              starts_at: a.starts_at, status: a.status,
              agenda_name: a.agendas?.name || '',
            }
          })
          setFutureAppts(map)
        }
      })

    const ch = supabase.channel(`convs-appts-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `instancia=eq.${instance}` },
        () => {
          const ts = new Date().toISOString()
          supabase.from('appointments')
            .select('contact_numero, starts_at, status, agendas(name)')
            .eq('instancia', instance)
            .gte('starts_at', ts)
            .neq('status', 'cancelado')
            .neq('status', 'concluido')
            .order('starts_at', { ascending: true })
            .then(({ data }) => {
              if (data) {
                const map = {}
                data.forEach(a => {
                  if (!a.contact_numero) return
                  if (!map[a.contact_numero]) map[a.contact_numero] = {
                    starts_at: a.starts_at, status: a.status,
                    agenda_name: a.agendas?.name || '',
                  }
                })
                setFutureAppts(map)
              }
            })
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Carrega contatos salvos
  useEffect(() => {
    if (!instance) return
    supabase.from('saved_contacts').select('*').eq('instancia', instance)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(c => { map[c.numero] = c })
          setSavedContacts(map)
        }
      })
    const ch = supabase.channel(`convs-saved-contacts-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_contacts', filter: `instancia=eq.${instance}` },
        (p) => {
          if (p.eventType === 'DELETE') {
            setSavedContacts(prev => { const n = { ...prev }; delete n[p.old.numero]; return n })
          } else if (p.new) {
            setSavedContacts(prev => ({ ...prev, [p.new.numero]: p.new }))
          }
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Carrega nomes da tabela de clientes da empresa (contacts_table)
  useEffect(() => {
    if (!contactsTable) return
    supabase.from(contactsTable).select('nome, numero')
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(r => {
          if (r.numero) map[String(r.numero).replace(/\D/g, '')] = r.nome
        })
        setClientesMap(map)
      })
  }, [contactsTable])

  // Abre conversa via ?contact=xxxx (vindo da página Contatos)
  useEffect(() => {
    const target = searchParams.get('contact')
    if (!target || loadingContacts) return
    const cleanTarget = target.replace(/\D/g, '')
    // API Oficial (Meta) grava `numero` sem sufixo de JID; só a Evolution usa
    // "@s.whatsapp.net". Usar o sufixo errado cria uma 2ª entrada pro mesmo contato,
    // com histórico de mensagens "invisível" (chave diferente da conversa real).
    const sessionId = isOfficialApi ? cleanTarget : `${cleanTarget}@s.whatsapp.net`
    const existing = contacts.find(c => c.session_id === sessionId || c.phone === cleanTarget)
    if (existing) {
      setSelected(existing)
      // Se está finalizada, força aba certa para visualizar
      if (closedMap[existing.session_id]) setTab('finalizados')
      else if (attendancesMap[existing.session_id]) setTab('meu-setor')
      else setTab('recepcao')
    } else {
      const synthetic = { session_id: sessionId, phone: cleanTarget, lastTs: null }
      setContacts(prev => [synthetic, ...prev])
      setSelected(synthetic)
      setTab('recepcao')
    }
    searchParams.delete('contact')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, loadingContacts])

  // Fecha menu de contexto ao clicar fora
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  // Fecha o seletor de emoji ao clicar fora dele (e fora do botão que o abre)
  useEffect(() => {
    if (!showEmojiPicker) return
    const close = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) setShowEmojiPicker(false)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showEmojiPicker])

  // Insere o emoji na posição do cursor (não só no final), igual apps de chat de verdade
  function insertEmoji(emoji) {
    const el = messageInputRef.current
    const start = el?.selectionStart ?? msgText.length
    const end = el?.selectionEnd ?? msgText.length
    const newText = msgText.slice(0, start) + emoji + msgText.slice(end)
    setMsgText(newText)
    notifyTyping()
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  function openSaveContact(contact) {
    const numero = contact.phone.replace(/\D/g, '')
    const existing = savedContacts[numero]
    setSaveContactModal({
      id: existing?.id || null,
      numero,
      nome: existing?.nome || '',
      notes: existing?.notes || '',
    })
    setContextMenu(null)
  }

  async function handleSaveContact() {
    if (!saveContactModal?.nome.trim()) return
    setSavingContact(true)
    const { id, numero, nome, notes } = saveContactModal
    const { error } = id
      ? await supabase.from('saved_contacts').update({ nome: nome.trim(), notes: notes?.trim() || null }).eq('id', id)
      : await supabase.from('saved_contacts').insert({
          numero, instancia: instance,
          nome: nome.trim(), notes: notes?.trim() || null,
          created_by_email: session?.user?.email,
        })
    setSavingContact(false)
    if (!error) setSaveContactModal(null)
    else setToast({ message: 'Erro ao salvar: ' + error.message, color: '#DC2626' })
  }

  // Carrega atendimentos ativos (quem está em qual setor + atendente)
  useEffect(() => {
    if (!instance) return
    supabase.from('attendances').select('*').eq('instancia', instance)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(r => { map[r.numero] = r })
          setAttendancesMap(map)
        }
      })
  }, [instance])

  // Carrega outros usuários da empresa pra opção de transferir conversa
  useEffect(() => {
    const companyId = session?.company?.id
    if (!companyId) return
    supabase.from('users').select('id, name, email, role').eq('company_id', companyId)
      .then(({ data }) => setCompanyUsers(data || []))
  }, [session?.company?.id])

  // Realtime: attendances
  useEffect(() => {
    if (!instance) return
    const ch = supabase.channel(`convs-attendances-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances', filter: `instancia=eq.${instance}` },
        (p) => {
          if (p.eventType === 'DELETE') {
            setAttendancesMap(prev => { const n = { ...prev }; delete n[p.old.numero]; return n })
          } else if (p.new) {
            setAttendancesMap(prev => ({ ...prev, [p.new.numero]: p.new }))
          }
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Garante que mensagens_geral está no Realtime (idempotente)
  useEffect(() => {
    if (!instance) return
    supabase.rpc('ensure_table_setup', { p_table: CONV_TABLE })
  }, [instance])

  // Carrega todos os contatos únicos da mensagens_geral (apenas WhatsApp)
  useEffect(() => {
    if (!instance) return
    setLoadingContacts(true)
    // `resumo`, `location` e `contato` são opcionais (colunas novas, adicionadas só depois que as
    // migrations correspondentes rodarem) — tenta com todas e, se alguma ainda não existir (42703),
    // vai removendo uma de cada vez (da mais nova pra mais antiga) sem quebrar a lista de conversas.
    const BASE_COLS = 'numero, type, created_at, horaLastMessage, aplicativo, nome, mensagem'
    const OPTIONAL_COLS = ['resumo', 'location', 'contato']
    const fetchContactsRows = (cols) => supabase.from(CONV_TABLE).select(cols)
      .eq('instancia', instance)
      .or('aplicativo.neq.instagram,aplicativo.is.null')
      .order('id', { ascending: false })
      .limit(5000)
    let chain = fetchContactsRows([BASE_COLS, ...OPTIONAL_COLS].join(', '))
    for (let i = OPTIONAL_COLS.length - 1; i >= 0; i--) {
      const cols = [BASE_COLS, ...OPTIONAL_COLS.slice(0, i)].join(', ')
      chain = chain.then(res => res.error?.code === '42703' ? fetchContactsRows(cols) : res)
    }
    chain
      .then(({ data, error }) => {
        if (!error && data) {
          const seen = new Set()
          const unique = []
          // Indexa quem teve resposta de atendente humano em algum momento
          const hasOutsideHuman = new Set()
          for (const row of data) {
            const t = (row.type || '').toLowerCase()
            if ((t === 'atendente' || t === 'humano') && row.numero) {
              hasOutsideHuman.add(normPhoneKey(row.numero))
            }
          }
          for (const row of data) {
            const sid = row.numero
            if (!sid) continue
            const norm = normPhoneKey(sid)
            if (seen.has(norm)) continue
            seen.add(norm)
            unique.push({
              session_id: sid,
              phone: formatPhone(sid),
              lastTs: getTimestamp(row),
              outsideAssumed: hasOutsideHuman.has(normPhoneKey(sid)),
              pushname: row.nome || null,
              isGroup: sid.includes('@g.us'),
              lastMsgPreview: getLastMsgPreview(row),
            })
          }
          setContacts(unique)
        }
        setLoadingContacts(false)
      })
  }, [instance])

  // Carrega sessões encerradas com motivo
  useEffect(() => {
    if (!instance) return
    supabase.from('conversations').select('session_id, reason').eq('instancia', instance)
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(r => { map[r.session_id] = r.reason || 'resolvido' })
          setClosedMap(map)
        }
        setClosedLoaded(true)
      })
  }, [instance])

  // Auto-encerra tickets sem atividade após AUTO_CLOSE_HOURS horas
  useEffect(() => {
    if (autoCloseDone.current || loadingContacts || !closedLoaded || !instance || !contacts.length) return
    autoCloseDone.current = true

    const cutoff = Date.now() - AUTO_CLOSE_HOURS * 3600_000
    const toClose = contacts.filter(c =>
      !closedMap[c.session_id] &&
      c.lastTs &&
      new Date(c.lastTs).getTime() < cutoff
    )
    if (!toClose.length) return

    toClose.forEach(c => {
      supabase.from('conversations').insert({
        session_id: c.session_id,
        instancia: instance,
        reason: 'auto_encerrado',
        closed_at: new Date().toISOString(),
      }).then(({ error }) => {
        // 23505 = unique violation — outra aba já fechou, OK ignorar
        if (error && error.code !== '23505') console.warn('auto-close:', error)
      })
      supabase.from('attendances').delete().eq('numero', c.session_id).eq('instancia', instance).then(() => {})
    })

    setClosedMap(prev => {
      const next = { ...prev }
      toClose.forEach(c => { next[c.session_id] = 'auto_encerrado' })
      return next
    })
    setAttendancesMap(prev => {
      const next = { ...prev }
      toClose.forEach(c => { delete next[c.session_id] })
      return next
    })
  }, [loadingContacts, closedLoaded, contacts, closedMap, instance])

  // Realtime: conversa encerrada por qualquer usuário → atualiza closedMap
  useEffect(() => {
    if (!instance) return
    const ch = supabase.channel(`convs-closed-${instance}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `instancia=eq.${instance}` },
        (p) => {
          const sid = p.new?.session_id
          if (!sid) return
          setClosedMap(prev => ({ ...prev, [sid]: p.new.reason || 'resolvido' }))
          setAttendancesMap(prev => { const n = { ...prev }; delete n[sid]; return n })
          setSelected(prev => prev?.session_id === sid ? null : prev)
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations', filter: `instancia=eq.${instance}` },
        (p) => {
          const sid = p.old?.session_id
          if (!sid) return
          setClosedMap(prev => { const n = { ...prev }; delete n[sid]; return n })
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Realtime: nova mensagem
  useEffect(() => {
    if (!instance) return

    function handleNewMsg(p) {
      const row = p.new
      if (!row || isToolMessage(row)) return
      if (row.aplicativo === 'instagram') return
      const sid = row.numero
      if (!sid) return
      const ts = getTimestamp(row)

      if (closedMapRef.current[sid]) reopenConversation(sid)

      // Som + contador de não lidos: só para mensagens do cliente fora da conversa aberta
      const incomingType2 = (row.type || '').toLowerCase()
      if (incomingType2 === 'cliente' && selectedRef.current?.session_id !== sid) {
        playNotificationSound()
        setUnreadMap(prev => ({ ...prev, [sid]: (prev[sid] || 0) + 1 }))
      }

      setContacts(prev => {
        const normSid = normPhoneKey(sid)
        const exists = prev.find(c => normPhoneKey(c.session_id) === normSid)
        const incomingType = (row.type || '').toLowerCase()
        const isOutsideHuman = incomingType === 'atendente' || incomingType === 'humano'
        if (exists) {
          return [
            { ...exists, lastTs: ts, outsideAssumed: exists.outsideAssumed || isOutsideHuman },
            ...prev.filter(c => normPhoneKey(c.session_id) !== normSid)
          ]
        }
        return [{ session_id: sid, phone: formatPhone(sid), lastTs: ts, outsideAssumed: isOutsideHuman, isGroup: sid.includes('@g.us') }, ...prev]
      })

      if (selectedRef.current?.session_id === sid) {
        setMessages(msgs => {
          if (msgs.some(m => m.id === row.id)) return msgs
          maxMsgIdRef.current = Math.max(maxMsgIdRef.current, row.id)
          return [...msgs, mapRow(row)]
        })
      }
    }

    // Reações (e outros updates, como id_mensagem chegando depois do webhook) não criam
    // linha nova — o n8n faz UPDATE na mensagem já existente. Sem isso, a reação só apareceria
    // depois de reabrir a conversa.
    function handleUpdatedMsg(p) {
      const row = p.new
      if (!row) return
      setMessages(msgs => msgs.map(m => m.id === row.id ? mapRow(row) : m))
    }

    const ch = supabase.channel(`convs-msgs-${instance}`, { config: { broadcast: { ack: true } } })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: CONV_TABLE, filter: `instancia=eq.${instance}` },
        handleNewMsg)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: CONV_TABLE, filter: `instancia=eq.${instance}` },
        handleUpdatedMsg)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase.removeChannel(ch)
        }
      })
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Carrega mensagens da conversa selecionada (últimas PAGE_SIZE)
  useEffect(() => {
    if (!selected || !instance) return
    setLoadingMsgs(true)
    setMessages([])
    setHasMore(false)
    maxMsgIdRef.current = 0
    supabase.from(CONV_TABLE).select('*')
      .eq('instancia', instance)
      .eq('numero', selected.session_id)
      .or('aplicativo.neq.instagram,aplicativo.is.null')
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error }) => {
        if (!error && data) {
          const msgs = data.filter(r => !isToolMessage(r)).reverse().map(mapRow)
          setMessages(msgs)
          setHasMore(data.length === PAGE_SIZE)
          maxMsgIdRef.current = msgs.length ? msgs[msgs.length - 1].id : 0
        }
        setLoadingMsgs(false)
      })
  }, [selected, instance])

  // Indicador "digitando..." entre atendentes — basta ter a conversa aberta pra ver,
  // igual no WhatsApp: não precisa focar a caixa de texto, só quem manda precisa digitar.
  useEffect(() => {
    setOtherTyping(null)
    if (!selected || !instance) return
    const topic = `conv-typing-${instance}-${selected.session_id}`.replace(/[^a-zA-Z0-9_-]/g, '_')
    const ch = supabase.channel(topic, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      // `broadcast: { self: false }` já garante que não ouvimos nosso próprio evento
      // nesta mesma aba — não precisa (e não deve) filtrar de novo por e-mail aqui,
      // senão duas abas do mesmo atendente nunca veem o indicador uma da outra.
      setOtherTyping({ name: payload?.name || 'Atendente' })
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current)
      typingClearTimeoutRef.current = setTimeout(() => setOtherTyping(null), 3500)
    })
    ch.on('broadcast', { event: 'typing_stop' }, () => {
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current)
      setOtherTyping(null)
    })
    ch.subscribe()
    typingChRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      typingChRef.current = null
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current)
    }
  }, [selected?.session_id, instance]) // eslint-disable-line react-hooks/exhaustive-deps

  function notifyTyping() {
    if (!typingChRef.current) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 1000) return
    lastTypingSentRef.current = now
    typingChRef.current.send({
      type: 'broadcast', event: 'typing',
      payload: { email: session?.user?.email, name: session?.user?.name },
    })
  }
  function notifyStopTyping() {
    if (!typingChRef.current) return
    typingChRef.current.send({
      type: 'broadcast', event: 'typing_stop',
      payload: { email: session?.user?.email },
    })
  }

  // Com a conversa aberta, começar a digitar em qualquer lugar da tela já escreve
  // na caixa de mensagem — sem precisar clicar nela antes, igual o "type to search" do Gmail.
  useEffect(() => {
    if (!selected) return
    function handleGlobalKeyDown(e) {
      if (closeModal || transferModal || contextMenu || chatTagPickerOpen || headerTagOpen) return
      if (sending || recording || !canRespond(selected)) return
      const active = document.activeElement
      const isEditable = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
      if (isEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.length !== 1) return // só teclas imprimíveis (letras/números/símbolos/espaço)
      e.preventDefault()
      setMsgText(prev => prev + e.key)
      notifyTyping()
      messageInputRef.current?.focus()
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selected, sending, recording, closeModal, transferModal, contextMenu, chatTagPickerOpen, headerTagOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    if (loadingMore || !hasMore || !selected || !instance || !messages.length) return
    const oldestId = messages[0].id
    const container = chatBodyRef.current
    const scrollHeightBefore = container?.scrollHeight || 0
    const scrollTopBefore    = container?.scrollTop    || 0
    setLoadingMore(true)
    const { data } = await supabase.from(CONV_TABLE).select('*')
      .eq('instancia', instance)
      .eq('numero', selected.session_id)
      .or('aplicativo.neq.instagram,aplicativo.is.null')
      .lt('id', oldestId)
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)
    const older = (data || []).filter(r => !isToolMessage(r)).reverse().map(mapRow)
    isLoadingMoreRef.current = true
    setMessages(prev => [...older, ...prev])
    setHasMore((data?.length || 0) === PAGE_SIZE)
    setLoadingMore(false)
    requestAnimationFrame(() => {
      if (container) container.scrollTop = scrollTopBefore + (container.scrollHeight - scrollHeightBefore)
    })
  }

  useEffect(() => {
    if (isLoadingMoreRef.current) { isLoadingMoreRef.current = false; return }
    if (!loadingMsgs) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingMsgs])

  // Fallback: busca só mensagens novas a cada 30s para cobrir falhas de Realtime
  useEffect(() => {
    if (!selected || !instance) return
    const interval = setInterval(() => {
      const maxId = maxMsgIdRef.current
      if (!maxId) return
      supabase.from(CONV_TABLE)
        .select('*')
        .eq('instancia', instance)
        .eq('numero', selected.session_id)
        .or('aplicativo.neq.instagram,aplicativo.is.null')
        .gt('id', maxId)
        .order('id', { ascending: true })
        .then(({ data }) => {
          if (!data || data.length === 0) return
          const fresh = data.filter(r => !isToolMessage(r)).map(mapRow)
          if (!fresh.length) return
          const sid = selected?.session_id
          if (sid && closedMapRef.current[sid]) reopenConversation(sid)
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id))
            const novo = fresh.filter(m => !ids.has(m.id))
            if (!novo.length) return prev
            const next = [...prev, ...novo]
            maxMsgIdRef.current = next[next.length - 1].id
            return next
          })
        })
    }, 30_000)
    return () => clearInterval(interval)
  }, [selected, instance])

  useEffect(() => {
    if (editingMsgId) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [editingMsgId])

  async function reopenConversation(sid) {
    await Promise.all([
      supabase.from('conversations').delete().eq('session_id', sid).eq('instancia', instance),
      supabase.from('attendances').delete().eq('numero', sid).eq('instancia', instance),
    ])
    setClosedMap(prev => { const n = { ...prev }; delete n[sid]; return n })
    setAttendancesMap(prev => { const n = { ...prev }; delete n[sid]; return n })
  }

  async function handleAssume(contact, e) {
    e?.stopPropagation()
    if (attendancesMap[contact.session_id] || assuming === contact.session_id) return
    setAssuming(contact.session_id)

    if (!checkSession()) { setAssuming(null); return }

    const name = session?.user?.name || 'Atendente'
    const sectorLabel = userSector ? ` (${userSector.name})` : ''

    const { error: insErr } = await supabase.from('attendances').insert({
      numero: contact.session_id,
      instancia: instance,
      sector_id: userSector?.id || null,
      sector_name: userSector?.name || null,
      sector_color: userSector?.color || '#6B7280',
      attendant_name: name,
      attendant_email: session?.user?.email,
      assumed_at: new Date().toISOString(),
    })

    if (insErr) {
      if (insErr.code === '23505') {
        const { data: holder } = await supabase.from('attendances')
          .select('attendant_name').eq('numero', contact.session_id).eq('instancia', instance).maybeSingle()
        setToast({ message: `Conversa já assumida por ${holder?.attendant_name || 'outro atendente'}.`, color: '#D97706' })
      } else {
        setToast({ message: 'Erro ao assumir: ' + insErr.message, color: '#DC2626' })
      }
      setTimeout(() => setToast(null), 3500)
      setAssuming(null)
      return
    }

    const assumeMsg = `▶ Atendimento assumido por ${name}${sectorLabel}`
    await supabase.rpc('send_mensagem_geral', {
      p_instancia: instance,
      p_numero: contact.session_id,
      p_mensagem: assumeMsg,
      p_type: 'sistema',
      p_hora: new Date().toISOString(),
    })

    setAttendancesMap(prev => ({
      ...prev,
      [contact.session_id]: {
        numero: contact.session_id, instancia: instance,
        sector_id: userSector?.id, sector_name: userSector?.name,
        sector_color: userSector?.color || '#6B7280',
        attendant_name: name, attendant_email: session?.user?.email,
      }
    }))
    setTab('meu-setor')
    setAssuming(null)
  }

  async function handleTransfer() {
    if (!transferModal || !transferringTo || transferring) return
    const target = companyUsers.find(u => u.email === transferringTo)
    if (!target) return
    setTransferring(true)

    // Tenta achar o setor do novo atendente
    const { data: memberData } = await supabase
      .from('sector_members')
      .select('sector_id, sectors(id, name, color)')
      .eq('user_id', target.id)
      .maybeSingle()
    const targetSector = memberData?.sectors || null

    const updated = {
      attendant_name: target.name,
      attendant_email: target.email,
      sector_id:    targetSector?.id ?? null,
      sector_name:  targetSector?.name ?? null,
      sector_color: targetSector?.color ?? '#6B7280',
    }

    const { error } = await supabase
      .from('attendances')
      .update(updated)
      .eq('numero', transferModal.session_id)
      .eq('instancia', instance)

    if (error) {
      setTransferring(false)
      setToast({ message: 'Erro ao transferir: ' + error.message, color: '#DC2626' })
      setTimeout(() => setToast(null), 3500)
      return
    }

    // Mensagem-marco no histórico
    const meName = session?.user?.name || 'Atendente'
    const handoverMsg = `↪ Atendimento transferido por ${meName} para ${target.name}`
    await supabase.rpc('send_mensagem_geral', {
      p_instancia: instance,
      p_numero: transferModal.session_id,
      p_mensagem: handoverMsg,
      p_type: 'atendente',
      p_hora: new Date().toISOString(),
    })

    setAttendancesMap(prev => ({
      ...prev,
      [transferModal.session_id]: {
        ...(prev[transferModal.session_id] || {}),
        ...updated,
      },
    }))
    setTransferring(false)
    setTransferModal(null)
    setTransferringTo('')
    setToast({ message: `Conversa transferida pra ${target.name}`, color: '#7C3AED' })
    setTimeout(() => setToast(null), 3500)
  }

  async function startRecording() {
    if (recording) return
    try {
      // Grava direto em Ogg/Opus (via WASM), formato exigido pela WhatsApp Cloud API.
      // MediaRecorder nativo produz WebM/Opus no Chrome, que a Cloud API rejeita.
      const rec = new Recorder({
        encoderPath: '/encoderWorker.min.js',
        numberOfChannels: 1,
        encoderSampleRate: 16000,
        streamPages: false,
      })
      mediaRecorderRef.current = rec
      await rec.start()
      recordStartRef.current = Date.now()
      setRecording(true)
      setRecordTime(0)
      recordTimerRef.current = setInterval(() => {
        setRecordTime(Math.floor((Date.now() - recordStartRef.current) / 1000))
      }, 500)
    } catch (e) {
      console.error('Erro ao acessar microfone:', e)
      setToast({ message: 'Não foi possível acessar o microfone', color: '#DC2626' })
      setTimeout(() => setToast(null), 3000)
    }
  }

  function stopRecording({ persistPreview = true } = {}) {
    return new Promise(resolve => {
      const rec = mediaRecorderRef.current
      if (!rec) return resolve(null)
      rec.ondataavailable = typedArray => {
        const bytes = typedArray instanceof Uint8Array ? typedArray : new Uint8Array(typedArray)
        let bin = ''
        const chunk = 0x8000
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
        }
        const base64 = btoa(bin)
        const duration = Math.floor((Date.now() - recordStartRef.current) / 1000)
        const audioData = { base64, mime: 'audio/ogg; codecs=opus', duration }
        if (persistPreview) setRecordedAudio(audioData)
        rec.close()
        resolve(audioData)
      }
      rec.stop()
      if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
      setRecording(false)
    })
  }

  function discardAudio() {
    setRecordedAudio(null)
    setRecordTime(0)
  }

  async function handlePickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const MAX = 15 * 1024 * 1024 // 15 MB
    if (file.size > MAX) {
      setToast({ message: 'Arquivo muito grande (máx 15 MB)', color: '#DC2626' })
      setTimeout(() => setToast(null), 3000)
      return
    }
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    const base64 = btoa(bin)
    const kind = file.type.startsWith('image/') ? 'image'
      : file.type === 'application/pdf' ? 'pdf'
      : 'file'
    setAttachedFile({ base64, mime: file.type || 'application/octet-stream', name: file.name, size: file.size, kind })
  }

  function discardFile() {
    setAttachedFile(null)
  }

  // Helper: usuário atual pode responder essa conversa?
  // Regra: dono da conversa OU admin OU conversa ainda sem atendimento.
  function canRespond(contact) {
    if (!contact) return false
    if (closedMap[contact.session_id]) return false
    const att = attendancesMap[contact.session_id]
    if (!att) return true
    if (isAdmin) return true
    return att.attendant_email === session?.user?.email
  }

  async function handleSend() {
    if (sending || !selected) return
    if (!checkSession()) return
    notifyStopTyping()
    if (!canRespond(selected)) {
      const att = attendancesMap[selected.session_id]
      setToast({
        message: `Conversa em atendimento por ${att?.attendant_name || 'outro atendente'}. Peça pra ele transferir ou finalize antes.`,
        color: '#DC2626',
      })
      setTimeout(() => setToast(null), 4000)
      return
    }
    let audio = recordedAudio
    if (recording) {
      audio = await stopRecording({ persistPreview: false })
    }
    if (!msgText.trim() && !audio && !attachedFile) return
    setSending(true)
    try {
      // Auto-assume se ainda não está atribuído a ninguém
      if (!attendancesMap[selected.session_id] && !closedMap[selected.session_id]) {
        const name = session?.user?.name || 'Atendente'
        const newAtt = {
          numero: selected.session_id, instancia: instance,
          sector_id: userSector?.id || null,
          sector_name: userSector?.name || null,
          sector_color: userSector?.color || '#6B7280',
          attendant_name: name, attendant_email: session?.user?.email,
          assumed_at: new Date().toISOString(),
        }
        const { error: attErr } = await supabase.from('attendances').insert(newAtt)
        if (!attErr) {
          setAttendancesMap(prev => ({ ...prev, [selected.session_id]: newAtt }))
          setTab('meu-setor')
        }
        // 23505 = alguém assumiu exatamente ao mesmo tempo — não bloqueia o envio
      }
      const text = msgText.trim()
      const file = attachedFile
      setMsgText('')
      setRecordedAudio(null)
      setRecordTime(0)
      setAttachedFile(null)

      const filePrefix = file
        ? (file.kind === 'image' ? '🖼️ ' : file.kind === 'pdf' ? '📄 ' : '📎 ') + file.name
        : null
      const mensagemPayload = audio
        ? (text || '🎤 Áudio')
        : file
          ? (text ? `${filePrefix}\n${text}` : filePrefix)
          : text
      const mediaBase64 = audio?.base64 || file?.base64 || null
      // Type da mensagem no padrão da WhatsApp Cloud API (usado pelo n8n quando whatsapp_api_type = 'oficial')
      const messageType = audio ? 'audio' : file ? (file.kind === 'image' ? 'image' : 'document') : 'text'
      const { error: insErr } = await supabase.rpc('send_mensagem_geral', {
        p_instancia: instance,
        p_numero: selected.session_id,
        p_mensagem: mensagemPayload,
        p_type: 'atendente',
        p_hora: new Date().toISOString(),
        p_base64: mediaBase64,
      })
      if (insErr) {
        console.error('send_mensagem_geral:', insErr)
      } else {
        // Busca de volta a mensagem recém-inserida pra exibir na hora — não dá pra
        // confiar só no Realtime aqui: anexos grandes (áudio/PDF em base64) podem
        // estourar o limite de payload do canal e chegar sem o conteúdo (bolha vazia).
        const { data: justSent } = await supabase
          .from(CONV_TABLE).select('*')
          .eq('instancia', instance)
          .eq('numero', selected.session_id)
          .eq('mensagem', mensagemPayload)
          .eq('type', 'atendente')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (justSent) {
          setMessages(prev => {
            if (prev.some(m => m.id === justSent.id)) return prev
            maxMsgIdRef.current = Math.max(maxMsgIdRef.current, justSent.id)
            return [...prev, mapRow(justSent)]
          })
        }
      }

      fetch(sendWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          type: messageType,
          audio_base64: audio?.base64 || null,
          audio_mime: audio?.mime || null,
          audio_duration: audio?.duration || null,
          file_base64: file?.base64 || null,
          file_mime: file?.mime || null,
          file_name: file?.name || null,
          file_kind: file?.kind || null,
          session_id: selected.session_id,
          phone: selected.phone,
          instancia: instance,
          api_instancia: apiInstancia,
          ai_enabled: session?.company?.ai_enabled !== false,
          company: session?.company?.name,
          sender_name: session?.user?.name,
          sender_email: session?.user?.email,
        }),
      })
        .then(r => r.text())
        .then(async text => {
          const [instResp, msgResp, msgId] = text.trim().split('\n').map(l => l.trim())
          if (!msgId || !instResp || !msgResp) return
          const { data: row } = await supabase
            .from('mensagens_geral')
            .select('id')
            .eq('instancia', instResp)
            .eq('numero', selected.session_id)
            .eq('mensagem', msgResp)
            .eq('type', 'atendente')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (row?.id) {
            supabase.from('mensagens_geral')
              .update({ id_mensagem: msgId })
              .eq('id', row.id)
              .then(() => {
                setMessages(prev => prev.map(m => m.id === row.id ? { ...m, id_mensagem: msgId } : m))
              })
          }
        })
        .catch(e => console.warn('webhook envio:', e))
    } finally {
      setSending(false)
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocErr('Seu navegador não suporta geolocalização.')
      return
    }
    setLocErr('')
    setGettingGeo(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocInput(`${pos.coords.latitude}, ${pos.coords.longitude}`)
        setGettingGeo(false)
      },
      (err) => {
        setLocErr('Não foi possível obter sua localização: ' + err.message)
        setGettingGeo(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleSendLocation() {
    if (sendingLocation || !selected) return
    if (!checkSession()) return
    const coords = parseLocationInput(locInput)
    if (!coords) {
      setLocErr('Cole um link do Google Maps ou coordenadas no formato "lat, lng".')
      return
    }
    if (!canRespond(selected)) {
      const att = attendancesMap[selected.session_id]
      setToast({
        message: `Conversa em atendimento por ${att?.attendant_name || 'outro atendente'}. Peça pra ele transferir ou finalize antes.`,
        color: '#DC2626',
      })
      setTimeout(() => setToast(null), 4000)
      return
    }
    setLocErr('')
    setSendingLocation(true)
    try {
      const name = locName.trim()
      const address = locAddress.trim()
      const mensagemPayload = `📍 ${name || 'Localização'}`
      const { error: insErr } = await supabase.rpc('send_mensagem_geral', {
        p_instancia: instance,
        p_numero: selected.session_id,
        p_mensagem: mensagemPayload,
        p_type: 'atendente',
        p_hora: new Date().toISOString(),
        p_base64: null,
      })
      if (insErr) {
        console.error('send_mensagem_geral (location):', insErr)
      } else {
        const { data: justSent } = await supabase
          .from(CONV_TABLE).select('*')
          .eq('instancia', instance)
          .eq('numero', selected.session_id)
          .eq('mensagem', mensagemPayload)
          .eq('type', 'atendente')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (justSent) {
          const locationData = { lat: coords.lat, lng: coords.lng, name: name || null, address: address || null }
          // Coluna `location` é opcional (migration 20260724) — se ainda não existir no banco,
          // o envio segue funcionando normalmente, só sem o card bonito (mostra o texto acima).
          try {
            await supabase.from(CONV_TABLE).update({ location: locationData }).eq('id', justSent.id)
          } catch { /* coluna ainda não migrada — ok, ignora */ }
          setMessages(prev => {
            if (prev.some(m => m.id === justSent.id)) return prev
            maxMsgIdRef.current = Math.max(maxMsgIdRef.current, justSent.id)
            return [...prev, mapRow({ ...justSent, location: locationData })]
          })
        }
      }

      const isGroup = !!selected.isGroup
      const locationWebhookUrl = isOfficialApi ? sendWebhookUrl : 'https://n8n.nexladesenvolvimento.com.br/webhook/locamed'
      fetch(locationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: isGroup ? selected.session_id : selected.phone,
          session_id: selected.session_id,
          ...(isGroup ? { idgrupo: selected.session_id } : {}),
          instancia: instance,
          api_instancia: apiInstancia,
          latitude: coords.lat,
          longitude: coords.lng,
          name: name || null,
          address: address || null,
          type: 'location',
          ai_enabled: session?.company?.ai_enabled !== false,
          company: session?.company?.name,
          sender_name: session?.user?.name,
          sender_email: session?.user?.email,
        }),
      })
        .then(r => r.text())
        .then(async text => {
          const [instResp, msgResp, msgId] = text.trim().split('\n').map(l => l.trim())
          if (!msgId || !instResp || !msgResp) return
          const { data: row } = await supabase
            .from('mensagens_geral')
            .select('id')
            .eq('instancia', instResp)
            .eq('numero', selected.session_id)
            .eq('mensagem', msgResp)
            .eq('type', 'atendente')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (row?.id) {
            supabase.from('mensagens_geral')
              .update({ id_mensagem: msgId })
              .eq('id', row.id)
              .then(() => {
                setMessages(prev => prev.map(m => m.id === row.id ? { ...m, id_mensagem: msgId } : m))
              })
          }
        })
        .catch(e => console.warn('webhook envio localização:', e))

      setLocationModal(false)
      setLocInput('')
      setLocName('')
      setLocAddress('')
    } finally {
      setSendingLocation(false)
    }
  }

  // Abre, dentro da própria plataforma, a conversa do número de um contato compartilhado
  // no chat — não navega pro WhatsApp externo. Se ainda não existir conversa com esse
  // número, cria uma entrada "vazia" pra o atendente já poder iniciar o atendimento nela
  // (mesmo padrão usado pelo link ?contact= vindo da página de Contatos).
  function openContactConversation(phoneDigits) {
    if (!phoneDigits) return
    const sessionId = isOfficialApi ? phoneDigits : `${phoneDigits}@s.whatsapp.net`
    const existing = contacts.find(c => c.session_id === sessionId || c.phone === phoneDigits)
    if (existing) {
      setSelected(existing)
      if (closedMap[existing.session_id]) setTab('finalizados')
      else if (attendancesMap[existing.session_id]) setTab('meu-setor')
      else setTab('recepcao')
    } else {
      const synthetic = { session_id: sessionId, phone: phoneDigits, lastTs: null }
      setContacts(prev => [synthetic, ...prev])
      setSelected(synthetic)
      setTab('recepcao')
    }
  }

  async function handleSaveEdit(msg) {
    const newText = editingText.trim()
    if (!newText || savingEdit) return
    setSavingEdit(true)
    try {
      const { data: fresh } = await supabase
        .from('mensagens_geral')
        .select('id_mensagem')
        .eq('id', msg.id)
        .maybeSingle()
      const id_mensagem = fresh?.id_mensagem || msg.id_mensagem

      const res = await fetch('https://n8n.nexladesenvolvimento.com.br/webhook/envioNexlaeditar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: msg.id,
          id_mensagem,
          message: newText,
          session_id: selected?.session_id,
          phone: selected?.phone,
          instancia: instance,
          api_instancia: apiInstancia,
          ai_enabled: session?.company?.ai_enabled !== false,
          company: session?.company?.name,
          sender_name: session?.user?.name,
          sender_email: session?.user?.email,
        }),
      })
      if (!res.ok) throw new Error('status ' + res.status)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: newText } : m))
      setEditingMsgId(null)
      setEditingText('')
      setToast({ message: 'Mensagem editada', color: '#16A34A' })
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast({ message: 'Erro ao editar: ' + e.message, color: '#DC2626' })
      setTimeout(() => setToast(null), 3500)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleReopen(contact) {
    if (!contact || !instance) return
    await supabase.from('conversations').delete().eq('session_id', contact.session_id).eq('instancia', instance)
    await supabase.from('attendances').delete().eq('numero', contact.session_id).eq('instancia', instance)
    setClosedMap(prev => { const n = { ...prev }; delete n[contact.session_id]; return n })
    setAttendancesMap(prev => { const n = { ...prev }; delete n[contact.session_id]; return n })
    setTab('recepcao')
    setToast({ message: 'Conversa reaberta', color: '#16A34A' })
    setTimeout(() => setToast(null), 2500)
  }

  async function handleClose() {
    if (!reason || !closeModal) return
    if (!checkSession()) return
    setClosing(true)
    const targets = closeModal.bulk ? closeModal.contacts : [closeModal]
    const closedAt = new Date().toISOString()
    const results = await Promise.all(targets.map(t =>
      supabase.from('conversations').insert({
        session_id: t.session_id, instancia: instance, reason, closed_at: closedAt,
      })
    ))
    setClosing(false)
    if (results.some(r => r.error)) return
    const closedIds = targets.map(t => t.session_id)
    setClosedMap(prev => { const n = { ...prev }; closedIds.forEach(id => { n[id] = reason }); return n })
    await Promise.all(closedIds.map(id => supabase.from('attendances').delete().eq('numero', id).eq('instancia', instance)))
    setAttendancesMap(prev => { const n = { ...prev }; closedIds.forEach(id => delete n[id]); return n })
    if (selected && closedIds.includes(selected.session_id)) setSelected(null)
    setCloseModal(null)
    setReason('')
    setSelectedIds(new Set())
    setTab('finalizados')
    const label = REASONS.find(r => r.value === reason)?.label || reason
    const count = closedIds.length
    setToast({
      message: count > 1 ? `${count} conversas finalizadas — ${label}` : `Conversa finalizada — ${label}`,
      color: REASONS.find(r => r.value === reason)?.color || '#16A34A',
    })
    setTimeout(() => setToast(null), 3500)
  }

  function toggleSelect(sid) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(sid) ? n.delete(sid) : n.add(sid)
      return n
    })
  }

  function handleBulkMarkRead() {
    setUnreadMap(prev => {
      const n = { ...prev }
      selectedIds.forEach(sid => delete n[sid])
      return n
    })
    setSelectedIds(new Set())
  }

  function handleBulkFinalize(contactsToClose) {
    setCloseModal({ bulk: true, contacts: contactsToClose })
    setReason('')
  }

  // Busca por conteúdo de mensagem (com debounce de 400ms)
  const hasLetters = /[a-zA-ZÀ-ú]/.test(search)
  useEffect(() => {
    if (!instance) return
    if (!hasLetters) { setMsgMatchNums(null); return }
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('mensagens_geral')
        .select('numero')
        .eq('instancia', instance)
        .ilike('mensagem', `%${search}%`)
      const nums = new Set((data || []).map(r => r.numero.replace(/\D/g, '')))
      setMsgMatchNums(nums)
    }, 400)
    return () => clearTimeout(searchDebounce.current)
  }, [search, instance, hasLetters])

  const closed = new Set(Object.keys(closedMap))
  const recepcao    = contacts.filter(c => !closed.has(c.session_id) && !attendancesMap[c.session_id])
  const meuSetor    = contacts.filter(c => !closed.has(c.session_id) && attendancesMap[c.session_id] &&
    (isAdmin || !userSector || attendancesMap[c.session_id].sector_id === userSector.id))
  const finalizados = contacts.filter(c => closed.has(c.session_id))

  const tabList = [
    { id: 'recepcao',    label: 'Recepção',              icon: Inbox,      count: recepcao.length },
    { id: 'meu-setor',  label: isAdmin ? 'Setores' : 'Meu setor', icon: UserCheck, count: meuSetor.length },
    { id: 'finalizados', label: 'Finalizados',            icon: Archive,    count: finalizados.length },
  ]

  const currentList = tab === 'recepcao' ? recepcao : tab === 'meu-setor' ? meuSetor : finalizados
  const cleanSearch = search.replace(/\D/g, '')
  const searchLc = search.trim().toLowerCase()
  const filtered = currentList.filter(c => {
    if (searchLc) {
      const nameMatch = getContactName(c).toLowerCase().includes(searchLc)
      const phoneMatch = cleanSearch.length > 0 && c.phone.replace(/\D/g, '').includes(cleanSearch)
      const msgMatch = hasLetters && !!msgMatchNums?.has(c.phone.replace(/\D/g, ''))
      if (!nameMatch && !phoneMatch && !msgMatch) return false
    }
    if (tagFilter) {
      const cleanNum = c.phone.replace(/\D/g, '')
      const saved = savedContacts[cleanNum]
      if (!saved) return false
      const cTags = tagsByContact[saved.id] || []
      return cTags.some(t => t.id === tagFilter)
    }
    return true
  })
  const isClosed = selected ? closed.has(selected.session_id) : false

  return (
    <div className={`contacts-root${selected ? ' chat-active' : ''}`}>
      <div className="contacts-list">
        {/* Abas */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          {tabList.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelected(null); setTagFilter(null); setSelectedIds(new Set()) }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === t.id ? '2px solid #2563EB' : '2px solid transparent',
                color: tab === t.id ? '#2563EB' : 'var(--text-muted)',
                fontSize: 11, fontWeight: tab === t.id ? 700 : 500,
                transition: 'all 0.15s',
              }}
            >
              <t.icon size={14} />
              {t.label}
              {t.count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 20, padding: '0 4px',
                  background: tab === t.id ? '#2563EB' : '#E2E8F0',
                  color: tab === t.id ? '#fff' : 'var(--text-muted)',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="contacts-list-header" style={{ paddingTop: 10 }}>
          <input
            className="contacts-search"
            placeholder="Buscar por nome, telefone ou mensagem..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap', overflowX: 'auto', marginTop: 8, paddingBottom: 2 }}>
              <button
                onClick={() => setTagFilter(null)}
                style={{
                  flexShrink: 0, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  border: `1px solid ${tagFilter === null ? '#2563EB' : 'var(--border)'}`,
                  background: tagFilter === null ? '#EFF6FF' : 'transparent',
                  color: tagFilter === null ? '#2563EB' : 'var(--text-muted)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >Todas</button>
              {tags.map(t => (
                <button key={t.id}
                  onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
                  style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    border: `1px solid ${tagFilter === t.id ? t.cor : 'var(--border)'}`,
                    background: tagFilter === t.id ? t.cor + '22' : 'transparent',
                    color: tagFilter === t.id ? t.cor : 'var(--text-muted)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.cor, flexShrink: 0 }} />
                  {t.nome}
                </button>
              ))}
            </div>
          )}
          {filtered.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {selectedIds.size > 0 ? (
                <>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedIds.size} selecionada(s)
                  </span>
                  <button onClick={handleBulkMarkRead}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', cursor: 'pointer' }}>
                    <CheckCheck size={12} /> Marcar como lida
                  </button>
                  {tab !== 'finalizados' && (
                    <button onClick={() => handleBulkFinalize(filtered.filter(c => selectedIds.has(c.session_id)))}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', cursor: 'pointer' }}>
                      <CheckCircle2 size={12} /> Finalizar selecionadas
                    </button>
                  )}
                  <button onClick={() => setSelectedIds(new Set())}
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={filtered.every(c => selectedIds.has(c.session_id))}
                    onChange={() => setSelectedIds(filtered.every(c => selectedIds.has(c.session_id)) ? new Set() : new Set(filtered.map(c => c.session_id)))}
                  />
                  Selecionar todas
                </label>
              )}
            </div>
          )}
        </div>

        <div className="contacts-list-body">
          {loadingContacts && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
          )}
          {!loadingContacts && filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhuma conversa aqui.
            </div>
          )}
          {filtered.map(c => {
            const att = attendancesMap[c.session_id]
            const isAssuming = assuming === c.session_id
            const closedReason = closedMap[c.session_id]
            const rs = closedReason ? REASONS.find(r => r.value === closedReason) : null
            const cleanNum = c.phone.replace(/\D/g, '')
            const saved = savedContacts[cleanNum]
            const nextAppt = futureAppts[cleanNum]
            return (
              <div
                key={c.session_id}
                className={`contact-item ${selected?.session_id === c.session_id ? 'selected' : ''}`}
                onClick={() => { setSelected(c); setUnreadMap(prev => { const n = { ...prev }; delete n[c.session_id]; return n }) }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ x: e.clientX, y: e.clientY, contact: c })
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.session_id)}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); toggleSelect(c.session_id) }}
                  style={{ flexShrink: 0, cursor: 'pointer' }}
                />
                <div className="contact-avatar" style={saved?.photo ? { background: 'transparent', overflow: 'hidden' } : c.isGroup ? { background: '#EDE9FE' } : {}}>
                  {saved?.photo
                    ? <img src={saved.photo} alt={saved.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : c.isGroup
                      ? <Users size={14} style={{ color: '#7C3AED' }} />
                      : getContactName(c) !== c.phone
                        ? <span style={{ fontWeight: 700, fontSize: 12, color: '#2563EB' }}>{getContactName(c).charAt(0).toUpperCase()}</span>
                        : <User size={14} style={{ opacity: 0.4 }} />}
                </div>
                <div className="contact-info" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <div className="contact-name" style={getContactName(c) !== c.phone ? { fontWeight: 600 } : {}}>
                      {getContactName(c)}
                    </div>
                    {c.isGroup && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', border: '1px solid #DDD6FE', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>GRUPO</span>
                    )}
                    {!c.isGroup && getContactName(c) !== c.phone && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.phone}</span>
                    )}
                    {saved && (tagsByContact[saved.id] || []).map(t => (
                      <span key={t.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700,
                        background: t.cor + '22', border: `1px solid ${t.cor}55`,
                        color: t.cor, lineHeight: '16px', flexShrink: 0,
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: t.cor }} />
                        {t.nome}
                      </span>
                    ))}
                    {nextAppt && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                        color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE',
                        lineHeight: '16px',
                      }}>
                        <Calendar size={9} /> {formatApptShort(nextAppt.starts_at)}
                      </span>
                    )}
                    {tab === 'recepcao' && c.outsideAssumed && (
                      <span title="Alguém respondeu direto pelo WhatsApp, fora da plataforma" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', lineHeight: '16px' }}>
                        <PhoneCall size={9} /> Atendido fora
                      </span>
                    )}
                    {tab === 'recepcao' && aiEnabled && !c.outsideAssumed && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', lineHeight: '16px' }}>
                        <Sparkles size={9} /> IA
                      </span>
                    )}
                    {tab === 'meu-setor' && att && (
                      <>
                        {att.sector_name && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color: '#fff', background: att.sector_color || '#6B7280', lineHeight: '16px' }}>
                            {att.sector_name}
                          </span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', lineHeight: '16px' }}>
                          <Headset size={9} /> {att.attendant_name?.split(' ')[0]}
                        </span>
                      </>
                    )}
                    {tab === 'finalizados' && rs && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color: rs.color, background: rs.bg, border: `1px solid ${rs.border}`, lineHeight: '16px' }}>{rs.label}</span>
                    )}
                  </div>
                  {c.lastMsgPreview && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMsgPreview}
                    </div>
                  )}
                  {tab === 'recepcao' && (
                    <button
                      onClick={e => handleAssume(c, e)}
                      disabled={isAssuming}
                      style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', opacity: isAssuming ? 0.6 : 1 }}
                    >
                      <Headset size={10} />
                      {isAssuming ? 'Assumindo...' : 'Assumir atendimento'}
                    </button>
                  )}
                </div>
                <div className="contact-meta">
                  {c.lastTs && <div className="contact-time">{formatContactTime(c.lastTs, companyTz)}</div>}
                  {unreadMap[c.session_id] > 0 && (
                    <div style={{
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: '#16A34A', color: '#fff',
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px', marginTop: 4,
                    }}>
                      {unreadMap[c.session_id] > 99 ? '99+' : unreadMap[c.session_id]}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="chat-panel">
        {!selected ? (
          <div className="chat-empty">
            <MessageSquare size={32} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 14 }}>Selecione uma conversa</div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <button className="chat-back-btn" onClick={() => setSelected(null)} aria-label="Voltar">
                <ChevronLeft size={15} />
                Voltar
              </button>
              {(() => {
                const cleanNum = selected.phone.replace(/\D/g, '')
                const saved = savedContacts[cleanNum]
                return (
                  <>
                    <div className="contact-avatar"
                      style={{
                        width: 38, height: 38,
                        background: saved?.photo ? 'transparent' : undefined,
                        overflow: 'hidden',
                        cursor: saved ? 'pointer' : 'default',
                      }}
                      onClick={() => saved && navigate(`/painel/contatos/${saved.id}`)}
                      title={saved ? 'Abrir ficha do paciente' : ''}
                    >
                      {saved?.photo
                        ? <img src={saved.photo} alt={saved.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : getContactName(selected) !== selected.phone
                          ? <span style={{ fontWeight: 700, fontSize: 14, color: '#2563EB' }}>{getContactName(selected).charAt(0).toUpperCase()}</span>
                          : <User size={14} style={{ opacity: 0.4 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)', cursor: saved ? 'pointer' : 'default' }}
                        onClick={() => saved && navigate(`/painel/contatos/${saved.id}`)}
                      >
                        {getContactName(selected)}
                      </div>
                      <div style={{ fontSize: 12, color: otherTyping ? '#16A34A' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {otherTyping ? (
                          <span style={{ fontStyle: 'italic', fontWeight: 600 }}>{otherTyping.name} está digitando...</span>
                        ) : (
                          <>
                            {getContactName(selected) !== selected.phone && <span style={{ fontFamily: 'monospace' }}>{selected.phone}</span>}
                            {!loadingMsgs && <span>{messages.length} mensagem(ns)</span>}
                          </>
                        )}
                      </div>
                      {saved && (() => {
                        const patTags = tagsByContact[saved.id] || []
                        const unassigned = tags.filter(t => !patTags.some(pt => pt.id === t.id))
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' }}
                            onClick={e => e.stopPropagation()}>
                            {patTags.map(t => (
                              <span key={t.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                                background: t.cor + '22', border: `1px solid ${t.cor}55`,
                                color: t.cor, lineHeight: '16px',
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.cor }} />
                                {t.nome}
                                <span onClick={() => removeTag(saved.id, t.id)}
                                  style={{ cursor: 'pointer', opacity: 0.6, display: 'inline-flex', alignItems: 'center', marginLeft: 1 }}>
                                  <X size={9} />
                                </span>
                              </span>
                            ))}
                            {unassigned.length > 0 && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => setChatTagPickerOpen(p => !p)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                                    background: 'transparent', border: '1px dashed var(--border)',
                                    color: 'var(--text-muted)', cursor: 'pointer', lineHeight: '16px',
                                  }}>
                                  <Plus size={9} /> Etiqueta
                                </button>
                                {chatTagPickerOpen && (
                                  <div style={{
                                    position: 'absolute', top: '100%', left: 0, zIndex: 300,
                                    background: '#fff', border: '1px solid var(--border)',
                                    borderRadius: 10, marginTop: 4, padding: 6,
                                    boxShadow: '0 8px 24px -8px rgba(15,14,27,0.18)',
                                    minWidth: 150,
                                  }}>
                                    {unassigned.map(t => (
                                      <button key={t.id}
                                        onClick={() => { addTag(saved.id, t.id); setChatTagPickerOpen(false) }}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 7,
                                          width: '100%', padding: '6px 10px',
                                          border: 'none', background: 'transparent',
                                          cursor: 'pointer', borderRadius: 7, fontSize: 12,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                      >
                                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.cor, flexShrink: 0 }} />
                                        {t.nome}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </>
                )
              })()}
              {!isClosed && (() => {
                const cleanNum = selected.phone.replace(/\D/g, '')
                const saved = savedContacts[cleanNum]
                const nome = saved?.nome || ''
                const hasContact = !!saved
                return (
                  <>
                    <button
                      className="nx-btn-ghost"
                      style={{
                        fontSize: 12, padding: '7px 14px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: hasContact ? '#16A34A' : '#C9A074',
                        borderColor: hasContact ? '#BBF7D0' : '#F0E0B6',
                        background: hasContact ? '#F0FDF4' : '#FFFBEB',
                      }}
                      title={hasContact ? `Já salvo como ${saved.nome}` : 'Salvar contato pra aparecer com nome'}
                      onClick={() => openSaveContact(selected)}
                    >
                      {hasContact ? <UserCheck size={14} /> : <UserPlus size={14} />}
                      {hasContact ? `Editar ${saved.nome}` : 'Salvar contato'}
                    </button>
                    {(() => {
                      const patTags = saved ? (tagsByContact[saved.id] || []) : []
                      const unassigned = saved ? tags.filter(t => !patTags.some(pt => pt.id === t.id)) : []
                      return (
                        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="nx-btn-ghost"
                            style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, color: '#0891B2' }}
                            onClick={() => setHeaderTagOpen(p => !p)}
                          >
                            <BookUser size={14} /> Etiqueta
                            {patTags.length > 0 && (
                              <span style={{ background: '#0891B2', color: '#fff', borderRadius: 20, fontSize: 10, padding: '0 5px', fontWeight: 700 }}>
                                {patTags.length}
                              </span>
                            )}
                          </button>
                          {headerTagOpen && (
                            <div style={{
                              position: 'absolute', top: '100%', right: 0, zIndex: 400, minWidth: 180,
                              background: '#fff', border: '1px solid var(--border)',
                              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 6,
                            }}>
                              {!saved ? (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px', margin: 0 }}>
                                  Salve o contato primeiro para adicionar etiquetas
                                </p>
                              ) : (
                                <>
                                  {patTags.map(t => (
                                    <button key={t.id} onClick={() => removeTag(saved.id, t.id)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6, fontSize: 12, color: '#374151' }}>
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                                      {t.name}
                                      <X size={10} style={{ marginLeft: 'auto', color: '#9CA3AF' }} />
                                    </button>
                                  ))}
                                  {unassigned.map(t => (
                                    <button key={t.id} onClick={() => { addTag(saved.id, t.id); setHeaderTagOpen(false) }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6, fontSize: 12, color: '#374151' }}>
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                                      {t.name}
                                      <Plus size={10} style={{ marginLeft: 'auto', color: '#9CA3AF' }} />
                                    </button>
                                  ))}
                                  {tags.length === 0 && (
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px', margin: 0 }}>Nenhuma etiqueta criada</p>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    <button
                      className="nx-btn-ghost"
                      style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, color: '#7C3AED' }}
                      onClick={() => navigate(`/painel/agenda?numero=${cleanNum}${nome ? `&nome=${encodeURIComponent(nome)}` : ''}`)}
                    >
                      <Calendar size={14} /> Agendar
                    </button>
                    {(() => {
                      const att = attendancesMap[selected.session_id]
                      const isOwner = att && att.attendant_email === session?.user?.email
                      if (!att || (!isOwner && !isAdmin)) return null
                      return (
                        <button
                          className="nx-btn-ghost"
                          style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, color: '#0891B2' }}
                          onClick={() => { setTransferModal(selected); setTransferringTo('') }}
                          title="Passar essa conversa pra outro atendente"
                        >
                          <ArrowRightLeft size={14} /> Transferir
                        </button>
                      )
                    })()}
                    {(() => {
                      const att = attendancesMap[selected.session_id]
                      const isOwner = !att || isAdmin || att.attendant_email === session?.user?.email
                      if (!isOwner) return null
                      return (
                        <button
                          className="nx-btn-ghost"
                          style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => { setCloseModal(selected); setReason('') }}
                        >
                          <CheckCircle2 size={14} /> Finalizar conversa
                        </button>
                      )
                    })()}
                  </>
                )
              })()}
              {isClosed && (() => {
                const rs = REASONS.find(r => r.value === closedMap[selected.session_id])
                return rs ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                    color: rs.color, background: rs.bg, border: `1px solid ${rs.border}`,
                  }}>{rs.label}</span>
                ) : null
              })()}
            </div>

            {/* Banner: conversa assumida por outro atendente (não-dono e não-admin) */}
            {(() => {
              if (isClosed) return null
              const att = attendancesMap[selected.session_id]
              if (!att) return null
              const isOwner = att.attendant_email === session?.user?.email
              if (isOwner || isAdmin) return null
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  background: 'linear-gradient(90deg, #FEF3C7 0%, #FED7AA 100%)',
                  borderBottom: '1px solid #FDBA74',
                  padding: '10px 20px', flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400E' }}>
                    <Lock size={14} style={{ color: '#D97706' }} />
                    <span>
                      Conversa em atendimento por <strong>{att.attendant_name}</strong> — você não pode responder.
                      Peça pra ele <strong>transferir</strong> ou aguarde a conversa ser finalizada pra abrir novo ticket.
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Banner Recepção: botão assumir
                Nova lógica: se já tem mensagem de atendente/humano no histórico,
                significa que alguém respondeu por fora (direto no WhatsApp) — mostra
                aviso laranja em vez do banner azul "sob IA". */}
            {(() => {
              if (isClosed || attendancesMap[selected.session_id]) return null
              const respondidaPorFora = messages.some(m => {
                const t = (m.type || '').toLowerCase()
                return t === 'atendente' || t === 'humano'
              })
              if (respondidaPorFora) {
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(90deg, #FFFBEB 0%, #FEF3C7 100%)',
                    borderBottom: '1px solid #FDE68A',
                    padding: '10px 20px', flexShrink: 0, gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400E' }}>
                      <PhoneCall size={15} style={{ color: '#D97706' }} />
                      <span>Conversa atendida <strong>direto no WhatsApp</strong> (fora da plataforma) — IA não está mais respondendo</span>
                    </div>
                    <button
                      onClick={e => handleAssume(selected, e)}
                      disabled={assuming === selected.session_id}
                      title="Trazer essa conversa pro seu setor pra continuar dentro da plataforma"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        background: 'transparent', color: '#92400E',
                        border: '1.5px solid #D97706',
                        borderRadius: 8, padding: '8px 16px',
                        fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                        opacity: assuming === selected.session_id ? 0.6 : 1,
                        flexShrink: 0,
                      }}>
                      <UserCheck size={14} />
                      {assuming === selected.session_id ? 'Trazendo...' : 'Trazer pro meu setor'}
                    </button>
                  </div>
                )
              }
              return (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: aiEnabled ? '#EFF6FF' : '#F8FAFC',
                borderBottom: `1px solid ${aiEnabled ? '#BFDBFE' : 'var(--border)'}`,
                padding: '10px 20px', flexShrink: 0, gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: aiEnabled ? '#1E40AF' : 'var(--text-secondary)' }}>
                  {aiEnabled ? (
                    <>
                      <Sparkles size={15} style={{ color: '#2563EB' }} />
                      <span>Conversa sob atendimento da <strong>IA</strong></span>
                    </>
                  ) : (
                    <>
                      <Inbox size={15} style={{ color: '#64748B' }} />
                      <span>Conversa aguardando atendimento</span>
                    </>
                  )}
                </div>
                <button
                  onClick={e => handleAssume(selected, e)}
                  disabled={assuming === selected.session_id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#16A34A', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 22px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                    opacity: assuming === selected.session_id ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  <Headset size={16} />
                  {assuming === selected.session_id ? 'Assumindo...' : 'Assumir atendimento'}
                </button>
              </div>
              )
            })()}

            {/* Banner Finalizados */}
            {isClosed && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#F8FAFC', borderBottom: '1px solid var(--border)',
                padding: '8px 18px', flexShrink: 0,
                fontSize: 12, color: 'var(--text-muted)',
              }}>
                <Archive size={13} />
                <span style={{ flex: 1 }}>
                  Conversa encerrada. Se o cliente enviar nova mensagem, um novo ticket será aberto automaticamente.
                </span>
                <button
                  onClick={() => handleReopen(selected)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: '#2563EB', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '5px 12px',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <MessageSquare size={11} /> Reabrir conversa
                </button>
              </div>
            )}

            <div className="chat-body" ref={chatBodyRef}>
              {hasMore && !loadingMsgs && (
                <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{
                      fontSize: 12, padding: '5px 16px', borderRadius: 20,
                      background: '#F1F5F9', border: '1px solid #E2E8F0',
                      color: '#475569', cursor: loadingMore ? 'default' : 'pointer',
                      fontWeight: 500, opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? 'Carregando...' : '⬆ Ver mensagens anteriores'}
                  </button>
                </div>
              )}
              {loadingMsgs && (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: '2rem' }}>
                  Carregando mensagens...
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: '2rem' }}>Sem mensagens.</div>
              )}
              {messages.map(msg => {
                if (msg.type === 'sistema') return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', padding: '0 8px' }}>
                    <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                    <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', fontStyle: 'italic' }}>{msg.content}</span>
                    <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                  </div>
                )
                const isCliente    = msg.type === 'cliente'
                const isAtendente  = msg.type === 'atendente'
                const isLeft       = isCliente
                const isImage      = isCliente && /^(esta imagem|a imagem|esse documento|este documento|essa imagem|o documento|a foto|essa foto)/i.test(msg.content.trim())
                const labelColor   = isCliente ? 'var(--text-muted)' : isAtendente ? '#16A34A' : '#2563EB'
                return (
                  <div key={msg.id}>
                    <div className="msg-label" style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      justifyContent: isLeft ? 'flex-start' : 'flex-end',
                      color: labelColor,
                    }}>
                      {isCliente
                        ? <><User size={10} /> Cliente</>
                        : isAtendente
                          ? <><Headset size={10} /> Atendente</>
                          : <><Bot size={10} /> IA</>}
                    </div>
                    <div className={`msg-row ${isLeft ? 'ai' : 'client'}`}>
                      {(() => {
                        const media = detectMedia(msg.base64)
                        const hasLocation = !!(msg.location && msg.location.lat != null && msg.location.lng != null)
                        const hasContact = !!(msg.contato && (msg.contato.name || msg.contato.phone))
                        const rawContent = msg.content || ''
                        const fileLineMatch = rawContent.match(/^(🎤 Áudio|🖼️ [^\n]+|📄 [^\n]+|📎 [^\n]+)(\n([\s\S]*))?$/)
                        const fileLine = fileLineMatch?.[1] || null
                        const extraText = fileLineMatch?.[3]?.trim() || ''
                        const isPlaceholder = !!fileLine
                        // Documento: texto extraído automaticamente vira "resumo" sob demanda,
                        // não aparece direto embaixo do anexo. Imagem: não tem resumo/transcrição
                        // pra extrair, então não mostra nada além da própria foto. Legenda digitada
                        // de verdade pelo atendente ao enviar (formato "🖼️/📄 arquivo\ntexto") continua.
                        const suppressCaption = (media?.type === 'image' || media?.type === 'pdf') && !isPlaceholder
                        const hiddenSummary = (media?.type === 'pdf' && suppressCaption) ? rawContent.trim() : ''
                        const captionExpanded = expandedCaptions.has(msg.id)
                        const transcriptExpanded = expandedTranscripts.has(msg.id)
                        const isRecent = msg.ts && (Date.now() - new Date(msg.ts).getTime()) < 3 * 60 * 1000
                        // Localização e contato viram card próprio (igual PDF) — o texto de fallback
                        // salvo pra quem ainda não rodou a migration não aparece duplicado embaixo.
                        const displayContent = (hasLocation || hasContact) ? '' : suppressCaption ? '' : isPlaceholder ? extraText : rawContent
                        const hasOnlyMedia = (media || hasLocation || hasContact) && !displayContent
                        const bubbleStyle = {
                          position: 'relative',
                          ...(isAtendente
                            ? hasOnlyMedia
                              ? { background: 'transparent', padding: 0, boxShadow: 'none', border: 'none' }
                              : { background: '#16A34A', color: '#fff', borderBottomRightRadius: 4 }
                            : hasOnlyMedia
                              ? { background: 'transparent', padding: 0, boxShadow: 'none', border: 'none' }
                              : {}),
                        }
                        return (
                          <div className="msg-bubble" style={bubbleStyle}>
                            {msg.reacao?.emoji && (
                              <div style={{
                                position: 'absolute', bottom: -9, [isLeft ? 'left' : 'right']: -6,
                                background: '#fff', borderRadius: '50%',
                                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.25)', border: '2px solid #F8FAFC',
                                lineHeight: 1, zIndex: 1,
                              }}>
                                {msg.reacao.emoji}
                              </div>
                            )}
                            {hasLocation && (() => {
                              const { lat, lng } = msg.location
                              const MAP_W = 280, MAP_H = 150, ZOOM = 15
                              const { tiles, offsetX, offsetY } = getStaticMapTiles(lat, lng, ZOOM, MAP_W, MAP_H)
                              return (
                                <a href={`https://www.google.com/maps?q=${lat},${lng}`}
                                  target="_blank" rel="noreferrer"
                                  style={{
                                    display: 'block', borderRadius: 14, overflow: 'hidden',
                                    textDecoration: 'none', width: MAP_W, maxWidth: '100%',
                                    marginBottom: hasOnlyMedia ? 0 : 6,
                                    boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                  }}>
                                  <div style={{ position: 'relative', width: MAP_W, height: MAP_H, background: '#E8EAED', overflow: 'hidden' }}>
                                    <div style={{
                                      position: 'absolute', left: -offsetX, top: -offsetY,
                                      width: 512, height: 512, display: 'grid',
                                      gridTemplateColumns: '256px 256px', gridTemplateRows: '256px 256px',
                                    }}>
                                      {tiles.map(t => (
                                        <img key={`${t.dx}-${t.dy}`} src={t.url} width={256} height={256}
                                          alt="" draggable={false}
                                          style={{ display: 'block', gridColumn: t.dx + 1, gridRow: t.dy + 1 }}
                                          onError={e => { e.target.style.visibility = 'hidden' }} />
                                      ))}
                                    </div>
                                    <div style={{
                                      position: 'absolute', left: '50%', top: MAP_H / 2 + 2,
                                      width: 14, height: 5, borderRadius: '50%',
                                      background: 'rgba(0,0,0,0.28)', filter: 'blur(1.5px)',
                                      transform: 'translateX(-50%)',
                                    }} />
                                    <div style={{
                                      position: 'absolute', left: '50%', top: '50%',
                                      transform: 'translate(-50%, -100%)',
                                      filter: 'drop-shadow(0 2px 2px rgba(127,29,29,0.45))',
                                    }}>
                                      <div style={{ position: 'relative', width: 30, height: 30 }}>
                                        <MapPin size={30} color="#7F1D1D" fill="#E11D48" strokeWidth={1.5} style={{ display: 'block' }} />
                                        <div style={{ position: 'absolute', left: '50%', top: 8, width: 7, height: 7, borderRadius: '50%', background: '#fff', transform: 'translateX(-50%)' }} />
                                      </div>
                                    </div>
                                    <div style={{
                                      position: 'absolute', right: 5, bottom: 3, fontSize: 8, lineHeight: '11px',
                                      color: 'rgba(0,0,0,0.45)', background: 'rgba(255,255,255,0.6)',
                                      padding: '0 4px', borderRadius: 3,
                                    }}>
                                      © OSM © CARTO
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '9px 12px', borderTop: '1px solid #F1F5F9' }}>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0 }}>
                                      <MapPin size={15} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {msg.location.name || 'Localização compartilhada'}
                                      </div>
                                      <div style={{
                                        fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        color: msg.location.address ? '#6B7280' : '#DC2626',
                                        fontWeight: msg.location.address ? 400 : 700,
                                      }}>
                                        {msg.location.address || 'Abrir no mapa'}
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              )
                            })()}
                            {hasContact && (() => {
                              const c = msg.contato
                              const phoneDigits = (c.phone || c.wa_id || '').replace(/\D/g, '')
                              const name = c.name || 'Contato compartilhado'
                              const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '#'
                              const AVATAR_PALETTE = ['#0EA5E9', '#8B5CF6', '#F97316', '#10B981', '#EC4899', '#6366F1']
                              const hash = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0)
                              const avatarColor = AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
                              return (
                                <div role="button" tabIndex={0}
                                  onClick={() => openContactConversation(phoneDigits)}
                                  onKeyDown={e => e.key === 'Enter' && openContactConversation(phoneDigits)}
                                  style={{
                                    display: 'block', borderRadius: 14, overflow: 'hidden',
                                    width: 240, maxWidth: '100%',
                                    marginBottom: hasOnlyMedia ? 0 : 6,
                                    background: '#fff', border: '1px solid #E5E7EB',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                    cursor: phoneDigits ? 'pointer' : 'default',
                                  }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 12px' }}>
                                    <div style={{
                                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                                      background: avatarColor, color: '#fff', fontSize: 15, fontWeight: 700,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      boxShadow: `0 2px 6px ${avatarColor}55`,
                                    }}>
                                      {initials}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {name}
                                      </div>
                                      {phoneDigits && (
                                        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 1 }}>
                                          {formatPhone(phoneDigits)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {phoneDigits && (
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                                      padding: '9px 0', borderTop: '1px solid #F1F5F9',
                                      color: '#2563EB', fontSize: 12, fontWeight: 700,
                                    }}>
                                      <MessageSquare size={13} /> Abrir conversa
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                            {media && (() => {
                              const src = `data:${media.mime};base64,${msg.base64}`
                              if (media.type === 'audio') return (
                                <div style={{ marginBottom: hasOnlyMedia ? 0 : 6 }}>
                                  <audio controls src={src} style={{ width: 280, maxWidth: '100%', display: 'block' }} />
                                  {msg.resumo ? (
                                    <AiExpandedCard isAtendente={isAtendente} icon={Sparkles} title="Resumo">
                                      {msg.resumo}
                                    </AiExpandedCard>
                                  ) : isRecent ? (
                                    <AiLoadingDots isAtendente={isAtendente} label="Gerando resumo..." />
                                  ) : null}
                                  {msg.transcricao ? (
                                    <div style={{ marginTop: 6 }}>
                                      <AiToggleChip
                                        isAtendente={isAtendente} icon={FileText} label="Transcrição"
                                        expanded={transcriptExpanded}
                                        onClick={() => setExpandedTranscripts(prev => {
                                          const n = new Set(prev)
                                          n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id)
                                          return n
                                        })}
                                      />
                                      {transcriptExpanded && (
                                        <AiExpandedCard isAtendente={isAtendente} icon={FileText} title="Transcrição completa">
                                          {renderFormattedText(msg.transcricao)}
                                        </AiExpandedCard>
                                      )}
                                    </div>
                                  ) : isRecent ? (
                                    <div style={{ marginTop: 6 }}>
                                      <AiLoadingDots isAtendente={isAtendente} label="Transcrevendo áudio..." />
                                    </div>
                                  ) : null}
                                </div>
                              )
                              if (media.type === 'image') return (
                                <img src={src} alt="mídia" style={{ maxWidth: 280, width: '100%', borderRadius: 8, display: 'block', marginBottom: hasOnlyMedia ? 0 : 6, cursor: 'zoom-in', boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
                                  onClick={() => setLightbox(src)} />
                              )
                              if (media.type === 'pdf') {
                                const fileName = (fileLine || '').replace(/^📄\s*/, '').trim() || 'documento.pdf'
                                return (
                                  <a href={src} download={fileName} target="_blank" rel="noreferrer"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 10,
                                      background: '#FEF2F2', border: '1px solid #FECACA',
                                      borderRadius: 8, padding: '10px 14px', textDecoration: 'none',
                                      minWidth: 220, marginBottom: hasOnlyMedia ? 0 : 6,
                                    }}>
                                    <div style={{
                                      width: 36, height: 36, borderRadius: 6, background: '#FEE2E2',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: '#DC2626', fontWeight: 700, fontSize: 11, flexShrink: 0,
                                    }}>PDF</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {fileName}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#6B7280' }}>Clique para baixar/abrir</div>
                                    </div>
                                  </a>
                                )
                              }
                              return null
                            })()}
                            {media?.type === 'pdf' && suppressCaption && (
                              hiddenSummary ? (
                                <div style={{ marginTop: hasOnlyMedia ? 4 : 0, marginBottom: hasOnlyMedia ? 0 : 6 }}>
                                  <AiToggleChip
                                    isAtendente={isAtendente} icon={Sparkles} label="Resumo"
                                    expanded={captionExpanded}
                                    onClick={() => setExpandedCaptions(prev => {
                                      const n = new Set(prev)
                                      n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id)
                                      return n
                                    })}
                                  />
                                  {captionExpanded && (
                                    <AiExpandedCard isAtendente={isAtendente} icon={Sparkles} title="Resumo do documento">
                                      {renderFormattedText(hiddenSummary)}
                                    </AiExpandedCard>
                                  )}
                                </div>
                              ) : isRecent ? (
                                <div style={{ marginTop: hasOnlyMedia ? 4 : 0, marginBottom: hasOnlyMedia ? 0 : 6 }}>
                                  <AiLoadingDots isAtendente={isAtendente} label="Gerando resumo..." />
                                </div>
                              ) : null
                            )}
                            {isImage && !msg.base64 && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 11, fontWeight: 600, color: '#6B7280',
                                background: '#F3F4F6', border: '1px solid #E5E7EB',
                                borderRadius: 6, padding: '2px 8px', marginBottom: 6,
                              }}>🖼️ Imagem enviada</div>
                            )}
                            {isAtendente && editingMsgId === msg.id ? (
                              <div>
                                <textarea
                                  autoFocus
                                  value={editingText}
                                  onChange={e => setEditingText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(msg) }
                                    if (e.key === 'Escape') { setEditingMsgId(null); setEditingText('') }
                                  }}
                                  style={{
                                    width: '100%', minHeight: 44, maxHeight: 120, boxSizing: 'border-box',
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '1.5px solid rgba(255,255,255,0.45)',
                                    borderRadius: 8, padding: '8px 10px',
                                    color: '#fff', fontSize: 13.5,
                                    lineHeight: 1.5, resize: 'none',
                                    fontFamily: 'inherit', outline: 'none',
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 6, marginTop: 7, justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => { setEditingMsgId(null); setEditingText('') }}
                                    style={{
                                      fontSize: 11, fontWeight: 600, padding: '4px 11px',
                                      borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)',
                                      background: 'transparent', color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
                                    }}
                                  >Cancelar</button>
                                  <button
                                    onClick={() => handleSaveEdit(msg)}
                                    disabled={savingEdit}
                                    style={{
                                      fontSize: 11, fontWeight: 700, padding: '4px 13px',
                                      borderRadius: 6, border: 'none',
                                      background: 'rgba(255,255,255,0.92)', color: '#16A34A',
                                      cursor: savingEdit ? 'default' : 'pointer',
                                      opacity: savingEdit ? 0.65 : 1,
                                    }}
                                  >{savingEdit ? 'Salvando...' : 'Salvar'}</button>
                                </div>
                              </div>
                            ) : displayContent ? (
                              <span style={{ whiteSpace: 'pre-wrap' }}>{renderFormattedText(displayContent)}</span>
                            ) : null}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isLeft ? 'flex-start' : 'flex-end', gap: 5 }}>
                      {isAtendente && !isOfficialApi && !msg.base64 && editingMsgId !== msg.id && (
                        <button
                          onClick={() => { setEditingMsgId(msg.id); setEditingText(msg.content || '') }}
                          title="Editar mensagem"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 18, height: 18, borderRadius: 4, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            color: 'var(--text-muted)', opacity: 0.55, padding: 0,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                      {msg.ts && (
                        <div className="msg-time" style={{ textAlign: isLeft ? 'left' : 'right' }}>
                          {formatMsgTime(msg.ts, companyTz)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {!isClosed && (
              <div style={{ padding: '12px 18px', borderTop: '0.5px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                {attachedFile && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#EFF6FF', border: '1px solid #BFDBFE',
                    borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                  }}>
                    {attachedFile.kind === 'image' ? (
                      <img src={`data:${attachedFile.mime};base64,${attachedFile.base64}`}
                        alt={attachedFile.name}
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: 6,
                        background: attachedFile.kind === 'pdf' ? '#FEE2E2' : '#E5E7EB',
                        color: attachedFile.kind === 'pdf' ? '#DC2626' : '#6B7280',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FileText size={20} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {attachedFile.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {(attachedFile.size / 1024).toFixed(0)} KB · {attachedFile.kind === 'pdf' ? 'PDF' : attachedFile.kind === 'image' ? 'Imagem' : 'Arquivo'}
                      </div>
                    </div>
                    <button onClick={discardFile} title="Remover arquivo"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: '#FEF2F2', border: '1px solid #FECACA',
                        color: '#DC2626', borderRadius: 6, padding: '5px 10px',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      }}>
                      <Trash2 size={11} /> Remover
                    </button>
                  </div>
                )}
                {recordedAudio && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#F0FDF4', border: '1px solid #BBF7D0',
                    borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                  }}>
                    <audio controls src={`data:${recordedAudio.mime};base64,${recordedAudio.base64}`}
                      style={{ flex: 1, height: 32 }} />
                    <button onClick={discardAudio} title="Descartar áudio"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: '#FEF2F2', border: '1px solid #FECACA',
                        color: '#DC2626', borderRadius: 6, padding: '5px 10px',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      }}>
                      <Trash2 size={11} /> Descartar
                    </button>
                  </div>
                )}
                {recording && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                    fontSize: 12, color: '#DC2626', fontWeight: 600,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', animation: 'pulse-dot 1.2s infinite' }} />
                    Gravando... {String(Math.floor(recordTime / 60)).padStart(2, '0')}:{String(recordTime % 60).padStart(2, '0')}
                    <button onClick={() => stopRecording()} style={{
                      marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: '#DC2626', color: '#fff', border: 'none',
                      borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <Square size={11} /> Parar
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    ref={messageInputRef}
                    className="nx-input"
                    style={{ flex: 1, fontSize: 13 }}
                    placeholder={
                      !canRespond(selected) ? "Conversa está com outro atendente — você não pode responder"
                      : recordedAudio ? "Mensagem opcional para acompanhar o áudio..."
                      : attachedFile ? "Mensagem opcional para acompanhar o arquivo..."
                      : "Digite uma mensagem..."
                    }
                    value={msgText}
                    onChange={e => {
                      setMsgText(e.target.value)
                      if (e.target.value.trim()) notifyTyping()
                      else notifyStopTyping()
                    }}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    onBlur={notifyStopTyping}
                    disabled={sending || recording || !canRespond(selected)}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handlePickFile}
                  />
                  {!recording && !recordedAudio && !attachedFile && (
                    <>
                      <div ref={emojiPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v) }}
                          title="Emoji"
                          disabled={!canRespond(selected)}
                          style={{
                            padding: '0 14px', height: '100%',
                            background: '#fff', border: '1px solid var(--border)',
                            borderRadius: 8, color: '#6B7280',
                            cursor: canRespond(selected) ? 'pointer' : 'not-allowed',
                            opacity: canRespond(selected) ? 1 : 0.45,
                            display: 'inline-flex', alignItems: 'center',
                          }}
                        >
                          <Smile size={15} />
                        </button>
                        {showEmojiPicker && (() => {
                          const activeCat = EMOJI_CATEGORIES.find(c => c.key === emojiCategory) || EMOJI_CATEGORIES[0]
                          return (
                            <div style={{
                              position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
                              background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 20,
                              width: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            }}>
                              <div style={{
                                display: 'grid', gridTemplateColumns: `repeat(${EMOJI_CATEGORIES.length}, 1fr)`,
                                borderBottom: '1px solid var(--border)', flexShrink: 0,
                              }}>
                                {EMOJI_CATEGORIES.map(cat => (
                                  <button key={cat.key}
                                    title={cat.label}
                                    onClick={() => setEmojiCategory(cat.key)}
                                    style={{
                                      background: cat.key === activeCat.key ? '#F1F5F9' : 'none',
                                      border: 'none', cursor: 'pointer', fontSize: 16,
                                      padding: '8px 0', borderBottom: cat.key === activeCat.key ? '2px solid #2563EB' : '2px solid transparent',
                                    }}
                                  >
                                    {cat.icon}
                                  </button>
                                ))}
                              </div>
                              <div style={{
                                padding: 10, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2,
                                maxHeight: 220, overflowY: 'auto',
                              }}>
                                {activeCat.emojis.map((emoji, i) => (
                                  <button key={i}
                                    onClick={() => insertEmoji(emoji)}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      fontSize: 19, borderRadius: 6, padding: '4px 0',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Anexar imagem ou PDF"
                        disabled={!canRespond(selected)}
                        style={{
                          padding: '0 14px', flexShrink: 0,
                          background: '#fff', border: '1px solid var(--border)',
                          borderRadius: 8, color: '#6B7280',
                          cursor: canRespond(selected) ? 'pointer' : 'not-allowed',
                          opacity: canRespond(selected) ? 1 : 0.45,
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      >
                        <Paperclip size={15} />
                      </button>
                      <button
                        onClick={startRecording}
                        title="Gravar áudio"
                        disabled={!canRespond(selected)}
                        style={{
                          padding: '0 14px', flexShrink: 0,
                          background: '#fff', border: '1px solid var(--border)',
                          borderRadius: 8, color: '#6B7280',
                          cursor: canRespond(selected) ? 'pointer' : 'not-allowed',
                          opacity: canRespond(selected) ? 1 : 0.45,
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      >
                        <Mic size={15} />
                      </button>
                      <button
                        onClick={() => { setLocErr(''); setLocationModal(true) }}
                        title="Enviar localização"
                        disabled={!canRespond(selected)}
                        style={{
                          padding: '0 14px', flexShrink: 0,
                          background: '#fff', border: '1px solid var(--border)',
                          borderRadius: 8, color: '#6B7280',
                          cursor: canRespond(selected) ? 'pointer' : 'not-allowed',
                          opacity: canRespond(selected) ? 1 : 0.45,
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      >
                        <MapPin size={15} />
                      </button>
                    </>
                  )}
                  <button
                    className="nx-btn-primary"
                    style={{ padding: '0 16px', flexShrink: 0 }}
                    onClick={handleSend}
                    disabled={(!msgText.trim() && !recordedAudio && !attachedFile && !recording) || sending || !canRespond(selected)}
                  >
                    <Send size={14} />
                  </button>
                </div>
                <a
                  href={`https://wa.me/${selected.phone}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#25D366', color: '#fff', borderRadius: 8,
                    padding: '9px 18px', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', boxShadow: '0 1px 4px rgba(37,211,102,0.3)',
                  }}
                >
                  <PhoneCall size={15} /> WhatsApp
                </a>
                {session?.company?.digisac_url && (
                  <a
                    href={session.company.digisac_url}
                    target="_blank" rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: '#7C3AED', color: '#fff', borderRadius: 8,
                      padding: '9px 18px', fontSize: 13, fontWeight: 600,
                      textDecoration: 'none', boxShadow: '0 1px 4px rgba(124,58,237,0.3)',
                    }}
                  >
                    <PhoneCall size={15} /> Digisac
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {contextMenu && createPortal(
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 99998,
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          padding: 4, minWidth: 180,
        }}
        onClick={e => e.stopPropagation()}
        >
          {(() => {
            const cleanNum = contextMenu.contact.phone.replace(/\D/g, '')
            const saved = savedContacts[cleanNum]
            return (
              <button
                onClick={() => openSaveContact(contextMenu.contact)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 12px', border: 'none', background: 'transparent',
                  fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer',
                  borderRadius: 6, textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <User size={13} />
                {saved ? 'Editar paciente' : 'Salvar paciente'}
              </button>
            )
          })()}
        </div>
      , document.body)}

      {saveContactModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  {saveContactModal.id ? 'Editar paciente' : 'Salvar paciente'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                  {saveContactModal.numero}
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSaveContactModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</label>
                <input className="nx-input" autoFocus placeholder="Ex: João Silva"
                  value={saveContactModal.nome}
                  onChange={e => setSaveContactModal(p => ({ ...p, nome: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSaveContact()} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas (opcional)</label>
                <textarea className="nx-input" rows={3} placeholder="Anotações sobre este contato..."
                  value={saveContactModal.notes || ''}
                  onChange={e => setSaveContactModal(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setSaveContactModal(null)}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleSaveContact}
                disabled={!saveContactModal.nome.trim() || savingContact}>
                {savingContact ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {locationModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }} onClick={() => !sendingLocation && setLocationModal(false)}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                <MapPin size={17} color="#DC2626" />
                Enviar localização
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setLocationModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Link do Google Maps ou coordenadas
                </label>
                <input className="nx-input" autoFocus placeholder="Ex: -23.5505, -46.6333 ou link do Google Maps"
                  value={locInput}
                  onChange={e => { setLocInput(e.target.value); setLocErr('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSendLocation()} />
              </div>
              <button
                onClick={handleUseMyLocation}
                disabled={gettingGeo}
                className="nx-btn-ghost"
                style={{ justifyContent: 'center', gap: 8, fontSize: 13 }}
              >
                <Crosshair size={14} />
                {gettingGeo ? 'Obtendo localização...' : 'Usar minha localização atual'}
              </button>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome do local (opcional)</label>
                <input className="nx-input" placeholder="Ex: Clínica MedicinaMKT"
                  value={locName}
                  onChange={e => setLocName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendLocation()} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Endereço (opcional)</label>
                <input className="nx-input" placeholder="Ex: Av. Paulista, 1000 - São Paulo"
                  value={locAddress}
                  onChange={e => setLocAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendLocation()} />
              </div>
              {locErr && (
                <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>
                  {locErr}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setLocationModal(false)} disabled={sendingLocation}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleSendLocation}
                disabled={!locInput.trim() || sendingLocation}>
                {sendingLocation ? 'Enviando...' : 'Enviar localização'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {lightbox && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, cursor: 'zoom-out' }}
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="mídia" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        </div>
      , document.body)}

      {toast && createPortal(
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
          background: '#fff', border: `1.5px solid ${toast.color}`,
          borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, fontWeight: 600, color: toast.color,
        }}>
          <CheckCircle2 size={16} />
          {toast.message}
        </div>
      , document.body)}

      {transferModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem',
        }} onClick={() => !transferring && setTransferModal(null)}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(100vh - 3rem)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowRightLeft size={16} style={{ color: '#0891B2' }} /> Transferir conversa
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Pra qual atendente passar essa conversa?
                </div>
              </div>
              <button onClick={() => !transferring && setTransferModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '1rem 1.5rem', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {(() => {
                const others = companyUsers.filter(u => u.email !== session?.user?.email)
                if (!others.length) {
                  return (
                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      Não tem outro atendente cadastrado nessa empresa pra receber.
                    </div>
                  )
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {others.map(u => (
                      <label key={u.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${transferringTo === u.email ? '#0891B2' : 'var(--border)'}`,
                        background: transferringTo === u.email ? '#ECFEFF' : '#fff',
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" name="transfer-target" checked={transferringTo === u.email}
                          onChange={() => setTransferringTo(u.email)}
                          style={{ width: 16, height: 16 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )
              })()}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setTransferModal(null)} disabled={transferring}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center', background: '#0891B2', borderColor: '#0891B2' }}
                onClick={handleTransfer} disabled={!transferringTo || transferring}>
                {transferring ? 'Transferindo...' : 'Transferir conversa'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {closeModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Finalizar conversa</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {closeModal.bulk ? `${closeModal.contacts.length} conversas selecionadas` : closeModal.phone} — qual foi o resultado?
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}
                onClick={() => setCloseModal(null)}><X size={16} /></button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MANUAL_REASONS.map(r => (
                <label key={r.value} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${reason === r.value ? r.border : 'var(--border)'}`,
                  background: reason === r.value ? r.bg : 'var(--bg-surface)',
                  transition: 'all 0.15s',
                }}>
                  <input type="radio" style={{ display: 'none' }} value={r.value}
                    checked={reason === r.value} onChange={() => setReason(r.value)} />
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: reason === r.value ? r.color : 'var(--border)',
                  }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: reason === r.value ? r.color : 'var(--text-primary)' }}>
                    {r.label}
                  </div>
                </label>
              ))}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setCloseModal(null)}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: reason ? 1 : 0.5 }}
                onClick={handleClose} disabled={!reason || closing}>
                <CheckCircle2 size={13} /> {closing ? 'Finalizando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
