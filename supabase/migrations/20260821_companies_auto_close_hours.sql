ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS auto_close_hours smallint NOT NULL DEFAULT 2
    CHECK (auto_close_hours >= 1 AND auto_close_hours <= 168);
