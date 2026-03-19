import { afterAll, describe, it, expect } from 'vitest';
import fetch from 'node-fetch'; // or undici
import { createClient } from '@supabase/supabase-js';
import neo4j from 'neo4j-driver';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TEST_RUN = process.env.TEST_RUN || `vitest-${Date.now()}`;

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_PRIVATE_KEY || '');
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password123')
);

afterAll(async () => {
  await supabase.from('documents').delete().eq('metadata->>testRun', TEST_RUN);
  const session = driver.session();
  await session.run('MATCH (n:Entity {source:$testRun}) DETACH DELETE n', { testRun: TEST_RUN });
  await session.close();
  await driver.close();
});

describe('LexiGraph API', () => {
  it('should ingest and query document', async () => {
    const ingestRes = await fetch(`${BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Alice visited Neo4j.', metadata: { testRun: TEST_RUN } }),
    });

    expect(ingestRes.status).toBe(200);
    const ingestJson = await ingestRes.json();
    expect(ingestJson.success).toBeTruthy();

    const queryRes = await fetch(`${BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Who visited Neo4j?' }),
    });
    expect(queryRes.status).toBe(200);
    const queryJson = await queryRes.json();
    expect(queryJson.answer).toEqual(expect.stringContaining('Alice'));
  });
}, 20000);