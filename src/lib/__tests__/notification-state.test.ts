import { describe, expect, it } from "vitest";
import {
  buildNotificationStorageKey,
  countUnreadNotifications,
  markNotificationRead,
  markNotificationsRead,
  parseReadFingerprints,
  serializeReadFingerprints,
} from "@/lib/notification-state";

describe("notification state helpers", () => {
  it("builds stable storage keys", () => {
    expect(buildNotificationStorageKey("tenant-1", "user-2")).toBe("crm.notifications.read:tenant-1:user-2");
  });

  it("parses and serializes read fingerprints", () => {
    const parsed = parseReadFingerprints('["b","a","","a",null]');
    expect(parsed).toEqual(new Set(["a", "b"]));
    expect(serializeReadFingerprints(parsed)).toBe('["a","b"]');
  });

  it("marks notifications as read without mutating the original set", () => {
    const current = new Set(["a"]);
    const next = markNotificationRead(current, "b");
    const bulk = markNotificationsRead(current, ["c", "d"]);

    expect(current).toEqual(new Set(["a"]));
    expect(next).toEqual(new Set(["a", "b"]));
    expect(bulk).toEqual(new Set(["a", "c", "d"]));
  });

  it("counts unread notifications correctly", () => {
    const items = [{ fingerprint: "a" }, { fingerprint: "b" }, { fingerprint: "c" }];
    expect(countUnreadNotifications(items, new Set(["b"]))).toBe(2);
  });
});
