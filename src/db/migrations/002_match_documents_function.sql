-- ============================================================
-- match_documents — pgvector similarity search function
--
-- Replaces the Supabase RPC function.
-- Called directly via pg Pool in retrieval.ts.
-- ============================================================

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(384),
    match_threshold FLOAT,
    match_count     INT,
    p_user_id       TEXT
)
RETURNS TABLE (
    id          UUID,
    content     TEXT,
    metadata    JSONB,
    similarity  FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE user_id = p_user_id
      AND 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- Note: retrieval.ts calls this logic inline via pool.query() for simplicity,
-- but this function is provided for direct SQL access and debugging.
