#!/usr/bin/env node
/**
 * Resets Vercel env vars via REST API (much faster + reliable than CLI).
 * - Deletes all existing env vars across all targets
 * - Re-creates all vars from .env scoped to development, preview, production
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const AUTH_PATH = join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
const PROJECT_PATH = join(process.cwd(), '.vercel/project.json');

const auth = JSON.parse(readFileSync(AUTH_PATH, 'utf-8'));
const project = JSON.parse(readFileSync(PROJECT_PATH, 'utf-8'));
const TOKEN = auth.token;
const PROJECT_ID = project.projectId;
const TEAM_ID = project.orgId;
const API_BASE = `https://api.vercel.com`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

const TARGETS = ['development', 'preview', 'production'];

async function vfetch(path, opts = {}) {
  const url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM_ID}`;
  const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// Parse .env (last occurrence wins for duplicates)
const envContent = readFileSync('.env', 'utf-8');
const envMap = new Map();
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  let value = trimmed.slice(eq + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  envMap.set(key, value);
}
console.log(`Found ${envMap.size} unique vars in .env`);

// Step 1: List existing env vars
console.log('\n=== Listing existing env vars ===');
const list = await vfetch(`/v9/projects/${PROJECT_ID}/env`);
const existing = list.envs || [];
console.log(`Found ${existing.length} existing env vars`);

// Step 2: Delete all existing
console.log('\n=== Deleting existing ===');
let deleted = 0;
for (const env of existing) {
  try {
    await vfetch(`/v9/projects/${PROJECT_ID}/env/${env.id}`, { method: 'DELETE' });
    deleted++;
    process.stdout.write('.');
  } catch (err) {
    process.stdout.write('x');
    console.error(`\n  Failed to delete ${env.key}: ${err.message}`);
  }
}
console.log(`\nDeleted ${deleted}/${existing.length}`);

// Step 3: Bulk create with all 3 targets
console.log('\n=== Creating env vars (all targets at once) ===');
const payload = [...envMap.entries()].map(([key, value]) => ({
  key,
  value,
  type: 'plain',
  target: TARGETS,
}));

const result = await vfetch(`/v10/projects/${PROJECT_ID}/env?upsert=true`, {
  method: 'POST',
  body: JSON.stringify(payload),
});

const created = result.created?.length || 0;
const failed = result.failed?.length || 0;
console.log(`Created: ${created}, Failed: ${failed}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of result.failed) {
    console.log(`  - ${f.error.envVarKey || f.error.key}: ${f.error.message}`);
  }
}

console.log('\n✅ Done. All vars from .env applied to dev/preview/production.');
