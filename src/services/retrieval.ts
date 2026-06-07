import { pool } from '../config/azure-db';
import { neo4jDriver } from '../config/neo4j';
import { getEmbedding } from '../config/embeddings';
import { extractGraphEntities } from './extraction';
import { llm } from '../config/llm';
import { normalizeText, canonicalizeQueryNodeIds } from '../utils/normalize';
import { logger } from '../utils/logger';

/**
 * answerQuery — Hybrid GraphRAG retrieval
 *
 * Vector search: Azure PostgreSQL + pgvector (replaces Supabase RPC)
 * Graph search:  Neo4j (unchanged)
 */
export const answerQuery = async (query: string, userId: string): Promise<{
    answer: string;
    sources: {
        vector: Array<{ content: string; metadata: Record<string, any>; similarity: number }>;
        graph: string[];
    };
}> => {
    logger.log(`Processing Query: "${query}" for user ${userId}`);

    // --- 1. Vector Search (Azure PostgreSQL + pgvector) ---
    logger.log('Generating query embedding and querying Azure PostgreSQL vector DB...');
    const queryEmbedding = await getEmbedding(query);
    const embeddingLiteral = `[${queryEmbedding.join(',')}]`;

    // Replaces: supabase.rpc('match_documents', {...})
    // The SQL logic is identical to the Supabase match_documents function —
    // now executed directly via the pg Pool.
    const { rows: vectorResults } = await pool.query<{
        id: string;
        content: string;
        metadata: Record<string, any>;
        similarity: number;
    }>(
        `SELECT
            id,
            content,
            metadata,
            1 - (embedding <=> $1::vector) AS similarity
         FROM documents
         WHERE user_id = $2
           AND 1 - (embedding <=> $1::vector) > $3
         ORDER BY similarity DESC
         LIMIT $4`,
        [embeddingLiteral, userId, 0.5, 3]
    );

    const vectorContextText = vectorResults.map(v => v.content).join('\n---\n');
    logger.log('vectorResults.length:', vectorResults.length);

    // --- 2. Graph Search (Neo4j — unchanged) ---
    logger.log('Extracting entities from query and traversing graph DB...');
    const queryEntities = await extractGraphEntities(query);
    const nodeIds = queryEntities.nodes.map(n => n.id);

    let graphContextText = '';
    if (nodeIds.length > 0) {
        const canonicalNodeIds = canonicalizeQueryNodeIds(nodeIds);

        const session = neo4jDriver.session();
        try {
            const result = await session.run(`
                UNWIND $nodeIds AS id
                MATCH (n:Entity {userId: $userId})
                WHERE n.id IN $nodeIds
                OPTIONAL MATCH (n)-[r]-(neighbor:Entity {userId: $userId})
                RETURN n.id AS source, type(r) AS relation, neighbor.id AS target
                LIMIT 30
            `, { nodeIds: canonicalNodeIds, userId });

            graphContextText = result.records
                .map(rec => `${rec.get('source')} -[${rec.get('relation')}]-> ${rec.get('target')}`)
                .join('\n');
        } catch (err) {
            logger.error('Graph Traversal Error:', err);
        } finally {
            await session.close();
        }

        // Fallback: lenient partial match
        if (!graphContextText) {
            const fallbackSession = neo4jDriver.session();
            try {
                const fallbackResult = await fallbackSession.run(`
                    UNWIND $bareNames AS name
                    MATCH (n:Entity {userId: $userId})
                    WHERE n.id ENDS WITH name OR n.id CONTAINS name
                    OPTIONAL MATCH (n)-[r]-(neighbor:Entity {userId: $userId})
                    RETURN n.id AS source, type(r) AS relation, neighbor.id AS target
                    LIMIT 30
                `, { bareNames: nodeIds, userId });

                graphContextText = fallbackResult.records
                    .map(rec => `${rec.get('source')} -[${rec.get('relation')}]-> ${rec.get('target')}`)
                    .join('\n');
            } catch (err) {
                logger.error('Graph Fallback Traversal Error:', err);
            } finally {
                await fallbackSession.close();
            }
        }
    }

    logger.log('graphContextText:', graphContextText || 'No relational context found.');

    // --- 3. Synthesize Final Answer (unchanged) ---
    logger.log('Synthesizing final response...');
    const finalPrompt = `
    You are LexiGraph, a highly intelligent Knowledge Assistant.
    Answer the user's question based strictly on the provided Contexts.
    If the contexts do not contain the answer, say "I don't have enough information."

    VECTOR CONTEXT (Semantic Chunks):
    ${vectorContextText || 'No semantic context found.'}

    GRAPH CONTEXT (Entity Relations):
    ${graphContextText || 'No relational context found.'}

    USER QUESTION:
    "${query}"

    Your factual answer:
    `;

    const response = await llm.invoke(finalPrompt);
    const answer: string = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    return {
        answer,
        sources: {
            vector: vectorResults.map(v => ({
                content: v.content,
                metadata: v.metadata || {},
                similarity: v.similarity,
            })),
            graph: graphContextText
                ? graphContextText.split('\n').filter(Boolean).slice(0, 5)
                : [],
        },
    };
};
