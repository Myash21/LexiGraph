import { pipeline } from '@huggingface/transformers';

// We wrap the local embedding model creation in a singleton pattern
// to ensure we only load it into memory once.
class LocalEmbeddings {
    static instance: any = null;

    static async getInstance() {
        if (!this.instance) {
            console.log('Loading all-MiniLM-L6-v2 model into memory...');
            // This will download the model weights (approx 80MB) on the first run
            // and cache them locally for subsequent runs.
            this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            console.log('Model loaded successfully.');
        }
        return this.instance;
    }
}

// Utility function to get embeddings for a single text string
export const getEmbedding = async (text: string): Promise<number[]> => {
    const embedder = await LocalEmbeddings.getInstance();

    // pooling: 'mean' and normalize: true are standard config for sentence-transformers
    const output = await embedder(text, { pooling: 'mean', normalize: true });

    // Convert the Tensor output to a standard JS Array of numbers
    return Array.from(output.data);
};

// Utility function to get embeddings for an array of strings (e.g., document chunks)
export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
    const embeddings = [];
    for (const text of texts) {
        embeddings.push(await getEmbedding(text));
    }
    return embeddings;
};
