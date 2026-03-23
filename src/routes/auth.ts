import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { request } from "node:http";
import { access } from "node:fs";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!
)

export default async function authRoutes(server: FastifyInstance) {
    //Register
    server.post('auth/register', async (request, reply) => {
        const { email, password } = request.body as {
            email: string,
            password: string
        };
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return reply.status(400).send({ error: error.message });

        return reply.send({ message: "User registered successfully", user: data.user })
    })

    //Login
    server.post('auth/login', async (request, reply) => {
        const { email, password } = request.body as {
            email: string,
            password: string
        };
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return reply.status(401).send({ error: error.message });

        return reply.send({
            access_token: data.session?.access_token,
            refresh_token: data.session?.refresh_token,
            user: data.user
        });
    });

    //Refresh Token
    server.post('auth/refresh', async (request, reply) => {
        const { refresh_token } = request.body as { refresh_token: string };

        const { data, error } = await supabase.auth.refreshSession({ refresh_token });
        if (error) return reply.status(401).send({ error: error.message });

        return reply.send({ access_token: data.session?.access_token });
    });
}