# Backend Specification: LexiGraph API (Hybrid GraphRAG)

## 1. Role
A high-performance API service responsible for PDF ingestion, Knowledge Graph construction, Vector embedding, and RAG orchestration.

## 2. Tech Stack
- **Language:** TypeScript (Node.js/Bun)
- **Framework:** Fastify (Type-safe)
- **AI Orchestration:** LangChain.js
- **Databases:** Neo4j (Graph), Pinecone/Supabase (Vector)
- **Testing:** Vitest (Unit/Integration)
- **Monitoring:** LangSmith / Helicone
- **Containerization:** Docker & Docker Compose

## 3. Core Logic Flow
### Ingestion Service:
1. **Extraction:** Parse PDF into clean text chunks.
2. **Entity Recognition:** Use LLM to identify Nodes (Concepts, People, Events) and Edges (Relationships).
3. **Dual-Indexing:** - Write chunks + embeddings to Vector DB.
   - Write Entities + Relationships (Cypher) to Neo4j.

### Retrieval Service (Hybrid Search):
1. **Semantic Search:** Query Vector DB for top-k chunks.
2. **Graph Traversal:** Query Neo4j for entities found in the user prompt and their neighbors.
3. **Reranking:** Combine results and pass to LLM for final response with citations.

## 4. Engineering Requirements
- **CI/CD:** GitHub Action to run `vitest` and check for "LLM Hallucinations" using an evaluation set.
- **Observability:** Every request must carry a Trace ID for LangSmith.
- **API Docs:** Auto-generated Swagger/OpenAPI spec.

## 5. Agent Instructions
- Prioritize **asynchronous processing** for PDF uploads (use a queue if possible).
- Use **Strict TypeScript interfaces** for all Graph Schema definitions.
- Implement **Rate Limiting** for LLM API calls.