import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { loggerStorage } from './utils/logger';
import rateLimit from '@fastify/rate-limit';

const server = Fastify({
    logger: true, // Enables fastify's built-in Pino logger
    genReqId: () => randomUUID(),
});

import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import apiRoutes from './routes/index';
import { verifyNeo4jConnection } from './config/neo4j';
import { getEmbedding } from './config/embeddings';

const start = async () => {
    try {
        server.addHook('onRequest', (request, reply, done) => {
            (request as any).startTime = performance.now();
            loggerStorage.run(request.id, () => {
                done();
            });
        });

        server.addHook('onResponse', (request, reply, done) => {
            const start = (request as any).startTime;
            const duration = (performance.now() - start).toFixed(2);
            console.log(`[${request.id}] ${request.method} ${request.url} completed in ${duration}ms`);
            done();
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

        await server.listen({
            port: Number(process.env.PORT) || 3000,
            host: '0.0.0.0'    // required for Render
        });
        console.log('Server is running on http://localhost:3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
