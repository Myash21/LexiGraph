import { neo4jDriver } from "../config/neo4j";
import { logger } from "../utils/logger";

export const getUserGraph = async (userId: string): Promise<{
    nodes: Array<{
        id: string;
        type: string;
        source: string | null;
    }>;
    edges: Array<{
        source: string;
        target: string;
        type: string;
    }>;
}> => {
    const session = neo4jDriver.session();

    try {
        const result = await session.run(`
      MATCH (n:Entity {userId: $userId})
      OPTIONAL MATCH (n)-[r]->(neighbor:Entity {userId: $userId})
      RETURN 
        n.id AS nodeId,
        n.type AS nodeType,
        n.source AS nodeSource,
        neighbor.id AS neighborId,
        neighbor.type AS neighborType,
        type(r) AS relType
    `, { userId });

        // Build deduplicated nodes and edges from records
        const nodesMap = new Map<string, { id: string; type: string; source: string | null }>();
        const edgesSet = new Set<string>();
        const edges: Array<{ source: string; target: string; type: string }> = [];

        for (const record of result.records) {
            const nodeId = record.get('nodeId');
            const nodeType = record.get('nodeType');
            const nodeSource = record.get('nodeSource');
            const neighborId = record.get('neighborId');
            const relType = record.get('relType');

            // Add source node if not seen
            if (nodeId && !nodesMap.has(nodeId)) {
                nodesMap.set(nodeId, {
                    id: nodeId,
                    type: nodeType || 'UNKNOWN',
                    source: nodeSource || null,
                });
            }

            // Add neighbor node if exists and not seen
            if (neighborId && !nodesMap.has(neighborId)) {
                nodesMap.set(neighborId, {
                    id: neighborId,
                    type: record.get('neighborType') || 'UNKNOWN',
                    source: null,
                });
            }

            // Add edge if exists and not duplicate
            if (neighborId && relType) {
                const edgeKey = `${nodeId}-${relType}-${neighborId}`;
                if (!edgesSet.has(edgeKey)) {
                    edgesSet.add(edgeKey);
                    edges.push({
                        source: nodeId,
                        target: neighborId,
                        type: relType,
                    });
                }
            }
        }

        logger.log(`getUserGraph → ${nodesMap.size} nodes, ${edges.length} edges for user ${userId}`);

        return {
            nodes: [...nodesMap.values()],
            edges,
        };

    } catch (error) {
        logger.error('Graph fetch error:', error);
        throw new Error('Failed to fetch graph data');
    } finally {
        await session.close();
    }
};