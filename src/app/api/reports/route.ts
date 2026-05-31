import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getReportSnapshot, parseReportFilters } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await requireUser("reports:read");
  const url = new URL(request.url);
  const snapshot = await getReportSnapshot(prisma, user.tenantId, parseReportFilters(Object.fromEntries(url.searchParams.entries())));
  return NextResponse.json(snapshot);
}
