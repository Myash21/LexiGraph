import Fastify from 'fastify';

const server = Fastify({
    logger: true, // Enables fastify's built-in Pino logger
});

// A simple health-check route
server.get('/health', async (request, reply) => {
    return { status: 'ok', service: 'LexiGraph API' };
});

const start = async () => {
    try {
        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server is running on http://localhost:3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
