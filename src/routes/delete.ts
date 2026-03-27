import { deleteDocument } from '../services/deletion';
import { logger } from '../utils/logger';
import type { FastifyInstance } from 'fastify';

export default async function (server: FastifyInstance) {
    server.delete('/documents', async (request, reply) => {
        const userId = (request as any).user.id;
        const { source } = request.body as { source: string };

        if (!source?.trim()) {
            return reply.status(400).send({ error: 'source is required' });
        }

        try {
            const result = await deleteDocument(source, userId);
            return reply.send({
                success: true,
                message: `Deleted "${source}" successfully`,
                ...result   // deletedChunks, deletedNodes
            });
        } catch (error: any) {
            logger.error(error);
            return reply.status(500).send({
                error: 'Failed to delete document',
                details: error.message
            });
        }
    });
}