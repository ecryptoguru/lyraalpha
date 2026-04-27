#!/usr/bin/env node

import { execSync } from 'child_process';

const envs = ['development', 'preview', 'production'];

// First, get all unique variable names from all environments
const allVars = new Set();
for (const env of envs) {
  try {
    const output = execSync(`vercel env ls ${env}`, { encoding: 'utf-8' });
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s+/);
      if (match) {
        allVars.add(match[1]);
      }
    }
  } catch (_e) {
    console.log(`Could not list ${env} env vars`);
  }
}

const variables = Array.from(allVars).sort();
console.log(`Found ${variables.length} unique variables across all environments`);
console.log('Variables:', variables.join(', '));

for (const env of envs) {
  console.log(`\n=== Removing from ${env} ===`);
  for (const key of variables) {
    try {
      execSync(`vercel env rm "${key}" ${env} --yes`, { stdio: 'pipe' });
      console.log(`✓ ${key}`);
    } catch (_error) {
      console.log(`✗ ${key} (not found or error)`);
    }
  }
}

console.log('\nDone!');
