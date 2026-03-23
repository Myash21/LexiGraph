import type { FastifyInstance } from 'fastify';
import { ingestDocument } from '../services/ingestion';
import { answerQuery } from '../services/retrieval';
import { loadWebPage, loadFile } from '../utils/loaders';
import authRoutes from './auth';
import { authMiddleware } from '../middleware/auth';

export default async function apiRoutes(server: FastifyInstance) {
    // A simple health-check route-No auth needed
    server.get('/health', async (request, reply) => {
        return { status: 'ok', service: 'LexiGraph API' };
    });

    await server.register(authRoutes);

    // Everything below this hook requires a valid token
    server.addHook('preHandler', authMiddleware);

    // 1. Ingestion Endpoint
    server.post('/ingest', async (request, reply) => {
        let text = '';
        let metadata: any = {};

        // ── 1. File upload (multipart) ──────────────────────────────────────────
        if (request.isMultipart()) {
            const data = await request.file();
            if (!data) return reply.status(400).send({ error: "No file provided" });

            const supported = ['.pdf', '.txt', '.docx'];
            const ext = data.filename.slice(data.filename.lastIndexOf('.')).toLowerCase();

            if (!supported.includes(ext)) {
                return reply.status(415).send({
                    error: `Unsupported file type: ${ext}`,
                    supported,
                });
            }

            try {
                ({ text, metadata } = await loadFile(data));
            } catch (err: any) {
                server.log.error(err);
                return reply.status(500).send({ error: "File loading failed", details: err.message });
            }
        }

        // ── 2. Web page URL (JSON body with `url` key) ──────────────────────────
        else {
            const body = request.body as { text?: string; url?: string; metadata?: any };

            if (body.url) {
                try {
                    ({ text, metadata } = await loadWebPage(body.url));
                } catch (err: any) {
                    server.log.error(err);
                    return reply.status(500).send({ error: "Web page loading failed", details: err.message });
                }
            }

            // ── 3. Raw text fallback ─────────────────────────────────────────────
            else if (body.text) {
                text = body.text;
                metadata = body.metadata || {};
            }
        }

        if (!text?.trim()) {
            return reply.status(400).send({ error: "No content found to ingest." });
        }

        try {
            const result = await ingestDocument(text, metadata);
            return reply.send(result);
        } catch (err: any) {
            server.log.error(err);
            return reply.status(500).send({ error: "Ingestion failed.", details: err.message });
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
