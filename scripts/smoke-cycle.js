import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Running smoke test with cycle...');

const smoke = spawnSync('node', ['scripts/smoke-test.js'], {
  stdio: 'inherit',
  env: process.env,
});

if (smoke.status !== 0) {
  console.error('Smoke test failed. Will not run cleanup');
  process.exit(smoke.status || 1);
}

const testRunFile = path.resolve('tmp', 'smoke-test-run.txt');
let testRun = null;
if (fs.existsSync(testRunFile)) {
  testRun = fs.readFileSync(testRunFile, 'utf-8').trim();
}

if (!testRun) {
  console.error('No testRun found, abort cleanup.');
  process.exit(1);
}

const cleanup = spawnSync('node', ['scripts/cleanup-smoke.js', testRun], {
  stdio: 'inherit',
  env: process.env,
});

if (cleanup.status !== 0) {
  console.error('Cleanup failed');
  process.exit(cleanup.status || 1);
}

console.log('Smoke cycle passed and cleanup completed.');
process.exit(0);
