import type { FastifyInstance } from "fastify";
import { getUserGraph } from "../services/getUserGraph";
import { logger } from "../utils/logger";

export default async function graphRoutes(server: FastifyInstance) {
    server.get('/graph', async (request, reply) => {
        const userId = (request as any).user.id;
        try {
            const graph = await getUserGraph(userId);
            return reply.send(graph);
        } catch (error: any) {
            logger.error(error);
            return reply.status(500).send({
                error: 'Failed to fetch graph',
                details: error.message
            });
        }
    });
}
