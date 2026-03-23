import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { request } from "node:http";

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
        }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return reply.status(400).send({ error: error.message })

        return reply.send({ message: "User registered successfully", user: data.user })
    })
}