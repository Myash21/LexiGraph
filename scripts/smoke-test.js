import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TEST_RUN = process.env.TEST_RUN || `smoke-${Date.now()}`;
const TEST_RUN_FILE = path.resolve('tmp', 'smoke-test-run.txt');

async function run() {
  console.log('Running LexiGraph smoke test (testRun=' + TEST_RUN + ')...');

  if (!fs.existsSync('tmp')) {
    fs.mkdirSync('tmp');
  }
  fs.writeFileSync(TEST_RUN_FILE, TEST_RUN, 'utf-8');

  const ingestResp = await fetch(`${BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Alice visited Neo4j and then ingested knowledge into LexiGraph.',
      metadata: { testRun: TEST_RUN },
    }),
  });

  if (!ingestResp.ok) {
    console.error('Ingest endpoint failed:', ingestResp.status, await ingestResp.text());
    process.exit(1);
  }

  const ingestJson = await ingestResp.json();
  console.log('Ingest response:', ingestJson);

  const queryResp = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'Who visited Neo4j?' }),
  });

  if (!queryResp.ok) {
    console.error('Query endpoint failed:', queryResp.status, await queryResp.text());
    process.exit(1);
  }

  const queryJson = await queryResp.json();
  console.log('Query response:', queryJson);

  if (!queryJson.answer || !queryJson.answer.toLowerCase().includes('alice')) {
    console.error('Unexpected answer:', queryJson.answer);
    process.exit(1);
  }

  console.log('Smoke test passed.');
  process.exit(0);
}

run().catch(err => {
  console.error('Smoke test error:', err);
  process.exit(1);
});