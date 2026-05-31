export const NOTIFICATION_STATE_EVENT = "crm:notification-state-change";
export const NOTIFICATION_STORAGE_PREFIX = "crm.notifications.read";

export function buildNotificationStorageKey(tenantId: string, userId: string) {
  return `${NOTIFICATION_STORAGE_PREFIX}:${tenantId}:${userId}`;
}

export function parseReadFingerprints(serialized: string | null | undefined) {
  if (!serialized) return new Set<string>();
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0));
  } catch {
    return new Set<string>();
  }
}

export function serializeReadFingerprints(values: Iterable<string>) {
  return JSON.stringify(Array.from(new Set(values)).sort());
}

export function readNotificationFingerprints(storageKey: string) {
  if (typeof window === "undefined") return new Set<string>();
  return parseReadFingerprints(window.localStorage.getItem(storageKey));
}

export function writeNotificationFingerprints(storageKey: string, fingerprints: Iterable<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, serializeReadFingerprints(fingerprints));
  window.dispatchEvent(new Event(NOTIFICATION_STATE_EVENT));
}

export function markNotificationRead(current: Set<string>, fingerprint: string) {
  const next = new Set(current);
  next.add(fingerprint);
  return next;
}

export function markNotificationsRead(current: Set<string>, fingerprints: Iterable<string>) {
  const next = new Set(current);
  for (const fingerprint of fingerprints) next.add(fingerprint);
  return next;
}

export function toggleNotificationRead(current: Set<string>, fingerprint: string) {
  const next = new Set(current);
  if (next.has(fingerprint)) next.delete(fingerprint);
  else next.add(fingerprint);
  return next;
}

export function isNotificationRead(readFingerprints: Set<string>, fingerprint: string) {
  return readFingerprints.has(fingerprint);
}

export function countUnreadNotifications(items: Array<{ fingerprint: string }>, readFingerprints: Set<string>) {
  return items.reduce((count, item) => count + (readFingerprints.has(item.fingerprint) ? 0 : 1), 0);
}

export function emitNotificationStateChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATION_STATE_EVENT));
}

