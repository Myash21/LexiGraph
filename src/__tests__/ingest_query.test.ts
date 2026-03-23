import { beforeAll, afterAll, describe, it, expect } from 'bun:test';
import fetch from 'node-fetch'; // or undici
import { createClient } from '@supabase/supabase-js';
import neo4j from 'neo4j-driver';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TEST_RUN = process.env.TEST_RUN || `vitest-${Date.now()}`;
const TEST_EMAIL = `testuser_${Date.now()}@lexigraph.test`;
const TEST_PASSWORD = 'TestPassword123!';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_PRIVATE_KEY || '');
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password123')
);

let accessToken: string;
let userId: string;

// ── Setup: create a real test user and login ─────────────────────────────────
beforeAll(async () => {
  const registerRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  expect(registerRes.status).toBe(200);

  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  expect(loginRes.status).toBe(200);
  const loginJson = await loginRes.json();

  accessToken = loginJson.access_token;
  userId = loginJson.user.id;
});

// ── Cleanup: delete everything tied to this test user ────────────────────────
afterAll(async () => {
  // Delete vector rows by testRun metadata AND userId (both scoped now)
  await supabase
    .from('documents')
    .delete()
    .eq('metadata->>testRun', TEST_RUN)
    .eq('user_id', userId);

  // Delete graph nodes scoped to this user
  const session = driver.session();
  await session.run(
    'MATCH (n:Entity {userId: $userId, source: $testRun}) DETACH DELETE n',
    { userId, testRun: TEST_RUN }
  );
  await session.close();
  await driver.close();

  // Delete the test user from Supabase auth
  // Requires service role key — swap client temporarily
  const adminSupabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''  // ← add this to your .env
  );
  await adminSupabase.auth.admin.deleteUser(userId);
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('LexiGraph API', () => {

  it('should reject requests without a token', async () => {
    const res = await fetch(`${BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('should ingest and query document as authenticated user', async () => {
    const ingestRes = await fetch(`${BASE}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,   // ← token added
      },
      body: JSON.stringify({
        text: 'Alice visited Neo4j.',
        metadata: { testRun: TEST_RUN },
      }),
    });
    expect(ingestRes.status).toBe(200);
    const ingestJson = await ingestRes.json();
    expect(ingestJson.success).toBeTruthy();

    const queryRes = await fetch(`${BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,   // ← token added
      },
      body: JSON.stringify({ query: 'Who visited Neo4j?' }),
    });
    expect(queryRes.status).toBe(200);
    const queryJson = await queryRes.json();
    expect(queryJson.answer).toBeTruthy();
  }, 30000);

  it('should not return context across users', async () => {
    // Register and login a second user
    const email2 = `testuser2_${Date.now()}@lexigraph.test`;
    await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email2, password: TEST_PASSWORD }),
    });
    const login2 = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email2, password: TEST_PASSWORD }),
    });
    const { access_token: token2, user: user2 } = await login2.json();

    // Query as user2 — should get no relevant context from user1's data
    const queryRes = await fetch(`${BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token2}`,
      },
      body: JSON.stringify({ query: 'Who visited Neo4j?' }),
    });
    expect(queryRes.status).toBe(200);
    const queryJson = await queryRes.json();

    // Answer should NOT confidently mention Alice
    // (LLM may still hallucinate, but the context won't contain it)
    expect(queryJson.answer).not.toMatch(/based on the (provided |given )?context/i);

    // Cleanup user2
    const adminSupabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    await adminSupabase.auth.admin.deleteUser(user2.id);
  }, 30000);
});