import { afterAll, describe, it, expect } from 'bun:test';
import fetch from 'node-fetch';
import neo4j from 'neo4j-driver';
import { pool } from '../config/azure-db';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TEST_RUN = `test-${Date.now()}`;

// ── Test users — created fresh each run, cleaned up after ────────────────────
const USER_A = { email: `test-a-${Date.now()}@lexigraph.test`, password: 'TestPassword123', name: 'Test User A' };
const USER_B = { email: `test-b-${Date.now()}@lexigraph.test`, password: 'TestPassword123', name: 'Test User B' };

let tokenA = '';
let tokenB = '';
let userAId = '';

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password123'
  )
);

// ── Cleanup: delete all test data after the suite ─────────────────────────────
afterAll(async () => {
  // Delete test vector chunks from Azure PostgreSQL
  await pool.query(
    `DELETE FROM documents
         WHERE metadata->>'testRun' = $1`,
    [TEST_RUN]
  );

  // Delete test users from Azure PostgreSQL
  await pool.query(
    `DELETE FROM users WHERE email = $1 OR email = $2`,
    [USER_A.email, USER_B.email]
  );

  // Delete test graph nodes from Neo4j
  const session = neo4jDriver.session();
  await session.run(
    `MATCH (n:Entity {userId: $userId}) DETACH DELETE n`,
    { userId: userAId }
  );
  await session.close();
  await neo4jDriver.close();
  await pool.end();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('LexiGraph API — Azure edition', () => {

  // ── Auth ──────────────────────────────────────────────────────────────────
  it('should register user A and return tokens', async () => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(USER_A),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json).toHaveProperty('access_token');
    expect(json).toHaveProperty('refresh_token');
    expect(json.user.email).toBe(USER_A.email);
    tokenA = json.access_token;
    userAId = json.user.id;
  });

  it('should register user B and return tokens', async () => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(USER_B),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json).toHaveProperty('access_token');
    tokenB = json.access_token;
  });

  it('should login with correct credentials', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USER_A.email, password: USER_A.password }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toHaveProperty('access_token');
  });

  it('should reject login with wrong password', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USER_A.email, password: 'wrongpassword' }),
    });
    expect(res.status).toBe(401);
  });

  it('should reject requests without a token', async () => {
    const res = await fetch(`${BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  // ── Ingest + Query ────────────────────────────────────────────────────────
  it('should ingest a document as user A', async () => {
    const res = await fetch(`${BASE}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        text: 'Alice visited Neo4j headquarters in San Francisco.',
        metadata: { testRun: TEST_RUN },
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBeTruthy();
  }, 30000);

  it('should query and return answer + sources for user A', async () => {
    const res = await fetch(`${BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ query: 'Who visited Neo4j?' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json).toHaveProperty('answer');
    expect(typeof json.answer).toBe('string');
    expect(json).toHaveProperty('sources');
    expect(json.sources).toHaveProperty('vector');
    expect(json.sources).toHaveProperty('graph');
  }, 30000);

  // ── User Isolation ────────────────────────────────────────────────────────
  it('should enforce user isolation — user B cannot see user A data', async () => {
    const res = await fetch(`${BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ query: 'Who visited Neo4j?' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    // User B has no data — vector and graph results must be empty
    expect(json.sources.vector).toHaveLength(0);
    expect(json.sources.graph).toHaveLength(0);
  }, 30000);

  // ── Documents ─────────────────────────────────────────────────────────────
  it('should return documents list for user A', async () => {
    const res = await fetch(`${BASE}/documents`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(Array.isArray(json.documents ?? json)).toBe(true);
  });

  it('should return empty documents list for user B', async () => {
    const res = await fetch(`${BASE}/documents`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const docs = json.documents ?? json;
    expect(docs).toHaveLength(0);
  });

  // ── Token Refresh ─────────────────────────────────────────────────────────
  it('should issue a new access token via refresh token', async () => {
    // Re-login to get a fresh refresh token
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USER_A.email, password: USER_A.password }),
    });
    const { refresh_token } = await loginRes.json() as any;

    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });
    expect(refreshRes.status).toBe(200);
    const json = await refreshRes.json() as any;
    expect(json).toHaveProperty('access_token');
  });

});