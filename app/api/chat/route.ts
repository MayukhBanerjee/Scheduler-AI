import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60; // Up to 60s timeout for container cold starts

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || "";
const BEDROCK_API_KEY = process.env.BEDROCK_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID || "google.gemma-3-12b-it";

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

// ── Direct Bedrock Mantle + Supabase Fallback Agent ────────────────────────────
async function runDirectBedrockChat(message: string, history: Array<{ role: string; content: string }>) {
  // 1. Fetch available services and providers from Supabase
  const { data: dbServices } = await supabaseAdmin
    .from("services")
    .select(`
      id, name, description, price, duration_minutes, category,
      provider_profiles(id, business_name, location, rating, availability_slots(start_time, specific_date, day_of_week, is_booked))
    `)
    .eq("is_active", true)
    .limit(30);

  const servicesList = ((dbServices || []) as unknown) as Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    duration_minutes: number;
    category: string;
    provider_profiles: {
      id: string;
      business_name: string;
      location: string;
      rating: number;
      availability_slots: Array<{
        start_time: string;
        specific_date: string | null;
        day_of_week: string | null;
        is_booked: boolean;
      }>;
    } | Array<{
      id: string;
      business_name: string;
      location: string;
      rating: number;
      availability_slots: Array<{
        start_time: string;
        specific_date: string | null;
        day_of_week: string | null;
        is_booked: boolean;
      }>;
    }> | null;
  }>;

  // Format catalog of verified services with available time slots
  const formattedCatalog = servicesList.map((s) => {
    const rawProvider = s.provider_profiles;
    const provider = Array.isArray(rawProvider) ? rawProvider[0] : rawProvider;
    const slots = (provider?.availability_slots || [])
      .filter((slot) => !slot.is_booked)
      .map((slot) => slot.start_time?.substring(0, 5) || "10:00")
      .slice(0, 4);

    return {
      service_id: s.id,
      service_name: s.name,
      category: s.category || "General",
      provider_id: provider?.id || s.id,
      provider_name: provider?.business_name || "ScheduleAI Verified Partner",
      provider_email: "",
      location: provider?.location || "Bangalore",
      price: s.price || 0,
      duration_minutes: s.duration_minutes || 60,
      available_slots: slots.length > 0 ? slots : ["10:00", "11:30", "14:00", "16:00"],
      rating: provider?.rating || 4.9,
      description: s.description || "",
      tags: [],
      date: new Date().toISOString().split("T")[0],
    };
  });

  const catalogSummary = formattedCatalog
    .map(
      (s) =>
        `- ID: ${s.service_id} | ${s.service_name} (₹${s.price}, ${s.duration_minutes}m, ${s.rating}★) at ${s.provider_name} in ${s.location}. Category: ${s.category}. Slots: ${s.available_slots.join(", ")}`
    )
    .join("\n");

  const systemPrompt = `You are ScheduleAI — an ultra-knowledgeable, warm, witty, perceptive, and empathetic best friend who knows EVERYTHING.
Think of yourself as that one worldly, savvy best friend who is always in the know: hair & styling, skincare, wellness, fitness routines, dentistry, cafes, life hacks, Bangalore hotspots (Indiranagar, Koramangala, Lavelle Rd, Church St, Whitefield, etc.), and scheduling.

Your Tone & Guidelines:
1. TALK LIKE A REAL BEST FRIEND:
   - Speak with high emotional intelligence (EQ), warmth, natural conversational flair, light humor, and empathy.
   - If the user says "Hello", "Hey", asks how you are, vents about their day, shares how they are feeling ("I'm so exhausted", "had a crazy day at work"), or chats casually:
     Chat with them warmly and thoroughly like a real friend. Validate their feelings, share thoughts, or ask follow-up questions.
     DO NOT push services, appointments, or booking cards on general conversation!
2. OMNISCIENT & ACCESSIBLE KNOWLEDGE:
   - If the user asks for advice or knowledge (e.g., difference between balayage and highlights, how to relieve tight neck/shoulders, workout routines, dental hygiene, best coffee in town):
     Answer with deep, clear, insider expertise and friendly advice.
3. CONTEXTUAL APPOINTMENT RECOMMENDATIONS:
   - When the user explicitly asks for a recommendation, mentions wanting to book an appointment, or has a specific problem where a verified service in your catalog is the ideal solution (e.g. "I need a haircut", "My neck is super tense", "Recommend a dentist in Indiranagar", "Can you book a spa?"):
     Share why you genuinely recommend the place like a trusted friend.
     At the VERY END of your message, on its own new line, add:
     [RECOMMEND: service_id_1, service_id_2] (using the exact IDs from the catalog below).
4. If no service is directly requested or relevant, NEVER include [RECOMMEND:...].

CATALOG OF VERIFIED AVAILABLE SERVICES:
${catalogSummary}`;

  let replyText = "";
  try {
    const endpoint = `https://bedrock-mantle.${AWS_REGION}.api.aws/v1/chat/completions`;
    const payload = {
      model: BEDROCK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-6),
        { role: "user", content: message },
      ],
      temperature: 0.65,
    };

    const bedrockRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEDROCK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (bedrockRes.ok) {
      const bData = await bedrockRes.json();
      const choiceContent = bData.choices?.[0]?.message?.content;
      if (choiceContent) {
        replyText = choiceContent.trim();
      }
    }
  } catch (llmErr) {
    console.warn("[chat API] Bedrock direct note:", llmErr);
  }

  let selectedServices: typeof formattedCatalog = [];

  // Parse [RECOMMEND: id1, id2] from LLM response
  if (replyText) {
    const recMatch = replyText.match(/\[RECOMMEND:\s*([^\]]+)\]/i);
    if (recMatch) {
      const rawIds = recMatch[1].split(",").map((id) => id.trim().toLowerCase());
      selectedServices = formattedCatalog.filter((s) =>
        rawIds.some(
          (id) =>
            s.service_id.toLowerCase() === id ||
            s.service_name.toLowerCase().includes(id) ||
            id.includes(s.service_id.toLowerCase())
        )
      );
      // Remove tag from user-visible reply
      replyText = replyText.replace(/\[RECOMMEND:\s*[^\]]+\]/gi, "").trim();
    }
  }

  // Safety net: If user explicitly intended to book or find a specific service, but LLM missed the tag
  const explicitBookingIntent =
    /\b(book|booking|schedule|appointment|reserve|open slot|free slot)\b/i.test(message) ||
    (/\b(haircut|dentist|dental|teeth|massage|spa|facial|trainer|gym|workout)\b/i.test(message) &&
      /\b(need|want|find|looking for|recommend|where can i|place for|best)\b/i.test(message));

  if (selectedServices.length === 0 && explicitBookingIntent) {
    const lowerMsg = message.toLowerCase();
    const matched = formattedCatalog.filter((s) => {
      const nameMatch = s.service_name.toLowerCase().includes(lowerMsg);
      const catMatch = s.category && lowerMsg.includes(s.category.toLowerCase());
      const descMatch = s.description && s.description.toLowerCase().includes(lowerMsg);
      return nameMatch || catMatch || descMatch;
    });
    if (matched.length > 0) {
      selectedServices = matched.slice(0, 3);
    }
  }

  // Friendly conversational fallback if LLM response failed
  if (!replyText) {
    if (selectedServices.length > 0) {
      replyText = "Here are the top-rated spots matching your request! Take a look below and pick any slot that fits your schedule:";
    } else {
      replyText = "Hey there! I'm here and ready to chat, give advice, or help you lock in a verified booking. What's on your mind today?";
    }
  }

  return {
    reply: replyText,
    services: selectedServices,
    needs_clarification: false,
    intent: { category: selectedServices[0]?.category || null },
  };
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

    const historyArray: Array<{ role: string; content: string }> = Array.isArray(messages)
      ? messages
          .filter((m: { role?: string; content?: string }) => m?.content && (m.role === "user" || m.role === "assistant"))
          .slice(-8)
          .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
      : [];

    let data: any = null;
    let backendSuccess = false;

    // 3. Attempt Python backend forward if configured and not local
    if (BACKEND_URL && !BACKEND_URL.includes("localhost")) {
      const reqId = `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const t0 = Date.now();
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Request-ID": reqId,
        };
        if (BACKEND_API_KEY) headers["X-API-Key"] = BACKEND_API_KEY;

        console.log(`[chat API] [${reqId}] Forwarding to Render backend: ${BACKEND_URL}/chat`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for container cold start

        const backendRes = await fetch(`${BACKEND_URL}/chat`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            message: message.trim(),
            user_id: session.userId,
            user_role: session.role,
            conversation_id: cleanConvId,
            messages: historyArray,
          }),
        });

        clearTimeout(timeoutId);

        if (backendRes.ok) {
          data = await backendRes.json();
          backendSuccess = true;
          console.log(`[chat API] [${reqId}] Render backend success (${Date.now() - t0}ms)`);
        } else {
          console.warn(`[chat API] [${reqId}] Render backend returned HTTP ${backendRes.status} (${Date.now() - t0}ms)`);
        }
      } catch (proxyErr) {
        console.warn(`[chat API] [${reqId}] Python backend unreachable (${Date.now() - t0}ms), invoking direct Bedrock agent fallback:`, proxyErr);
      }
    }

    // 4. Run direct Bedrock Mantle agent if backend was not successful
    if (!backendSuccess || !data) {
      data = await runDirectBedrockChat(message.trim(), historyArray);
    }

    // 5. Persist AI Assistant Response to ai_chat_messages in PostgreSQL
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
      { error: "Failed to process chat query." },
      { status: 500 }
    );
  }
}
