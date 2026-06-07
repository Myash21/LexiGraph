-- ============================================================
-- LexiGraph — Azure PostgreSQL (Flexible Server) Migration
-- Run once against your Azure PostgreSQL database.
--
-- Prerequisites:
--   The pgvector extension must be enabled first.
--   In Azure portal: Server → Extensions → add 'vector'
-- ============================================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Core documents table
-- Stores text chunks + their vector embeddings + user scoping
CREATE TABLE IF NOT EXISTS documents (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    content     TEXT        NOT NULL,
    metadata    JSONB,                          -- source, blobUrl, page, testRun, etc.
    embedding   VECTOR(384),                    -- 384-dim (all-MiniLM-L6-v2)
    user_id     TEXT        NOT NULL,           -- Azure AD object ID (oid claim)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast approximate nearest-neighbour search
-- inner-product distance (<#>) aligns with cosine similarity on normalised embeddings
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents
    USING hnsw (embedding vector_ip_ops);

-- Standard index for per-user document queries
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents (user_id);

-- Index on metadata->>'source' for fast document lookups and deletions
CREATE INDEX IF NOT EXISTS documents_source_idx
    ON documents ((metadata->>'source'));
