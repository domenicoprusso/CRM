"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validators";

export async function createContact(formData: FormData) {
  const user = await requireUser("contact:write");
  const parsed = contactSchema.parse(Object.fromEntries(formData));
  const contact = await prisma.contact.create({ data: { ...parsed, tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Contact", entityId: contact.id, after: contact });
  revalidatePath("/contacts");
}
