import { NextResponse } from "next/server";
import { createInitialAdmin } from "@/lib/registration";

export async function POST(request: Request) {
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
