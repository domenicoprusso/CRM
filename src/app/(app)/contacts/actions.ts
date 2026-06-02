"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getContactDeleteState } from "@/lib/crm-delete";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validators";

function getId(formData: FormData) {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

async function assertCompanyAccess(companyId: string | null | undefined, tenantId: string, redirectTo: string) {
  if (!companyId) return;
  const company = await prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } });
  if (!company) redirect(`${redirectTo}?error=invalid-company`);
}

export async function createContact(formData: FormData) {
  const user = await requireUser("contact:write");
  const parsed = contactSchema.parse(Object.fromEntries(formData));
  await assertCompanyAccess(parsed.companyId, user.tenantId, "/contacts");
  const contact = await prisma.contact.create({ data: { ...parsed, tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Contact", entityId: contact.id, after: contact });
  revalidatePath("/contacts");
}

export async function updateContact(formData: FormData) {
  const user = await requireUser("contact:write");
  const id = getId(formData);
  const before = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/contacts?error=not-found");

  const parsed = contactSchema.parse(Object.fromEntries(formData));
  await assertCompanyAccess(parsed.companyId, user.tenantId, `/contacts/${id}`);
  const updated = await prisma.contact.updateMany({ where: { id, tenantId: user.tenantId }, data: parsed });
  if (updated.count === 0) redirect("/contacts?error=not-found");
  const contact = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!contact) redirect("/contacts?error=not-found");

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Contact", entityId: id, before, after: contact });
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}?updated=1`);
}

export async function deleteContact(formData: FormData) {
  const user = await requireUser("contact:write");
  const id = getId(formData);
  if (formData.get("confirmDelete") !== "ELIMINA") redirect(`/contacts/${id}?error=confirm`);

  const { record, blocker } = await getContactDeleteState(user.tenantId, id);
  if (!record) redirect("/contacts?error=not-found");
  if (blocker) redirect(`/contacts/${id}?error=delete-linked`);

  try {
    const deleted = await prisma.contact.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) redirect("/contacts?error=not-found");
  } catch {
    redirect(`/contacts/${id}?error=delete-failed`);
  }

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Contact", entityId: id, before: record });
  revalidatePath("/contacts");
  redirect("/contacts?deleted=1");
}
