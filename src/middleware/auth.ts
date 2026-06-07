import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET) {
    console.warn('[Auth] WARNING: JWT_SECRET is not set. Auth will fail.');
}

/**
 * Fastify pre-handler auth middleware.
 *
 * Verifies JWTs signed by this server using JWT_SECRET (HS256).
 * On success, attaches request.user = { id, email, name }
 * which is used as userId throughout all services.
 */
export async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
) {
    if (request.method === 'OPTIONS') return;

    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
        }) as jwt.JwtPayload;

        (request as any).user = {
            id: payload.sub,        // UUID from users table
            email: payload.email,
            name: payload.name ?? '',
        };

    } catch (err: any) {
        request.log.warn({ err }, '[Auth] Token verification failed');
        return reply.status(401).send({ error: 'Invalid or expired token.' });
    }
}
