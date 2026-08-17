import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || "";

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, conversation_id, messages } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (BACKEND_API_KEY) {
      headers["X-API-Key"] = BACKEND_API_KEY;
    }

    const backendRes = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: message.trim(),
        user_id: session.userId,
        user_role: session.role,
        conversation_id: conversation_id || `${session.userId}-${Date.now()}`,
        messages: Array.isArray(messages)
          ? messages
              .filter(
                (m: { role?: string; content?: string }) =>
                  m?.content && (m.role === "user" || m.role === "assistant")
              )
              .slice(-8)
              .map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              }))
          : [],
      }),
    });

    if (!backendRes.ok) {
      const err = await backendRes.text();
      console.error("[chat API] backend error:", err);
      const status = backendRes.status === 401 ? 502 : 502;
      return NextResponse.json(
        { error: "AI agent error. Please try again." },
        { status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[chat API] error:", error);
    return NextResponse.json(
      { error: "Failed to reach AI backend. Make sure backend is running." },
      { status: 503 }
    );
  }
}
