import { NextResponse } from "next/server";
import { put, get } from "@vercel/blob";

const PATHNAME = "inventar-huse-migrat.json";

// GET /api/inventar-huse-migrat — returns the saved data, or null if nothing saved yet
export async function GET() {
  try {
    const result = await get(PATHNAME, { access: "private" });
    if (!result || !result.stream) {
      return NextResponse.json(null);
    }
    const text = await new Response(result.stream).text();
    return NextResponse.json(JSON.parse(text));
  } catch {
    // blob doesn't exist yet — first run
    return NextResponse.json(null);
  }
}

// POST /api/inventory — overwrites the saved data
export async function POST(request: Request) {
  const data = await request.json();
  await put(PATHNAME, JSON.stringify(data), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  });
  return NextResponse.json({ ok: true });
}