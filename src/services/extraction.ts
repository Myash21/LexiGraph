import { z } from 'zod';
import { llm } from '../config/llm';

// 1. Define strict TypeScript interfaces using Zod
// This ensures Gemini only returns data in this exact shape.
export const NodeSchema = z.object({
    id: z.string().describe("A unique identifier for the entity, capitalized (e.g., 'COMPANY_OPENAI', 'PERSON_ELON_MUSK')."),
    type: z.string().describe("The categorization of the node (e.g., 'Person', 'Organization', 'Concept', 'Event')."),
    properties: z.record(z.string(), z.any()).optional().describe("Any additional metadata about the entity."),
});

export const EdgeSchema = z.object({
    source: z.string().describe("The ID of the source Node."),
    target: z.string().describe("The ID of the target Node."),
    type: z.string().describe("The relationship between them (e.g., 'FOUNDED_BY', 'RELATES_TO', 'WORKS_AT')."),
    properties: z.record(z.string(), z.any()).optional().describe("Any additional metadata about the relationship."),
});

export const GraphSchema = z.object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
});

export type GraphData = z.infer<typeof GraphSchema>;

// 2. Create the Extraction function using structured output
export const extractGraphEntities = async (textChunk: string): Promise<GraphData> => {
    // Bind the Zod schema to our Gemini model
    const structuredLlm = llm.withStructuredOutput(GraphSchema, {
        name: "extract_knowledge_graph",
    });

    const prompt = `
    You are an expert Knowledge Graph architect.
    Analyze the following text and extract all significant entities (Nodes), 
    and the relationships between them (Edges).
    
    Rules:
    - Keep node IDs unique and standardized (e.g., uppercase with underscores).
    - Edges MUST point from an existing source Node ID to an existing target Node ID.
    - If no relevant graph data is found, return empty arrays.
    
    Text block to analyze:
    """
    ${textChunk}
    """
    `;

    console.log("Analyzing chunk with Gemini...");
    const result = await structuredLlm.invoke(prompt);
    
    return result;
};
