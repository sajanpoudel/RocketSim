import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Forward the request to the RocketPy service
    const response = await fetch(process.env.ROCKETPY_URL ?? "http://rocketpy:8000/analyze/recovery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RocketPy recovery analysis failed:", errorText);
      return NextResponse.json(
        { error: `Recovery analysis failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("Recovery analysis proxy error:", error);
    return NextResponse.json(
      { error: "Recovery analysis service unavailable" },
      { status: 503 }
    );
  }
}
