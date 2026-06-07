import { neo4jDriver } from '../config/neo4j';
import { pool } from '../config/azure-db';
import type { GraphData } from './extraction';
import { logger } from '../utils/logger';

/**
 * saveToVectorDB — Azure PostgreSQL (Flexible Server) + pgvector
 *
 * Replaces: Supabase client insert
 * The SQL schema is identical to the Supabase migration — pgvector is the same
 * extension. The only difference is we use the `pg` Pool directly instead of
 * the Supabase JS client.
 */
export const saveToVectorDB = async (
    content: string,
    embedding: number[],
    metadata: any = {},
    userId: string
) => {
    // pgvector expects the embedding as a Postgres vector literal: '[0.1,0.2,...]'
    const embeddingLiteral = `[${embedding.join(',')}]`;

    await pool.query(
        `INSERT INTO documents (content, metadata, embedding, user_id)
         VALUES ($1, $2, $3::vector, $4)`,
        [content, JSON.stringify(metadata), embeddingLiteral, userId]
    );

    logger.log(`[VectorDB] Inserted chunk for user ${userId}`);
};

/**
 * saveToGraphDB — Neo4j (unchanged — Azure has no native graph DB replacement)
 */
export const saveToGraphDB = async (
    graphData: GraphData,
    metadata: any = {},
    userId: string
) => {
    if (graphData.nodes.length === 0 && graphData.edges.length === 0) return;

    const session = neo4jDriver.session();
    try {
        await session.executeWrite(async (tx) => {

            if (graphData.nodes.length > 0) {
                await tx.run(`
                    UNWIND $nodes AS node
                    MERGE (n:Entity {id: node.id, userId: $userId})
                    SET n.type = node.type,
                        n.source = coalesce($sourceMetadata, n.source)
                `, {
                    nodes: graphData.nodes,
                    userId,
                    sourceMetadata: metadata?.testRun || metadata?.source || null,
                });
            }

            if (graphData.edges.length > 0) {
                await tx.run(`
                    UNWIND $edges AS edge
                    MATCH (source:Entity {id: edge.source, userId: $userId})
                    MATCH (target:Entity {id: edge.target, userId: $userId})
                    CALL apoc.merge.relationship(source, edge.type, {}, {userId: $userId}, target, {}) YIELD rel
                    RETURN count(rel)
                `, { edges: graphData.edges, userId });
            }
        });

        logger.log(`[GraphDB] Saved ${graphData.nodes.length} nodes and ${graphData.edges.length} edges for user ${userId}`);
    } catch (error) {
        logger.error('[GraphDB] Insert Error:', error);
        throw new Error('Failed to save to Neo4j');
    } finally {
        await session.close();
    }
};
