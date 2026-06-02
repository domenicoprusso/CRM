import { createHash } from "crypto";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

const globalForRateLimit = globalThis as unknown as { registrationRateLimitStore?: RateLimitStore };
const registrationRateLimitStore = globalForRateLimit.registrationRateLimitStore ?? new Map<string, RateLimitEntry>();
globalForRateLimit.registrationRateLimitStore = registrationRateLimitStore;

export type RateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

export function registrationRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  return createHash("sha256").update(`register:${ip}:${userAgent}`).digest("hex");
}

export function consumeRateLimit(
  key: string,
  options: {
    limit?: number;
    windowMs?: number;
    now?: number;
    store?: RateLimitStore;
  } = {},
): RateLimitResult {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const now = options.now ?? Date.now();
  const store = options.store ?? registrationRateLimitStore;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: Math.max(limit - 1, 0), retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      limited: true,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }

  current.count += 1;
  store.set(key, current);
  return { limited: false, remaining: Math.max(limit - current.count, 0), retryAfterSeconds: 0 };
}

export function consumeRegistrationRateLimit(request: Request) {
  return consumeRateLimit(registrationRateLimitKey(request));
}
