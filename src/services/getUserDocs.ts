import { pool } from '../config/azure-db';
import { logger } from '../utils/logger';

/**
 * getUserDocuments — Azure PostgreSQL
 * Replaces: supabase.from('documents').select(...)
 */
export const getUserDocuments = async (userId: string): Promise<Array<{
    id: string;
    source: string;
    createdAt: string;
    blobUrl?: string;
}>> => {
    const { rows } = await pool.query<{
        id: string;
        metadata: Record<string, any>;
        created_at: string;
    }>(
        `SELECT id, metadata, created_at
         FROM documents
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );

    const seen = new Set<string>();
    const documents = [];

    for (const row of rows) {
        const source = row.metadata?.source;
        if (source && !seen.has(source)) {
            seen.add(source);
            documents.push({
                id: row.id,
                source,
                createdAt: row.created_at,
                blobUrl: row.metadata?.blobUrl,   // ← new: blob URL if file was uploaded
            });
        }
    }

    logger.log(`[getUserDocs] ${documents.length} documents for user ${userId}`);
    return documents;
};
