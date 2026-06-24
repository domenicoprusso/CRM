"use client";

import { NotificationPanel } from "@/components/notification-panel";
import type { NotificationSnapshot } from "@/lib/notification-types";

export function NotificationClientView({ snapshot, storageKey }: { snapshot: NotificationSnapshot; storageKey: string }) {
  return <NotificationPanel snapshot={snapshot} storageKey={storageKey} variant="center" />;
}
