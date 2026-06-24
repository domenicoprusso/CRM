import { ButtonLink, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildNotificationStorageKey } from "@/lib/notification-state";
import { getNotificationSnapshot } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { NotificationClientView } from "./client-view";

export default async function NotificationsPage() {
  const user = await requireUser("dashboard:read");
  const snapshot = await getNotificationSnapshot(prisma, user.tenantId);

  return (
    <>
      <PageHeader
        title="Notifiche"
        description="Task scaduti, task in scadenza oggi, follow-up di oggi e opportunita senza next action."
        action={<ButtonLink href="/dashboard" variant="primary">Torna alla dashboard</ButtonLink>}
      />
      <NotificationClientView snapshot={snapshot} storageKey={buildNotificationStorageKey(user.tenantId, user.id)} />
    </>
  );
}
