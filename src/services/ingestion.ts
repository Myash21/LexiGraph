import { chunkText } from '../utils/chunker';
import { getEmbedding } from '../config/embeddings';
import { extractGraphEntities } from './extraction';
import { saveToVectorDB, saveToGraphDB } from './storage';

export const ingestDocument = async (text: string, sourceMetadata: any = {}) => {
    console.log(`Starting ingestion. Total document length: ${text.length} characters.`);

    // 1. Chunk the text
    const chunks = await chunkText(text);
    console.log(`Split document into ${chunks.length} chunks.`);

    // 2. Process each chunk
    // Note: We process them sequentially here to avoid hitting LLM or Vector DB rate limits.
    // In a prod environment, a queue (like BullMQ) or controlled concurrency (like p-map) is better.
    let count = 0;
    for (const chunk of chunks) {
        count++;
        console.log(`Processing chunk ${count}/${chunks.length}...`);

        try {
            // A. Get Embeddings
            const embedding = await getEmbedding(chunk);

            // B. Write to Vector DB (Supabase)
            // We store the chunk text itself alongside its embedding so we can retrieve it later
            await saveToVectorDB(chunk, embedding, sourceMetadata);

            // C. Extract Graph Entities using LLM
            const graphData = await extractGraphEntities(chunk);

            // D. Write Nodes and Edges to Graph DB (Neo4j)
            await saveToGraphDB(graphData, sourceMetadata);

        } catch (error) {
            console.error(`Error processing chunk ${count}:`, error);
            // Decide whether to fail the whole document or continue
        }
    }

    console.log("Ingestion completed successfully.");
    return { success: true, chunksProcessed: chunks.length };
};
