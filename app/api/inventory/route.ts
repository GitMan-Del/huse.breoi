import { NextResponse } from "next/server";
import { put, head } from "@vercel/blob";

const PATHNAME = "inventar-huse.json";

// GET /api/inventory — returns the saved data, or null if nothing saved yet
export async function GET() {
  try {
    const blob = await head(PATHNAME);
    const res = await fetch(blob.url, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // blob doesn't exist yet — first run
    return NextResponse.json(null);
  }
}

// POST /api/inventory — overwrites the saved data
export async function POST(request: Request) {
  const data = await request.json();
  await put(PATHNAME, JSON.stringify(data), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });
  return NextResponse.json({ ok: true });
}