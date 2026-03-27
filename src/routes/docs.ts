import { getUserDocuments } from '../services/getUserDocs';
import { logger } from '../utils/logger';
import type { FastifyInstance } from 'fastify';

export default async function (server: FastifyInstance) {
    server.get('/documents', async (request, reply) => {
        const userId = (request as any).user.id;

        try {
            const documents = await getUserDocuments(userId);
            return reply.send({ documents });
        } catch (error: any) {
            logger.error(error);
            return reply.status(500).send({
                error: 'Failed to fetch documents',
                details: error.message
            });
        }
    });
}