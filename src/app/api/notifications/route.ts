import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getNotificationSnapshot } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireUser("dashboard:read");
  const snapshot = await getNotificationSnapshot(prisma, user.tenantId);
  return NextResponse.json(snapshot);
}

