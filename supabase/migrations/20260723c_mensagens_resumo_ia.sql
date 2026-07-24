-- Resumo automático de áudio (transcrição limpa + resumo curto gerado no n8n via IA).
-- Quando presente, a lista de conversas mostra o resumo no lugar de só "🎤 Áudio",
-- e o atendente entende do que se trata sem precisar ouvir o áudio inteiro.
ALTER TABLE public.mensagens_geral ADD COLUMN IF NOT EXISTS resumo text;
ALTER TABLE public.mensagens_geral ADD COLUMN IF NOT EXISTS transcricao text;

COMMENT ON COLUMN public.mensagens_geral.resumo IS 'Resumo curto (1-2 frases) gerado por IA a partir da transcrição do áudio. Preenchido pelo n8n, opcional.';
COMMENT ON COLUMN public.mensagens_geral.transcricao IS 'Transcrição completa e limpa do áudio, gerada por IA a partir do texto bruto do Whisper. Preenchido pelo n8n, opcional.';
