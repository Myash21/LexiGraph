import type { FastifyInstance } from 'fastify';
import authRoutes from './auth';
import { authMiddleware } from '../middleware/auth';
import ingestRoutes from './ingest';
import queryRoutes from './query';
import graphRoutes from './graph';
import docsRoutes from './docs';
import deleteRoutes from './delete';

export default async function apiRoutes(server: FastifyInstance) {
    // A simple health-check route-No auth needed
    server.get('/health', async (request, reply) => {
        return { status: 'ok', service: 'LexiGraph API' };
    });

    await server.register(authRoutes);

    // ─── Protected Routes ───────────────────────────────────────────────────
    server.register(async (protectedContext) => {
        // Everything inside this block requires a valid token
        protectedContext.addHook('preHandler', authMiddleware);

        // 1. Ingestion Endpoint
        protectedContext.register(ingestRoutes);

        // 2. Query Endpoint (Hybrid Search)
        protectedContext.register(queryRoutes);

        // 3. Graph Endpoint
        protectedContext.register(graphRoutes);

        // 4. Documents Endpoint
        protectedContext.register(docsRoutes);

        // 5. Delete Endpoint
        protectedContext.register(deleteRoutes);
    });
}