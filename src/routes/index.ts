import type { FastifyInstance } from 'fastify';
import { ingestDocument } from '../services/ingestion';
import { answerQuery } from '../services/retrieval';
import { LoadPDf } from '../utils/pdfloader';

export default async function apiRoutes(server: FastifyInstance) {
    // 1. Ingestion Endpoint
    server.post('/ingest', async (request, reply) => {
        let text = '';
        let metadata: any = {};

        // Handle File Upload (PDF)
        if (request.isMultipart()) {
            const data = await request.file();
            if (!data) return reply.status(400).send({ error: "No file provided" });

            try {
                ({ text, metadata } = await LoadPDf(data));
            } catch (error: any) {
                server.log.error(error);
                return reply.status(500).send({ error: "LangChain failed to load PDF", details: error.message });
            }
        }
        // Handle JSON Body fallback
        else {
            const body = request.body as { text: string; metadata?: any };
            text = body.text;
            metadata = body.metadata || {};
        }

        if (!text) {
            return reply.status(400).send({ error: "No content found to ingest." });
        }

        try {
            const result = await ingestDocument(text, metadata);
            return reply.send(result);
        } catch (error: any) {
            server.log.error(error);
            return reply.status(500).send({ error: "Ingestion failed.", details: error.message });
        }
    });

    // 2. Query Endpoint (Hybrid Search)
    server.post('/query', async (request, reply) => {
        const { query } = request.body as { query: string };

        if (!query) {
            return reply.status(400).send({ error: "Missing 'query' in request body." });
        }

        try {
            const result = await answerQuery(query);
            return reply.send({ answer: result });
        } catch (error: any) {
            server.log.error(error);
            return reply.status(500).send({ error: "Retrieval failed.", details: error.message });
        }
    });
}
