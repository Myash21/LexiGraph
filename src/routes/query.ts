import type { FastifyInstance } from "fastify";
import { answerQuery } from "../services/retrieval";

export default async function queryRoutes(server: FastifyInstance) {
    server.post('/query', async (request, reply) => {
        const { query } = request.body as { query: string };
        const userId = (request as any).user.id;

        if (!query) {
            return reply.status(400).send({ error: "Missing 'query' in request body." });
        }

        try {
            const result = await answerQuery(query, userId);
            return reply.send({ answer: result });
        } catch (error: any) {
            server.log.error(error);
            return reply.status(500).send({ error: "Retrieval failed.", details: error.message });
        }
    });
}