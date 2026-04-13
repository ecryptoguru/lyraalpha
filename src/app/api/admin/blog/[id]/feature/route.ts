import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-blog-feature" });

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { id } = await params;

  const target = await prisma.blogPost.findUnique({
    where: { id },
    select: { id: true, slug: true, status: true },
  });
  if (!target) return apiError("Not found", 404);
  if (target.status !== "PUBLISHED") return apiError("Cannot feature an archived post", 400);

  // Atomically clear existing featured post, then set the new one
  await prisma.$transaction([
    prisma.blogPost.updateMany({ where: { featured: true }, data: { featured: false } }),
    prisma.blogPost.update({ where: { id }, data: { featured: true } }),
  ]);

  revalidatePath("/blog");
  revalidatePath(`/blog/${target.slug}`);
  revalidatePath("/");

  logger.info({ id, slug: target.slug }, "Blog post featured");

  return NextResponse.json({ success: true, id, slug: target.slug });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { id } = await params;

  const target = await prisma.blogPost.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!target) return apiError("Not found", 404);

  await prisma.blogPost.update({ where: { id }, data: { featured: false } });

  revalidatePath("/blog");
  revalidatePath(`/blog/${target.slug}`);
  revalidatePath("/");

  logger.info({ id, slug: target.slug }, "Blog post unfeatured");

  return NextResponse.json({ success: true, slug: target.slug });
}
