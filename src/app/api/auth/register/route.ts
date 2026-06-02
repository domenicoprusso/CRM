import { NextResponse } from "next/server";
import { consumeRegistrationRateLimit } from "@/lib/rate-limit";
import { createInitialAdmin, hasExistingUsers } from "@/lib/registration";

export async function POST(request: Request) {
  if (await hasExistingUsers()) {
    return NextResponse.redirect(new URL("/register?disabled=1", request.url));
  }

  const rateLimit = consumeRegistrationRateLimit(request);
  if (rateLimit.limited) {
    const response = NextResponse.redirect(new URL("/register?error=1", request.url));
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  const formData = await request.formData();
  const result = await createInitialAdmin(Object.fromEntries(formData));

  if (result === "created") {
    return NextResponse.redirect(new URL("/login?registered=1", request.url));
  }

  if (result === "disabled") {
    return NextResponse.redirect(new URL("/register?disabled=1", request.url));
  }

  return NextResponse.redirect(new URL("/register?error=1", request.url));
}
