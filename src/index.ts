import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { loggerStorage } from './utils/logger';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import apiRoutes from './routes/index';
import { verifyNeo4jConnection } from './config/neo4j';
import { verifyDbConnection } from './config/azure-db';   // ← replaces Supabase ping
import { getEmbedding } from './config/embeddings';

const server = Fastify({
    logger: true,
    genReqId: () => randomUUID(),
});

const start = async () => {
    try {
        server.addHook('onRequest', (request, reply, done) => {
            (request as any).startTime = performance.now();
            loggerStorage.run(request.id, () => { done(); });
        });

        server.addHook('onResponse', (request, reply, done) => {
            const start = (request as any).startTime;
            const duration = (performance.now() - start).toFixed(2);
            console.log(`[${request.id}] ${request.method} ${request.url} completed in ${duration}ms`);
            done();
        });

        await server.register(multipart, {
            limits: {
                fieldNameSize: 100,
                fieldSize: 1_000_000,
                fileSize: 10 * 1024 * 1024,   // 10 MB
                files: 1,
            },
            attachFieldsToBody: false,
        });

        await server.register(cors, {
            origin: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
        });

        await server.register(rateLimit, {
            max: 10,
            timeWindow: '1 minute',
            allowList: (request: import('fastify').FastifyRequest) => request.method === 'OPTIONS',
        });

        await server.register(apiRoutes);

        console.log('Verifying database connections...');
        await verifyNeo4jConnection();
        await verifyDbConnection();   // Azure PostgreSQL health check

        console.log('Preloading embedding model...');
        await getEmbedding('Test preloading...');

        await server.listen({
            port: Number(process.env.PORT) || 3000,
            host: '0.0.0.0',
        });

        console.log('Server is running on http://localhost:3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
