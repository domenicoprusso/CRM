"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getCompanyDeleteState } from "@/lib/crm-delete";
import { prisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validators";

function getId(formData: FormData) {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

export async function createCompany(formData: FormData) {
  const user = await requireUser("company:write");
  const parsed = companySchema.parse(Object.fromEntries(formData));
  const company = await prisma.company.create({ data: { ...parsed, tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Company", entityId: company.id, after: company });
  revalidatePath("/companies");
}

export async function updateCompany(formData: FormData) {
  const user = await requireUser("company:write");
  const id = getId(formData);
  const before = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/companies?error=not-found");

  const parsed = companySchema.parse(Object.fromEntries(formData));
  const codMeccanografico = (formData.get("codMeccanografico") as string)?.trim() || null;
  const updated = await prisma.company.updateMany({ where: { id, tenantId: user.tenantId }, data: { ...parsed, codMeccanografico } });
  if (updated.count === 0) redirect("/companies?error=not-found");
  const company = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!company) redirect("/companies?error=not-found");

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Company", entityId: id, before, after: company });
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  redirect(`/companies/${id}?updated=1`);
}

export async function deleteCompany(formData: FormData) {
  const user = await requireUser("company:write");
  const id = getId(formData);
  if (formData.get("confirmDelete") !== "ELIMINA") redirect(`/companies/${id}?error=confirm`);

  const { record, blocker } = await getCompanyDeleteState(user.tenantId, id);
  if (!record) redirect("/companies?error=not-found");
  if (blocker) redirect(`/companies/${id}?error=delete-linked`);

  try {
    const deleted = await prisma.company.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) redirect("/companies?error=not-found");
  } catch {
    redirect(`/companies/${id}?error=delete-failed`);
  }

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Company", entityId: id, before: record });
  revalidatePath("/companies");
  redirect("/companies?deleted=1");
}
