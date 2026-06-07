import { pool } from '../config/azure-db';
import { neo4jDriver } from '../config/neo4j';
import { deleteBlob } from '../config/azure-storage';
import { logger } from '../utils/logger';

/**
 * deleteDocument — Azure PostgreSQL + Neo4j + Blob Storage
 *
 * Extends the original deletion service to also clean up the blob
 * in Azure Storage if the document was uploaded as a file.
 */
export const deleteDocument = async (source: string, userId: string): Promise<{
    deletedChunks: number;
    deletedNodes: number;
}> => {

    // --- 1. Fetch blob URLs before deleting rows (for blob cleanup) ---
    const { rows: blobRows } = await pool.query<{ blobUrl: string }>(
        `SELECT metadata->>'blobUrl' AS "blobUrl"
         FROM documents
         WHERE user_id = $1
           AND metadata->>'source' = $2
           AND metadata->>'blobUrl' IS NOT NULL
         LIMIT 1`,
        [userId, source]
    );

    // --- 2. Delete vector rows from Azure PostgreSQL ---
    const { rowCount } = await pool.query(
        `DELETE FROM documents
         WHERE user_id = $1
           AND metadata->>'source' = $2`,
        [userId, source]
    );
    const deletedChunks = rowCount ?? 0;
    logger.log(`[Delete] Removed ${deletedChunks} vector chunks for source "${source}"`);

    // --- 3. Delete from Neo4j (unchanged) ---
    const session = neo4jDriver.session();
    let deletedNodes = 0;
    try {
        const result = await session.run(`
            MATCH (n:Entity {userId: $userId, source: $source})
            WITH n, count(n) AS total
            DETACH DELETE n
            RETURN total
        `, { userId, source });

        deletedNodes = result.records[0]?.get('total')?.toNumber() ?? 0;
        logger.log(`[Delete] Removed ${deletedNodes} graph nodes for source "${source}"`);
    } catch (error) {
        logger.error('[Delete] Neo4j deletion error:', error);
        throw new Error('Failed to delete graph nodes');
    } finally {
        await session.close();
    }

    // --- 4. Delete blob from Azure Storage (best-effort — don't fail the request) ---
    if (blobRows[0]?.blobUrl) {
        try {
            await deleteBlob(blobRows[0].blobUrl);
        } catch (err) {
            logger.error('[Delete] Blob deletion error (non-fatal):', err);
        }
    }

    return { deletedChunks, deletedNodes };
};
