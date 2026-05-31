import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getImportJobDetail } from "@/lib/imports";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("import:read");
  const { id } = await params;
  const job = await getImportJobDetail(prisma, user.tenantId, id);
  if (!job) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(job);
}

