import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * Splits a large string of text into smaller, overlapping chunks.
 * We use 500 characters with a 50-character overlap. This ensures that
 * when we generate embeddings or ask the LLM to extract entities, it 
 * has enough context per chunk without exceeding token limits or losing 
 * context at the boundaries.
 */
export const chunkText = async (text: string): Promise<string[]> => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
        // It tries to split on double-newline first (paragraphs), then single newlines, then spaces.
        separators: ['\n\n', '\n', ' ', ''], 
    });

    const documents = await splitter.createDocuments([text]);
    
    // We just need the raw text content from the Document objects
    return documents.map(doc => doc.pageContent);
};
