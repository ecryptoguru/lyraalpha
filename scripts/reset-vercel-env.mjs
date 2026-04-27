#!/usr/bin/env node
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const ENVS = ['development', 'preview', 'production'];

// Parse .env file
const envContent = readFileSync('.env', 'utf-8');
const envVars = [];
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  const value = trimmed.slice(eq + 1).replace(/^"|"$/g, '');
  envVars.push({ key, value });
}

console.log(`Found ${envVars.length} variables in .env`);

// Step 1: Remove ALL existing env vars from all environments
for (const env of ENVS) {
  console.log(`\n=== Listing ${env} ===`);
  let existing = [];
  try {
    const output = execSync(`vercel env ls ${env}`, { encoding: 'utf-8' });
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s+/);
      if (match) existing.push(match[1]);
    }
  } catch (e) {
    console.log(`Could not list ${env}`);
  }

  console.log(`Removing ${existing.length} vars from ${env}...`);
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

// Step 2: Add all vars from .env to all environments
for (const env of ENVS) {
  console.log(`\n=== Adding ${envVars.length} vars to ${env} ===`);
  let added = 0;
  let failed = 0;
  for (const { key, value } of envVars) {
    try {
      execSync(`echo "${value.replace(/"/g, '\\"')}" | vercel env add "${key}" ${env} --non-interactive`, { stdio: 'pipe' });
      added++;
      process.stdout.write('.');
    } catch (_e) {
      failed++;
      process.stdout.write('x');
    }
  }
  console.log(`\n${env}: ${added} added, ${failed} failed`);
}

console.log('\n✅ All environments reset from .env');
