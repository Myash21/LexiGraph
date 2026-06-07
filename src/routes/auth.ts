import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../config/azure-db';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '24h';
const REFRESH_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

/**
 * Auth routes — email/password edition backed by Azure PostgreSQL.
 *
 * POST /auth/register  — create account
 * POST /auth/login     — login, returns access + refresh token
 * POST /auth/refresh   — exchange refresh token for new access token
 * GET  /auth/me        — return current user from token
 */
export default async function authRoutes(server: FastifyInstance) {

    // ── POST /auth/register ────────────────────────────────────────────────
    server.post('/auth/register', async (request, reply) => {
        const { email, password, name } = request.body as {
            email: string;
            password: string;
            name?: string;
        };

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email and password are required.' });
        }

        if (password.length < 6) {
            return reply.status(400).send({ error: 'Password must be at least 6 characters.' });
        }

        try {
            // Check if user already exists
            const existing = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase()]
            );

            if (existing.rows.length > 0) {
                return reply.status(409).send({ error: 'An account with this email already exists.' });
            }

            // Hash password and insert user
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            const { rows } = await pool.query<{ id: string }>(
                `INSERT INTO users (email, password, name)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [email.toLowerCase(), hashedPassword, name ?? '']
            );

            const userRow = rows[0];
            if (!userRow) {
                return reply.status(500).send({ error: 'Registration failed. Please try again.' });
            }
            const userId = userRow.id;

            // Issue tokens immediately so the user is logged in after register
            const { accessToken, refreshToken } = issueTokens(userId, email, name ?? '');

            return reply.status(201).send({
                access_token: accessToken,
                refresh_token: refreshToken,
                user: { id: userId, email, name: name ?? '' },
            });

        } catch (err) {
            server.log.error(err);
            return reply.status(500).send({ error: 'Registration failed. Please try again.' });
        }
    });

    // ── POST /auth/login ───────────────────────────────────────────────────
    server.post('/auth/login', async (request, reply) => {
        const { email, password } = request.body as {
            email: string;
            password: string;
        };

        if (!email || !password) {
            return reply.status(400).send({ error: 'Email and password are required.' });
        }

        try {
            const { rows } = await pool.query<{
                id: string;
                email: string;
                password: string;
                name: string;
            }>(
                'SELECT id, email, password, name FROM users WHERE email = $1',
                [email.toLowerCase()]
            );

            if (rows.length === 0) {
                // Vague error intentionally — don't reveal whether email exists
                return reply.status(401).send({ error: 'Invalid credentials.' });
            }

            const user = rows[0];
            if (!user) {
                return reply.status(401).send({ error: 'Invalid credentials.' });
            }
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                return reply.status(401).send({ error: 'Invalid credentials.' });
            }

            const { accessToken, refreshToken } = issueTokens(user.id, user.email, user.name);

            return reply.send({
                access_token: accessToken,
                refresh_token: refreshToken,
                user: { id: user.id, email: user.email, name: user.name },
            });

        } catch (err) {
            server.log.error(err);
            return reply.status(500).send({ error: 'Login failed. Please try again.' });
        }
    });

    // ── POST /auth/refresh ─────────────────────────────────────────────────
    server.post('/auth/refresh', async (request, reply) => {
        const { refresh_token } = request.body as { refresh_token: string };

        if (!refresh_token) {
            return reply.status(400).send({ error: 'refresh_token is required.' });
        }

        try {
            const payload = jwt.verify(refresh_token, JWT_SECRET) as jwt.JwtPayload;

            if (payload.type !== 'refresh') {
                return reply.status(401).send({ error: 'Invalid token type.' });
            }

            const { accessToken, refreshToken } = issueTokens(
                payload.sub!,
                payload.email,
                payload.name ?? ''
            );

            return reply.send({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

        } catch {
            return reply.status(401).send({ error: 'Invalid or expired refresh token.' });
        }
    });

    // ── GET /auth/me ───────────────────────────────────────────────────────
    server.get('/auth/me', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'No token provided.' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return reply.status(401).send({ error: 'No token provided.' });
        }
        try {
            const payload = jwt.verify(
                token,
                JWT_SECRET
            ) as jwt.JwtPayload;

            return reply.send({
                id: payload.sub,
                email: payload.email,
                name: payload.name ?? '',
            });
        } catch {
            return reply.status(401).send({ error: 'Invalid or expired token.' });
        }
    });
}

// ── Helper: issue access + refresh token pair ──────────────────────────────
function issueTokens(userId: string, email: string, name: string) {
    const accessToken = jwt.sign(
        { sub: userId, email, name, type: 'access' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
        { sub: userId, email, name, type: 'refresh' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
}
