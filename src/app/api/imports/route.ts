import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createImportPreview, listImportJobs } from "@/lib/imports";
import { prisma } from "@/lib/prisma";
import { importSourceSchema } from "@/lib/validators";

function acceptsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json");
}

export async function GET() {
  const user = await requireUser("import:read");
  const jobs = await listImportJobs(prisma, user.tenantId);
  return NextResponse.json(jobs);
}

export async function POST(request: Request) {
  const user = await requireUser("import:write");
  const formData = await request.formData();
  const entity = String(formData.get("entity") ?? "");
  const source = importSourceSchema.parse(String(formData.get("source") ?? "TeamSystem CRM"));
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file-required" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "csv-only" }, { status: 400 });
  }

  const csvText = await file.text();
  const result = await createImportPreview(prisma, user.tenantId, user.id, entity, source, file.name, csvText);

  if (acceptsJson(request)) {
    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.redirect(new URL(`/imports/${result.jobId}`, request.url), 303);
}
