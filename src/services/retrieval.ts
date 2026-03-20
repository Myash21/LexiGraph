import { supabase } from '../config/supabase';
import { neo4jDriver } from '../config/neo4j';
import { getEmbedding } from '../config/embeddings';
import { extractGraphEntities } from './extraction';
import { llm } from '../config/llm';
import { normalizeText, canonicalizeQueryNodeIds } from '../utils/normalize';

/**
 * Perform a Hybrid Search (Vector + Graph) to answer user queries with high context.
 */
export const answerQuery = async (query: string): Promise<string> => {
    console.log(`Processing Query: "${query}"`);

    // --- 1. Vector Search (Semantic Context) ---
    console.log("Generating query embedding and querying vector DB...");
    const queryEmbedding = await getEmbedding(query);

    // Calls a Supabase RPC function we define in SQL (match_documents)
    const { data: vectorResults, error: vectorError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5, // Only get somewhat relevant chunks
        match_count: 3        // Top K chunks
    });

    if (vectorError) {
        console.error("Vector Search Error:", vectorError);
    }
    const vectorContextText = (vectorResults || []).map((v: any) => v.content).join('\n---\n');
    console.log("vectorResults.length: ", vectorResults.length);
    console.log("vectorContextText: ", vectorContextText);

    // --- 2. Graph Search (Relational Context) ---
    console.log("Extracting entities from query and traversing graph DB...");
    // We use the same extraction LLM to figure out what entities the user is asking about
    const queryEntities = await extractGraphEntities(query);
    console.log("queryEntities: ", JSON.stringify(queryEntities))
    const nodeIds = queryEntities.nodes.map(n => n.id);
    console.log("nodeIds: ", nodeIds)

    let graphContextText = "";
    if (nodeIds.length > 0) {
        const canonicalNodeIds = canonicalizeQueryNodeIds(nodeIds);
        console.log('canonicalNodeIds:', canonicalNodeIds);

        const session = neo4jDriver.session();
        try {
            // Find 1-hop neighborhood for all candidate node IDs (strict canonical match)
            const result = await session.run(`
                UNWIND $nodeIds AS id
                MATCH (n:Entity)
                WHERE n.id IN $nodeIds
                OPTIONAL MATCH (n)-[r]-(neighbor:Entity)
                RETURN n.id AS source, type(r) AS relation, neighbor.id AS target
                LIMIT 30
            `, { nodeIds: canonicalNodeIds });

            graphContextText = result.records.map(rec =>
                `${rec.get('source')} -[${rec.get('relation')}]-> ${rec.get('target')}`
            ).join('\n');

        } catch (err) {
            console.error("Graph Traversal Error:", err);
        } finally {
            await session.close();
        }

        if (!graphContextText) {
            // Fallback: try lenient partial string matching by raw extracted ids
            const fallbackSession = neo4jDriver.session();
            try {
                const bareNames = nodeIds.map(id => {
                    const normalized = normalizeText(id);
                    const match = normalized.match(/^[A-Z]+_(.+)$/);
                    return match ? match[1] : normalized;
                });
                //Fallback Cypher
                const fallbackResult = await fallbackSession.run(`
                UNWIND $bareNames AS name
                MATCH (n:Entity)
                WHERE n.id ENDS WITH name OR n.id CONTAINS name
                OPTIONAL MATCH (n)-[r]-(neighbor:Entity)
                RETURN n.id AS source, type(r) AS relation, neighbor.id AS target
                LIMIT 30
                `, { bareNames });

                graphContextText = fallbackResult.records.map(rec =>
                    `${rec.get('source')} -[${rec.get('relation')}]-> ${rec.get('target')}`
                ).join('\n');
            } catch (err) {
                console.error('Graph Fallback Traversal Error:', err);
            } finally {
                await fallbackSession.close();
            }
        }
    }

    console.log('graphContextText:', graphContextText || 'No relational context found.');
    // --- 3. Synthesize Final Answer with LLM ---
    console.log("Synthesizing final response...");

    const finalPrompt = `
    You are LexiGraph, a highly intelligent Knowledge Assistant.
    Answer the user's question based strictly on the provided Contexts. 
    If the contexts do not contain the answer, say "I don't have enough information."
    
    VECTOR CONTEXT (Semantic Chunks):
    ${vectorContextText || "No semantic context found."}
    
    GRAPH CONTEXT (Entity Relations):
    ${graphContextText || "No relational context found."}
    
    USER QUESTION:
    "${query}"
    
    Your factual answer:
    `;

    const response = await llm.invoke(finalPrompt);
    console.log(response.content)
    return response.content as string;
};
