-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the table to store document chunks and their embeddings
create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,       -- The actual text chunk
  metadata jsonb,              -- Reference to PDF name, page number, etc.
  embedding vector(384)        -- 384 dimensions for all-MiniLM-L6-v2
);

-- Recommended: Create an index for faster similarity search
create index on documents using hnsw (embedding vector_ip_ops);

-- Run this in your Supabase SQL Editor to enable pgvector search functionality!

-- 1. Create the match_documents function for vector similarity search
create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;