import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  await clearAdminCookie();
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
