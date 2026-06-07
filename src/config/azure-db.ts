import pg from 'pg';

const { Pool } = pg;

// Azure Database for PostgreSQL – Flexible Server connection pool
// Requires SSL (enforced by Azure by default)
const pool = new Pool({
    host: process.env.AZURE_PG_HOST,           // e.g. lexigraph.postgres.database.azure.com
    port: Number(process.env.AZURE_PG_PORT) || 5432,
    database: process.env.AZURE_PG_DATABASE || 'lexigraph',
    user: process.env.AZURE_PG_USER,           // e.g. lexigraphadmin
    password: process.env.AZURE_PG_PASSWORD,
    ssl: {
        rejectUnauthorized: true,              // Azure requires SSL
    },
    max: 10,                                   // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('[Azure DB] Unexpected pool error:', err);
});

// Health check / warm-up — called from index.ts on startup
export const verifyDbConnection = async () => {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        console.log('[Azure DB] PostgreSQL connection verified.');
    } finally {
        client.release();
    }
};

export { pool };
