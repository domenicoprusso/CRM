"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildNotificationStorageKey, countUnreadNotifications, NOTIFICATION_STATE_EVENT, readNotificationFingerprints } from "@/lib/notification-state";
import type { NotificationSnapshot } from "@/lib/notification-types";

export function NotificationBell({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [snapshot, setSnapshot] = useState<NotificationSnapshot | null>(null);
  const [readFingerprints, setReadFingerprints] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/notifications", { headers: { accept: "application/json" } });
        if (!response.ok) return;
        const data = (await response.json()) as NotificationSnapshot;
        setSnapshot(data);
      } catch {
        // noop
      }
    };

    const refreshRead = () => {
      setReadFingerprints(readNotificationFingerprints(buildNotificationStorageKey(tenantId, userId)));
    };

    load();
    refreshRead();
    const handleStateChange = () => refreshRead();
    window.addEventListener(NOTIFICATION_STATE_EVENT, handleStateChange);
    window.addEventListener("storage", handleStateChange);
    return () => {
      window.removeEventListener(NOTIFICATION_STATE_EVENT, handleStateChange);
      window.removeEventListener("storage", handleStateChange);
    };
  }, [tenantId, userId]);

  const unreadCount = useMemo(() => (snapshot ? countUnreadNotifications(snapshot.items, readFingerprints) : 0), [readFingerprints, snapshot]);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:border-brand-200 hover:text-brand-700"
      aria-label="Apri notifiche"
      title="Notifiche"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
