-- =============================================================
-- 0010_upload_seguro.sql — Restringe tipo e tamanho no bucket
-- =============================================================
-- Antes, o bucket 'documentos' aceitava qualquer arquivo de
-- qualquer tamanho — a validação de 25 MB e de tipo existia só
-- no formulário do navegador, então dava pra contornar chamando
-- a API de Storage direto. Agora o próprio bucket rejeita, no
-- servidor, qualquer upload fora da lista de tipos ou acima do
-- limite — a mesma lista usada em MIME_PERMITIDOS
-- (src/modules/documentos/schema.ts).

update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/xml',
      'text/xml'
    ]
where id = 'documentos';
