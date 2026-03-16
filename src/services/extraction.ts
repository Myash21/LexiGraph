import { z } from 'zod';
import { llm } from '../config/llm';

// 1. Define strict TypeScript interfaces using Zod
// This ensures Gemini only returns data in this exact shape.
export const NodeSchema = z.object({
    id: z.string().describe("A unique identifier for the entity, capitalized (e.g., 'COMPANY_OPENAI', 'PERSON_ELON_MUSK')."),
    type: z.string().describe("The categorization of the node (e.g., 'Person', 'Organization', 'Concept', 'Event')."),
    description: z.string().optional().describe("A brief summary or metadata about the entity."),
});

export const EdgeSchema = z.object({
    source: z.string().describe("The ID of the source Node."),
    target: z.string().describe("The ID of the target Node."),
    type: z.string().describe("The relationship between them (e.g., 'FOUNDED_BY', 'RELATES_TO', 'WORKS_AT')."),
    description: z.string().optional().describe("A brief summary or metadata about the relationship."),
});

export const GraphSchema = z.object({
    nodes: z.array(NodeSchema).describe("List of extracted nodes/entities"),
    edges: z.array(EdgeSchema).describe("List of relationships between nodes"),
});

export type GraphData = z.infer<typeof GraphSchema>;

// 2. Create the Extraction function using structured output
const normalizeText = (input: string) =>
  input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const canonicalizeNodeId = (id: string, type?: string) => {
  if (!id) return id;

  const normalized = normalizeText(id);
  const hasCanonicalPrefix = /^([A-Z]+)_/.test(normalized);

  if (hasCanonicalPrefix) {
    return normalized;
  }

  if (type) {
    const typeLabel = normalizeText(type);
    return `${typeLabel}_${normalized}`;
  }

  return normalized;
};

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
    - Prefer the pattern <TYPE>_<ENTITY>.
    - Edges MUST point from an existing source Node ID to an existing target Node ID.
    - If no relevant graph data is found, return empty arrays.
    - Return the main named entities and their canonical IDs (even if it is a question).

    Text block to analyze:
    """
    ${textChunk}
    """
    `;

    console.log("Analyzing chunk with Gemini...");
    const result = await structuredLlm.invoke(prompt);

    const nodes = (result.nodes || []).map((node: any) => ({
      ...node,
      id: canonicalizeNodeId(node.id, node.type),
      type: node.type ? normalizeText(node.type) : node.type,
    }));

    const nodeLookup = Object.fromEntries(nodes.map((node: any) => [node.id, node]));

    const edges = (result.edges || []).map((edge: any) => {
      const source = edge.source ? canonicalizeNodeId(edge.source, nodeLookup[edge.source]?.type || undefined) : edge.source;
      const target = edge.target ? canonicalizeNodeId(edge.target, nodeLookup[edge.target]?.type || undefined) : edge.target;
      return {
        ...edge,
        source,
        target,
      };
    });

    const normalizedResult = {
      nodes,
      edges,
    };

    console.log('extractGraphEntities ->', JSON.stringify(normalizedResult, null, 2));
    return normalizedResult;
};
