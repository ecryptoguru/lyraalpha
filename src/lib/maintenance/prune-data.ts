import { prisma } from "../prisma";
import { createLogger } from "../logger";

const logger = createLogger({ service: "data-pruning" });

interface PruningConfig {
  dryRun?: boolean;
  batchSize?: number;
}

type PrunableModelDelegate = {
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
};

/**
 * Prunes old data to maintain database health.
 * 
 * Retention Policies:
 * - AIRequestLog: 90 days
 * - AssetScore: 365 days (high fidelity), older data should be aggregated (future scope)
 * - InstitutionalEvent: 365 days
 * - Notification/Alerts: 30 days (if implemented)
 */
export async function pruneDatabase(config: PruningConfig = {}) {
  const { dryRun = false } = config;
  const now = new Date();
  
  // Policy Definitions
  const policies = {
    AIRequestLog: {
      dateField: "createdAt",
      retentionDays: 90,
      model: prisma.aIRequestLog
    },
    AssetScore: {
      dateField: "date",
      retentionDays: 365,
      model: prisma.assetScore
    },
    InstitutionalEvent: {
      dateField: "date",
      retentionDays: 365,
      model: prisma.institutionalEvent
    }
  };

  logger.info({ dryRun }, "🧹 Starting Database Pruning...");

  const results: Record<string, number> = {};

  for (const [entityName, policy] of Object.entries(policies)) {
    const cutoffDate = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
    
    const model = policy.model as unknown as PrunableModelDelegate;

    try {
      //Count actionable records
      const count = await model.count({
        where: {
          [policy.dateField]: { lt: cutoffDate }
        }
      });

      if (count > 0) {
        if (!dryRun) {
          // Send delete command (Prisma doesn't support batch delete with limit natively easily without raw query or loop)
          // For safety and staying within prisma, we use deleteMany. 
          // Partitioning in Phase 2 will make this instant.
          const { count: deleted } = await model.deleteMany({
            where: {
              [policy.dateField]: { lt: cutoffDate }
            }
          });
          results[entityName] = deleted;
          logger.info({ entity: entityName, count: deleted, cutoff: cutoffDate.toISOString() }, "Pruned records");
        } else {
          results[entityName] = count;
          logger.info({ entity: entityName, count, cutoff: cutoffDate.toISOString() }, "Dry Run: Found records to prune");
        }
      } else {
        results[entityName] = 0;
      }
    } catch (error) {
      logger.error({ err: error, entity: entityName }, "Failed to prune entity");
    }
  }

  logger.info({ results }, "✅ Pruning Complete");
  return results;
}
