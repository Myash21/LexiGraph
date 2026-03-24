-- Add user_id column to documents
ALTER TABLE documents
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Enable Row Level Security on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: users can only read/write their own rows
-- Note: This applies to direct table queries only, NOT RPC functions
CREATE POLICY "user_isolation" ON documents
    USING (user_id = auth.uid());

-- Drop old match_documents (signature changed, must drop before recreating)
DROP FUNCTION IF EXISTS match_documents(vector, float, int);

-- Updated match_documents with user isolation
-- Note: RPC functions bypass RLS, so we filter explicitly via p_user_id
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT,
    p_user_id UUID
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
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