import { AI_CONFIG, getGpt54Deployment, type Gpt54Role } from "./config";

/** Determine the effective model to use for a single-model GPT call.
 *  Falls back to primary deployment when role-specific one is not configured. */
export function resolveGptDeployment(role: Gpt54Role | null): string {
  return role ? getGpt54Deployment(role) : AI_CONFIG.model;
}
