-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector store table used by n8n Supabase Vector Store node (512-dim embeddings)
CREATE TABLE IF NOT EXISTS public.documents (
  id       bigserial PRIMARY KEY,
  content  text,
  metadata jsonb,
  embedding vector(512)
);

CREATE INDEX IF NOT EXISTS documents_embedding_idx
  ON public.documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Org documents registry (tracks uploads per tenant)
CREATE TABLE IF NOT EXISTS public.org_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  file_type       text NOT NULL,
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_documents_select" ON public.org_documents
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY "org_documents_insert" ON public.org_documents
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "org_documents_delete" ON public.org_documents
  FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'));
