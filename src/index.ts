import Fastify from 'fastify';

const server = Fastify({
    logger: true, // Enables fastify's built-in Pino logger
});

// A simple health-check route
server.get('/health', async (request, reply) => {
    return { status: 'ok', service: 'LexiGraph API' };
});

import { verifyNeo4jConnection } from './config/neo4j';
import { getEmbedding } from './config/embeddings';

const start = async () => {
    try {
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
