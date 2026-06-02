import { describe, expect, it } from "vitest";
import { consumeRateLimit, registrationRateLimitKey } from "@/lib/rate-limit";

describe("registration rate limit", () => {
  it("limits repeated attempts within a fixed window", () => {
    const store = new Map();
    const first = consumeRateLimit("key", { limit: 2, windowMs: 1000, now: 100, store });
    const second = consumeRateLimit("key", { limit: 2, windowMs: 1000, now: 200, store });
    const third = consumeRateLimit("key", { limit: 2, windowMs: 1000, now: 300, store });
    const reset = consumeRateLimit("key", { limit: 2, windowMs: 1000, now: 1200, store });

    expect(first.limited).toBe(false);
    expect(second.limited).toBe(false);
    expect(third.limited).toBe(true);
    expect(third.retryAfterSeconds).toBe(1);
    expect(reset.limited).toBe(false);
  });

  it("hashes the request identity without exposing headers", () => {
    const request = new Request("https://crm.test/api/auth/register", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.1",
        "user-agent": "Vitest",
      },
    });

    expect(registrationRateLimitKey(request)).toMatch(/^[a-f0-9]{64}$/);
  });
});
