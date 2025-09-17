-- Add vector search capabilities to knowledge base
-- This script adds the pgvector extension and embedding column

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledge_base table
-- Using 768 dimensions for text-embedding-004 (Google's embedding model)
ALTER TABLE public.knowledge_base
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
ON public.knowledge_base
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to update search_vector for full-text search
CREATE OR REPLACE FUNCTION update_knowledge_base_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.title || ' ' || NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_vector
DROP TRIGGER IF EXISTS trigger_update_knowledge_base_search_vector ON public.knowledge_base;
CREATE TRIGGER trigger_update_knowledge_base_search_vector
  BEFORE INSERT OR UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_search_vector();

-- Function to search knowledge base using vector similarity
CREATE OR REPLACE FUNCTION search_knowledge_base_vector(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.1,
  match_count int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  category text,
  tags text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.tags,
    1 - (kb.embedding <=> query_embedding) as similarity
  FROM public.knowledge_base kb
  WHERE kb.is_published = true
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;