import { neo4jDriver } from '../config/neo4j';
import { supabase } from '../config/supabase';
import type { GraphData } from './extraction';
import { logger } from '../utils/logger';

export const saveToVectorDB = async (
    content: string,
    embedding: number[],
    metadata: any = {},
    userId: string
) => {
    const { error } = await supabase.from('documents').insert({
        content,
        metadata,
        embedding,
        user_id: userId
    });

    if (error) {
        logger.error('Vector DB Insert Error:', error);
        throw new Error('Failed to save to Supabase');
    }
};

export const saveToGraphDB = async (
    graphData: GraphData,
    metadata: any = {},
    userId: string          // ← add this
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
                    sourceMetadata: metadata?.testRun || metadata?.source || null
                });
            }

            if (graphData.edges.length > 0) {
                await tx.run(`
          UNWIND $edges AS edge
          MATCH (source:Entity {id: edge.source, userId: $userId})
          MATCH (target:Entity {id: edge.target, userId: $userId})
          CALL apoc.merge.relationship(source, edge.type, {}, {userId: $userId}, target, {}) YIELD rel
          RETURN count(rel)
        `, { edges: graphData.edges, userId });  //MATCH scoped to userId
            }
        });

        logger.log(`Saved ${graphData.nodes.length} nodes and ${graphData.edges.length} edges to Neo4j for user ${userId}.`);
    } catch (error) {
        logger.error('Graph DB Insert Error:', error);
        throw new Error('Failed to save to Neo4j');
    } finally {
        await session.close();
    }
};