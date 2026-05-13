-- Etiquetas globais por instância (ex: "VIP", "Convênio", "Urgente")
CREATE TABLE public.contact_tags (
  id        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia TEXT    NOT NULL,
  nome      TEXT    NOT NULL,
  cor       TEXT    NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instancia, nome)
);

CREATE INDEX idx_contact_tags_instancia ON public.contact_tags(instancia);

-- Vínculo entre paciente (saved_contacts) e etiqueta
-- instancia denormalizado para filtro Realtime sem join
CREATE TABLE public.contact_tag_links (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.saved_contacts(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES public.contact_tags(id)   ON DELETE CASCADE,
  instancia  TEXT NOT NULL,
  UNIQUE(contact_id, tag_id)
);

CREATE INDEX idx_ctag_links_instancia  ON public.contact_tag_links(instancia);
CREATE INDEX idx_ctag_links_contact_id ON public.contact_tag_links(contact_id);
CREATE INDEX idx_ctag_links_tag_id     ON public.contact_tag_links(tag_id);
