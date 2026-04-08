import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { processPendingConversationEmbeddings } from "@/lib/ai/rag";

const logger = createLogger({ service: "cron-embed-memory" });

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "bom1";

export async function POST(request: NextRequest) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "embed-memory" },
    async () => {
      try {
        const results = await processPendingConversationEmbeddings();
        logger.info({ results }, "Memory embedding cron completed");

        return NextResponse.json({
          success: true,
          results,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error }, "Memory embedding cron failed");
        return NextResponse.json(
          { success: false, error: "Embedding run failed" },
          { status: 500 },
        );
      }
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
