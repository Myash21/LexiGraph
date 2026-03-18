import { createClient } from '@supabase/supabase-js';
import neo4j from 'neo4j-driver';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER,process.env.NEO4J_PASSWORD));

const TEST_RUN_FILE = path.resolve('tmp', 'smoke-test-run.txt');

async function cleanup(testRun) {
  if (!testRun) {
    throw new Error('testRun is required for cleanup.');
  }

  console.log(`Cleaning up smoke test data for testRun=${testRun}`);
  await supabase.from('documents').delete().eq('metadata->>testRun', testRun);

  const session = driver.session();
  await session.run('MATCH (n:Entity {source:$testRun}) DETACH DELETE n', { testRun });
  await session.close();
  await driver.close();
}

const run = async () => {
  const argTestRun = process.argv[2];
  const fileTestRun = fs.existsSync(TEST_RUN_FILE) ? fs.readFileSync(TEST_RUN_FILE, 'utf-8').trim() : undefined;
  const testRun = argTestRun || fileTestRun;

  if (!testRun) {
    throw new Error('No mode found. Provide testRun as argument or ensure tmp/smoke-test-run.txt exists.');
  }

  await cleanup(testRun);
};

run().catch(err => {
  console.error('cleanup-smoke error:', err);
  process.exit(1);
});