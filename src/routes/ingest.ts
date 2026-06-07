import type { FastifyInstance } from 'fastify';
import { ingestDocument } from '../services/ingestion';
import { loadWebPage, loadFile } from '../utils/loaders';
import { uploadToBlob } from '../config/azure-storage';

export default async function ingestRoutes(server: FastifyInstance) {
    server.post('/ingest', async (request, reply) => {
        let text = '';
        let metadata: any = {};
        const userId = (request as any).user.id;

        // ── 1. File upload (multipart) ──────────────────────────────────────────
        if (request.isMultipart()) {
            const data = await request.file();
            if (!data) return reply.status(400).send({ error: 'No file provided' });

            const supported = ['.pdf', '.txt', '.docx'];
            const ext = data.filename.slice(data.filename.lastIndexOf('.')).toLowerCase();

            if (!supported.includes(ext)) {
                return reply.status(415).send({ error: `Unsupported file type: ${ext}`, supported });
            }

            try {
                // Collect the multipart stream into a buffer so we can:
                //  A. Upload to Azure Blob Storage (durable storage, enables re-ingestion)
                //  B. Parse the text content for the GraphRAG pipeline
                const chunks: Buffer[] = [];
                for await (const chunk of data.file) {
                    chunks.push(chunk);
                }
                const fileBuffer = Buffer.concat(chunks);

                // A. Upload to Azure Blob Storage
                // We recreate a Busboy-compatible object so loadFile still works
                const blobUrl = await uploadToBlob(
                    userId,
                    data.filename,
                    fileBuffer,
                    data.mimetype
                );

                // B. Parse text from the buffer (wrap buffer as async iterable for loadFile)
                const fileWithBuffer = {
                    ...data,
                    file: (async function* () { yield fileBuffer; })(),
                };
                ({ text, metadata } = await loadFile(fileWithBuffer as any));

                // Store blob URL in metadata — persisted to PostgreSQL documents table
                metadata.blobUrl = blobUrl;

            } catch (err: any) {
                server.log.error(err);
                return reply.status(500).send({ error: 'File loading failed', details: err.message });
            }
        }

        // ── 2. Web page URL ──────────────────────────────────────────────────────
        else {
            const body = request.body as { text?: string; url?: string; metadata?: any };

            if (body.url) {
                try {
                    ({ text, metadata } = await loadWebPage(body.url));
                } catch (err: any) {
                    server.log.error(err);
                    return reply.status(500).send({ error: 'Web page loading failed', details: err.message });
                }
            }

            // ── 3. Raw text fallback ─────────────────────────────────────────────
            else if (body.text) {
                text = body.text;
                metadata = body.metadata || {};
            }
        }

        if (!text?.trim()) {
            return reply.status(400).send({ error: 'No content found to ingest.' });
        }

        try {
            const result = await ingestDocument(text, metadata, userId);
            return reply.send(result);
        } catch (err: any) {
            server.log.error(err);
            return reply.status(500).send({ error: 'Ingestion failed.', details: err.message });
        }
    });
}
