import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || "";

// ── GET: Fetch active conversation & messages from Supabase PostgreSQL ────────
export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("conversation_id");

    let query = supabaseAdmin
      .from("ai_chat_sessions")
      .select("id, conversation_id, title, total_messages, created_at, last_active_at")
      .eq("user_id", session.userId);

    if (convId) {
      query = query.eq("conversation_id", convId);
    } else {
      query = query.order("last_active_at", { ascending: false }).limit(1);
    }

    const { data: sessions, error: sessErr } = await query;
    if (sessErr || !sessions || sessions.length === 0) {
      return NextResponse.json({ conversation_id: null, messages: [] });
    }

    const chatSession = sessions[0];
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("*")
      .eq("session_id", chatSession.id)
      .order("turn_index", { ascending: true });

    if (msgErr || !messages) {
      return NextResponse.json({
        conversation_id: chatSession.conversation_id,
        messages: [],
      });
    }

    const formatted = messages.map((m) => ({
      id: m.id,
      content: m.content,
      sender: m.role === "user" ? "user" : "ai",
      timestamp: m.created_at,
      type: m.services && m.services.length > 0 ? "service_list" : "general",
      services: m.services || undefined,
    }));

    return NextResponse.json({
      conversation_id: chatSession.conversation_id,
      messages: formatted,
    });
  } catch (error) {
    console.error("[chat GET API] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history from database." },
      { status: 500 }
    );
  }
}

// ── POST: Chat with AI + Persist user & assistant turns to PostgreSQL ─────────
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

    const cleanConvId = conversation_id || `${session.userId}-${Date.now()}`;

    // 1. Find or create AI Chat Session in Supabase PostgreSQL
    let sessionId: string | null = null;
    let turnIndex = 0;

    try {
      const { data: existingSession } = await supabaseAdmin
        .from("ai_chat_sessions")
        .select("id, total_messages")
        .eq("conversation_id", cleanConvId)
        .maybeSingle();

      if (existingSession) {
        sessionId = existingSession.id;
        turnIndex = existingSession.total_messages || 0;
      } else {
        const { data: newSession } = await supabaseAdmin
          .from("ai_chat_sessions")
          .insert({
            user_id: session.userId,
            conversation_id: cleanConvId,
            title: message.trim().substring(0, 60),
            total_messages: 0,
          })
          .select("id")
          .single();

        if (newSession) {
          sessionId = newSession.id;
          turnIndex = 0;
        }
      }

      // 2. Persist User Message to ai_chat_messages in PostgreSQL
      if (sessionId) {
        await supabaseAdmin.from("ai_chat_messages").insert({
          session_id: sessionId,
          role: "user",
          content: message.trim(),
          turn_index: turnIndex,
        });
        turnIndex += 1;
      }
    } catch (dbErr) {
      console.warn("[chat API] DB session init warning:", dbErr);
    }

    // 3. Forward to Python AI Backend
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
        conversation_id: cleanConvId,
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

    // 4. Persist AI Assistant Response to ai_chat_messages in PostgreSQL
    if (sessionId && data) {
      try {
        await supabaseAdmin.from("ai_chat_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: data.reply || "Here are your options.",
          intent: data.intent || null,
          services: data.services || null,
          needs_clarification: Boolean(data.needs_clarification),
          turn_index: turnIndex,
        });

        // Update session summary
        await supabaseAdmin
          .from("ai_chat_sessions")
          .update({
            total_messages: turnIndex + 1,
            last_active_at: new Date().toISOString(),
            last_intent: data.intent || null,
            last_services: data.services || null,
          })
          .eq("id", sessionId);
      } catch (saveErr) {
        console.warn("[chat API] DB assistant message save warning:", saveErr);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[chat API] error:", error);
    return NextResponse.json(
      { error: "Failed to reach AI backend. Make sure backend is running." },
      { status: 503 }
    );
  }
}
