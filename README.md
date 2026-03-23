# 🧠 LexiGraph API

**LexiGraph** is a high-performance Hybrid GraphRAG (Retrieval-Augmented Generation) backend service. It combines the semantic power of **Vector Databases** with the structured relationship insights of **Knowledge Graphs** to provide deeply contextualized and grounded AI responses.

---

## 📋 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Data Models](#-data-models)
- [Environment Variables](#-environment-variables)
- [Testing](#-testing)

---

## 🌟 Overview
LexiGraph addresses the limitations of traditional RAG by maintaining a dual-index system:
1. **Vector Index:** Captures nuanced semantic meanings of text chunks.
2. **Graph Index:** Preserves explicit entities (Concepts, People, Events) and their inter-relationships.

When a query is received, LexiGraph performs a **Hybrid Search**—traversing the knowledge graph and searching the vector space simultaneously—before reranking the results via an LLM to deliver a precise, cited answer.

---

## ✨ Key Features
- **Multi-Source Ingestion:** Seamlessly ingest PDFs, DOCX, TXT files, and Web Page URLs.
- **Automated Graph Construction:** Uses LLMs to automatically identify entities and relationships from ingested text.
- **Hybrid Search Algorithm:** Combines semantic similarity with graph-based neighbor traversal.
- **Fastify-Powered:** Built on Bun and Fastify for sub-millisecond routing and type-safe development.
- **Rate Limiting:** Built-in protection against API abuse using `@fastify/rate-limit`.
- **Observability:** Traceable requests with unique IDs and automatic **Request Duration Logging** for performance monitoring.

---

## 🏗 Architecture

### Project Structure
```text
src/
├── config/         # Database and LLM configurations (Neo4j, Supabase, Gemini)
├── routes/         # API endpoint definitions
├── services/       # Core business logic (Ingestion, Retrieval, Extraction)
├── types/          # TypeScript interfaces and types
├── utils/          # Helper functions (Chunkers, Loaders)
└── index.ts        # Server entry point
```

### Core Logic Flow
#### 📥 Ingestion Service
1. **Extraction:** Parses source files (PDF/DOCX/Web) into clean text.
2. **Chunking:** Splits text into manageable segments for embedding.
3. **Dual-Indexing:**
   - **Vector:** Generates embeddings and saves chunks to **Supabase**.
   - **Graph:** Extracts entities/relationships and saves to **Neo4j**.

#### 🔍 Retrieval Service
1. **Semantic Search:** Queries Supabase for the top-k most relevant chunks.
2. **Graph Traversal:** Queries Neo4j for entities found in the prompt and their multi-hop neighbors.
3. **Reranking & Synthesis:** Combines context from both sources and passes it to the LLM (Gemini/Groq) for the final response.

---

## 🛠 Tech Stack
- **Runtime:** [Bun](https://bun.sh/)
- **API Framework:** [Fastify](https://www.fastify.io/)
- **Orchestration:** [LangChain.js](https://js.langchain.com/)
- **Graph Database:** [Neo4j](https://neo4j.com/)
- **Vector Database:** [Supabase](https://supabase.com/) (pgvector)
- **LLMs:** Google Gemini, Groq (Llama-3)
- **Embeddings:** HuggingFace / Gemini
- **Parsing:** PDF.js, Mammoth (DOCX), Cheerio (Web)

---

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh/docs/installation) installed on your machine.
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) for running Neo4j.
- A Supabase project (Vector DB).

### Docker Setup (Neo4j)
LexiGraph requires **Neo4j** with the **APOC plugin** enabled. You can spin this up easily using the provided Docker Compose file:

1. Start the Neo4j container:
   ```bash
   docker-compose up -d
   ```
2. The database will be available at:
   - **Bolt:** `bolt://localhost:7687` (used by the API)
   - **Browser UI:** `http://localhost:7474` (User: `neo4j`, Password: `password123`)

### Installation
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd LexiGraph
   ```
2. Install dependencies:
   ```bash
   bun install
   ```

### Running the Server
- **Development (Watch Mode):**
  ```bash
  bun run dev
  ```
- **Production:**
  ```bash
  bun run start
  ```

---

## 🔌 API Documentation

### 1. Health Check
`GET /health`
- **Response:** `{ "status": "ok", "service": "LexiGraph API" }`

### 2. Ingestion
`POST /ingest`
- **Form Data (File):** Upload a `.pdf`, `.docx`, or `.txt` file.
- **JSON Body (URL):** `{ "url": "https://example.com" }`
- **JSON Body (Text):** `{ "text": "Your raw text here", "metadata": {} }`

### 3. Query (Hybrid Search)
`POST /query`
- **Body:** `{ "query": "What is the relationship between X and Y?" }`
- **Response:** `{ "answer": "Detailed LLM response based on graph and vector data." }`

### 4. Errors
- **429 Too Many Requests:** Returned when the rate limit is exceeded (Default: 10 requests per minute).
- **400 Bad Request:** Returned for missing or malformed inputs.
- **500 Internal Server Error:** Returned for database or LLM failures.

---

## 📊 Data Models

### Vector DB (Supabase)
- **Table:** `documents`
- **Fields:** `content` (TEXT), `embedding` (VECTOR), `metadata` (JSONB)

### Graph DB (Neo4j)
- **Nodes:** `Entity { id, type, source }`
- **Edges:** Dynamic relationships defined by LLM (e.g., `WORKS_AT`, `PART_OF`, `AUTHORED_BY`).

---

## 🔑 Environment Variables
Create a `.env` file in the root directory:

```env
PORT=3000
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
SUPABASE_URL=your_supabase_url
SUPABASE_PRIVATE_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

---

## 🧪 Testing
LexiGraph uses **Vitest** for testing.
- **Unit Tests:** `bun run test:unit`
- **Integration Tests:** `bun run test:integration`
- **All Tests:** `bun run test`

---

## 📜 License
This project is licensed under the MIT License.
LexiGraph