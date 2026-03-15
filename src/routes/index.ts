import type { FastifyInstance } from 'fastify';
import { ingestDocument } from '../services/ingestion';
import { answerQuery } from '../services/retrieval';

export default async function apiRoutes(server: FastifyInstance) {
    // 1. Ingestion Endpoint
    server.post('/ingest', async (request, reply) => {
        const { text, metadata } = request.body as { text: string; metadata?: any };

        if (!text) {
            return reply.status(400).send({ error: "Missing 'text' in request body." });
        }

        try {
            const result = await ingestDocument(text, metadata || {});
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
