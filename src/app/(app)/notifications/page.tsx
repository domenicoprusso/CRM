import { ButtonLink, PageHeader } from "@/components/ui";
import { NotificationPanel } from "@/components/notification-panel";
import { requireUser } from "@/lib/auth";
import { buildNotificationStorageKey } from "@/lib/notification-state";
import { getNotificationSnapshot } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

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
      <NotificationPanel snapshot={snapshot} storageKey={buildNotificationStorageKey(user.tenantId, user.id)} variant="center" />
    </>
  );
}
