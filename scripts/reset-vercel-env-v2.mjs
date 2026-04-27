#!/usr/bin/env node
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const ENVS = ['development', 'preview', 'production'];

// Parse .env file — last occurrence wins for duplicate keys
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
  envMap.set(key, value); // last wins for duplicates
}
const envVars = [...envMap.entries()].map(([key, value]) => ({ key, value }));
console.log(`Found ${envVars.length} unique variables in .env`);

// Step 1: Remove ALL existing env vars from all environments
for (const env of ENVS) {
  console.log(`\n=== Removing from ${env} ===`);
  let existing = [];
  try {
    const output = execSync(`vercel env ls ${env}`, { encoding: 'utf-8' });
    for (const line of output.split('\n')) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s+/);
      if (match) existing.push(match[1]);
    }
  } catch (_e) {
    console.log(`Could not list ${env}`);
  }

  console.log(`Removing ${existing.length} vars...`);
  for (const key of existing) {
    try {
      execSync(`vercel env rm "${key}" ${env} --yes`, { stdio: 'pipe' });
      process.stdout.write('.');
    } catch (_e) {
      process.stdout.write('x');
    }
  }
  console.log(' done');
}

// Step 2: Add all vars from .env to all environments with --force
for (const env of ENVS) {
  console.log(`\n=== Adding ${envVars.length} vars to ${env} ===`);
  let added = 0;
  let failed = 0;
  for (const { key, value } of envVars) {
    try {
      const safeValue = value.replace(/"/g, '\\"');
      execSync(`vercel env add "${key}" ${env} --value "${safeValue}" --no-sensitive --force --yes`, { stdio: 'pipe' });
      added++;
      process.stdout.write('.');
    } catch (_err) {
      failed++;
      process.stdout.write('x');
      console.error(`\n  Failed: ${key}`);
    }
  }
  console.log(`\n${env}: ${added} added, ${failed} failed`);
}

console.log('\n✅ All environments reset from .env');
