"use client";

import Link from "next/link";
import { Check, Circle, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { buildNotificationStorageKey, countUnreadNotifications, isNotificationRead, markNotificationRead, markNotificationsRead, readNotificationFingerprints, writeNotificationFingerprints, NOTIFICATION_STATE_EVENT } from "@/lib/notification-state";
import type { NotificationItem, NotificationSnapshot } from "@/lib/notification-types";

type Variant = "center" | "widget";

function useNotificationReadState(storageKey: string) {
  const [readFingerprints, setReadFingerprints] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const load = () => setReadFingerprints(readNotificationFingerprints(storageKey));
    load();
    const handleChange = () => load();
    window.addEventListener(NOTIFICATION_STATE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(NOTIFICATION_STATE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, [storageKey]);

  const update = (next: Set<string>) => {
    setReadFingerprints(next);
    writeNotificationFingerprints(storageKey, next);
  };

  return { readFingerprints, update };
}

function NotificationRow({
  item,
  read,
  onToggleRead,
}: {
  item: NotificationItem;
  read: boolean;
  onToggleRead: (fingerprint: string) => void;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${read ? "border-slate-200 bg-white" : "border-brand-200 bg-brand-50/60"}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={read ? "Notifica già letta" : "Segna come letto"}
          onClick={read ? undefined : () => onToggleRead(item.fingerprint)}
          disabled={read}
          className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:text-brand-700 disabled:cursor-default disabled:opacity-60"
        >
          {read ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={item.href} className="font-semibold text-slate-950 hover:text-brand-700" onClick={read ? undefined : () => onToggleRead(item.fingerprint)}>
              {item.title}
            </Link>
            <Badge tone={item.tone}>{item.categoryLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
        </div>
        <Link href={item.href} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-brand-200 hover:text-brand-700" onClick={read ? undefined : () => onToggleRead(item.fingerprint)}>
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function NotificationPanel({
  snapshot,
  storageKey,
  variant,
}: {
  snapshot: NotificationSnapshot;
  storageKey: string;
  variant: Variant;
}) {
  const { readFingerprints, update } = useNotificationReadState(storageKey);
  const unreadCount = useMemo(() => countUnreadNotifications(snapshot.items, readFingerprints), [readFingerprints, snapshot.items]);
  const allFingerprints = useMemo(() => snapshot.items.map((item) => item.fingerprint), [snapshot.items]);

  const markOne = (fingerprint: string) => update(markNotificationRead(readFingerprints, fingerprint));
  const markAll = () => update(markNotificationsRead(readFingerprints, allFingerprints));

  if (variant === "widget") {
    return (
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifiche</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">Centro operativo</h3>
            <p className="mt-1 text-sm text-slate-500">Task, reminder e opportunità che richiedono attenzione.</p>
          </div>
          <Badge tone={unreadCount > 0 ? "red" : "slate"}>{unreadCount} non lette</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {snapshot.sections.map((section) => (
            <div key={section.id} className="rounded-2xl border border-slate-100 p-4">
              <p className="text-sm font-semibold text-slate-950">{section.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{section.count}</p>
              <p className="mt-1 text-xs text-slate-500">{section.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.items.slice(0, 4).map((item) => (
            <NotificationRow key={item.fingerprint} item={item} read={isNotificationRead(readFingerprints, item.fingerprint)} onToggleRead={markOne} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ButtonLink href="/notifications" variant="primary">
            Apri centro notifiche
          </ButtonLink>
          <button
            type="button"
            onClick={markAll}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-soft hover:border-brand-200 hover:text-brand-700"
          >
            Segna tutto letto
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifiche</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950">Centro notifiche</h3>
            <p className="mt-1 text-sm text-slate-500">Le stesse informazioni del CRM, organizzate per priorità operativa.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={unreadCount > 0 ? "red" : "slate"}>{unreadCount} non lette</Badge>
            <button
              type="button"
              onClick={markAll}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-soft hover:border-brand-200 hover:text-brand-700"
            >
              Segna tutto letto
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {snapshot.sections.map((section) => (
          <Card key={section.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-950">{section.label}</h4>
                <p className="text-sm text-slate-500">{section.description}</p>
              </div>
              <Badge tone={section.tone}>{section.count}</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {section.items.length === 0 ? (
                <EmptyState message="Nessuna notifica in questa categoria." />
              ) : (
                section.items.map((item) => (
                  <NotificationRow key={item.fingerprint} item={item} read={isNotificationRead(readFingerprints, item.fingerprint)} onToggleRead={markOne} />
                ))
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function useNotificationKey(tenantId: string, userId: string) {
  return buildNotificationStorageKey(tenantId, userId);
}
