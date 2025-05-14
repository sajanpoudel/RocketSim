import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { history, rocket } = await req.json();
  const r = await fetch(process.env.AGENT_URL ?? "http://agentpy:8002/reason", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ messages: history, rocket }),
  });
  return new NextResponse(r.body, { status: r.status });
} 