import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error(error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || "local";
}

export function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function tokenFrom(request: Request): string {
  return new URL(request.url).searchParams.get("token")?.trim() || "";
}

export async function fileFrom(form: FormData, field = "file") {
  const value = form.get(field);
  if (!(value instanceof File) || value.size === 0) return null;
  return {
    filename: value.name || "upload",
    mime: value.type || "",
    bytes: Buffer.from(await value.arrayBuffer()),
  };
}

export function inlineFile(data: Buffer, contentType: string, filename: string, cache: "private" | "public") {
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": cache === "public" ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
