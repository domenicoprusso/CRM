import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { executeImportJob } from "@/lib/imports";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

function acceptsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("import:write");
    const { id } = await params;
    const result = await executeImportJob(prisma, user.tenantId, user.id, id);

    if (acceptsJson(request)) {
      return NextResponse.json(result);
    }

    return NextResponse.redirect(new URL(`/imports/${id}`, request.url), 303);
  } catch (err) {
    console.error("[import:execute]", err);
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: "internal", message }, { status: 500 });
  }
}

