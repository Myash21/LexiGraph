import { supabase } from "../config/supabase";
import { neo4jDriver } from "../config/neo4j";
import { logger } from "../utils/logger";

export const deleteDocument = async (source: string, userId: string): Promise<{
    deletedChunks: number;
    deletedNodes: number;
}> => {

    // --- 1. Delete from Supabase (all chunks matching source + userId) ---
    const { data: deletedRows, error } = await supabase
        .from('documents')
        .delete()
        .eq('user_id', userId)
        .eq('metadata->>source', source)  // ← target specific document by source
        .select('id');                     // ← get count of deleted rows

    if (error) {
        logger.error('Failed to delete from Supabase:', error);
        throw new Error('Failed to delete document chunks');
    }

    const deletedChunks = deletedRows?.length ?? 0;

    // --- 2. Delete from Neo4j (all nodes + relationships for this source + userId) ---
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

        logger.log(`deleteDocument → deleted ${deletedChunks} chunks and ${deletedNodes} nodes for source "${source}"`);

    } catch (error) {
        logger.error('Failed to delete from Neo4j:', error);
        throw new Error('Failed to delete graph nodes');
    } finally {
        await session.close();
    }

    return { deletedChunks, deletedNodes };
};