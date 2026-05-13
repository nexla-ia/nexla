import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#A855F7',
  '#EC4899', '#6B7280',
]

export function useContactTags(instance) {
  const [tags, setTags] = useState([])
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  // Unique suffix per hook invocation prevents channel-name collision between tabs/components
  const cid = useRef(Math.random().toString(36).slice(2, 8)).current

  const load = useCallback(async () => {
    if (!instance) return
    const [{ data: tagsData }, { data: linksData }] = await Promise.all([
      supabase.from('contact_tags').select('*').eq('instancia', instance).order('nome'),
      supabase.from('contact_tag_links').select('contact_id, tag_id').eq('instancia', instance),
    ])
    if (tagsData) setTags(tagsData)
    if (linksData) setLinks(linksData)
    setLoading(false)
  }, [instance])

  useEffect(() => {
    load()
    if (!instance) return

    const chTags = supabase.channel(`ctags-${instance}-${cid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_tags', filter: `instancia=eq.${instance}` },
        p => {
          if (p.eventType === 'DELETE') {
            setTags(prev => prev.filter(t => t.id !== p.old.id))
          } else if (p.new) {
            setTags(prev => {
              const updated = prev.find(t => t.id === p.new.id)
                ? prev.map(t => t.id === p.new.id ? p.new : t)
                : [...prev, p.new]
              return updated.sort((a, b) => a.nome.localeCompare(b.nome))
            })
          }
        })
      .subscribe()

    const chLinks = supabase.channel(`ctag-lnk-${instance}-${cid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_tag_links', filter: `instancia=eq.${instance}` },
        p => {
          if (p.eventType === 'DELETE') {
            setLinks(prev => prev.filter(l =>
              !(l.contact_id === p.old.contact_id && l.tag_id === p.old.tag_id)
            ))
          } else if (p.new) {
            setLinks(prev => {
              if (prev.find(l => l.contact_id === p.new.contact_id && l.tag_id === p.new.tag_id)) return prev
              return [...prev, { contact_id: p.new.contact_id, tag_id: p.new.tag_id }]
            })
          }
        })
      .subscribe()

    return () => {
      supabase.removeChannel(chTags)
      supabase.removeChannel(chLinks)
    }
  }, [instance, cid, load])

  // contact_id → Tag[]
  const tagsByContact = useMemo(() => {
    const map = {}
    links.forEach(l => {
      const tag = tags.find(t => t.id === l.tag_id)
      if (!tag) return
      if (!map[l.contact_id]) map[l.contact_id] = []
      map[l.contact_id].push(tag)
    })
    return map
  }, [tags, links])

  async function addTag(contactId, tagId) {
    await supabase.from('contact_tag_links').insert({ contact_id: contactId, tag_id: tagId, instancia: instance })
  }

  async function removeTag(contactId, tagId) {
    await supabase.from('contact_tag_links').delete()
      .eq('contact_id', contactId).eq('tag_id', tagId)
  }

  async function createTag(nome, cor) {
    return supabase.from('contact_tags').insert({ instancia: instance, nome: nome.trim(), cor }).select().single()
  }

  async function updateTag(id, nome, cor) {
    return supabase.from('contact_tags').update({ nome: nome.trim(), cor }).eq('id', id).select().single()
  }

  async function deleteTag(id) {
    return supabase.from('contact_tags').delete().eq('id', id)
  }

  return { tags, tagsByContact, loading, addTag, removeTag, createTag, updateTag, deleteTag }
}
