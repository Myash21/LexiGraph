import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { loggerStorage } from './utils/logger';
import rateLimit from '@fastify/rate-limit';

const server = Fastify({
    logger: true, // Enables fastify's built-in Pino logger
    genReqId: () => randomUUID(),
});

// A simple health-check route
server.get('/health', async (request, reply) => {
    return { status: 'ok', service: 'LexiGraph API' };
});

import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import apiRoutes from './routes/index';
import { verifyNeo4jConnection } from './config/neo4j';
import { getEmbedding } from './config/embeddings';

const start = async () => {
    try {
        server.addHook('onRequest', (request, reply, done) => {
            loggerStorage.run(request.id, () => {
                done();
            });
        });
        await server.register(multipart, {
            limits: {
                fieldNameSize: 100,      // Max field name size in bytes
                fieldSize: 1000000,      // Max field value size in bytes (1MB)
                fileSize: 10 * 1024 * 1024, // Max file size in bytes (Set to 10MB)
                files: 1                 // Max number of file fields
            },
            attachFieldsToBody: false    // Keep this false if you want to use request.parts()
        });
        await server.register(cors);
        await server.register(rateLimit, {
            max: 10,
            timeWindow: '1 minute'
        });
        await server.register(apiRoutes);

        console.log('Verifying Database connections...');
        await verifyNeo4jConnection();
        // Supabase REST client doesn't need explicit connect(), but we could do a ping query later.

        console.log('Preloading embedding model...');
        await getEmbedding("Test preloading...");

        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server is running on http://localhost:3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
