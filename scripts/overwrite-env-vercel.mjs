import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Read .env file
const envContent = readFileSync('.env', 'utf-8');

// Parse .env file
const lines = envContent.split('\n');
const envVars = [];

for (const line of lines) {
  const trimmed = line.trim();
  // Skip comments and empty lines
  if (!trimmed || trimmed.startsWith('#')) continue;
  
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  
  const key = trimmed.substring(0, eqIndex).trim();
  let value = trimmed.substring(eqIndex + 1).trim();
  
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  
  if (!key) continue;
  envVars.push({ key, value });
}

console.log(`Found ${envVars.length} environment variables to overwrite`);

// First, remove all existing variables
console.log('\nRemoving existing variables from production...');
for (const { key } of envVars) {
  try {
    execSync(
      `vercel env rm "${key}" production --yes`,
      { stdio: 'inherit', cwd: process.cwd() }
    );
    console.log(`✓ Removed ${key}`);
  } catch (_error) {
    // Variable might not exist, continue
    console.log(`- ${key} not found or already removed`);
  }
}

// Now add all variables back
console.log('\nAdding variables to production...');
for (const { key, value } of envVars) {
  console.log(`Adding ${key}...`);
  
  try {
    execSync(
      `echo "${value}" | vercel env add "${key}" production --non-interactive`,
      { stdio: 'inherit', cwd: process.cwd() }
    );
    console.log(`✓ ${key} added`);
  } catch (error) {
    console.error(`✗ Failed to add ${key}:`, error.message);
  }
}

console.log('\nEnvironment variables overwrite completed');
