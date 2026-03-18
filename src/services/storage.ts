import { neo4jDriver } from '../config/neo4j';
import { supabase } from '../config/supabase';
import type { GraphData } from './extraction';

export const saveToVectorDB = async (content: string, embedding: number[], metadata: any = {}) => {
    const { error } = await supabase.from('documents').insert({
        content,
        metadata,
        embedding
    });

    if (error) {
        console.error('Vector DB Insert Error:', error);
        throw new Error('Failed to save to Supabase');
    }
};

export const saveToGraphDB = async (graphData: GraphData, metadata: any = {}) => {
    if (graphData.nodes.length === 0 && graphData.edges.length === 0) return;

    const session = neo4jDriver.session();
    try {
        await session.executeWrite(async (tx) => {
            // 1. Insert Nodes using UNWIND for batch efficiency
            if (graphData.nodes.length > 0) {
                await tx.run(`
                    UNWIND $nodes AS node
                    MERGE (n:Entity {id: node.id})
                    SET n.type = node.type,
                        n.source = coalesce($sourceMetadata, n.source)
                `, { nodes: graphData.nodes, sourceMetadata: metadata?.testRun || metadata?.source || null });
            }

            // 2. Insert Edges (Using APOC for dynamic relationship types based on LLM output)
            if (graphData.edges.length > 0) {
                await tx.run(`
                    UNWIND $edges AS edge
                    MATCH (source:Entity {id: edge.source})
                    MATCH (target:Entity {id: edge.target})
                    CALL apoc.merge.relationship(source, edge.type, {}, {}, target, {}) YIELD rel
                    RETURN count(rel)
                `, { edges: graphData.edges });
            }
        });
        console.log(`Saved ${graphData.nodes.length} nodes and ${graphData.edges.length} edges to Neo4j.`);
    } catch (error) {
        console.error('Graph DB Insert Error:', error);
        throw new Error('Failed to save to Neo4j');
    } finally {
        await session.close();
    }
};
