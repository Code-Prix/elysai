/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/server/db";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. Define Types for Incoming Data
interface RetellMetadata {
  userId?: string;
}

interface RetellCallData {
  call_id: string;
  transcript?: string;
  recording_url?: string;
  metadata?: RetellMetadata;
}

interface RetellWebhookEvent {
  event: string;
  call: RetellCallData;
}

interface AnalysisResult {
  emotional_state?: string;
  narrative_summary?: string;
  key_topics?: string[];
  risk_flags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    // 2. Parse Body (We disable linting just for this casting line)
    const body = await req.json();
    const event = body as RetellWebhookEvent;

    if (event.event !== "call_ended") {
      return NextResponse.json({ received: true });
    }

    const { call_id, transcript, recording_url, metadata } = event.call;

    console.log(`[Webhook] Processing call ${call_id}`);

    // 3. Analyze with Groq
    const analysisCompletion = await groq.chat.completions.create({
      // SPEED FIX: Switched to 8b-8192 for faster summarization
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: `
            You are an expert clinical supervisor. Analyze this therapy transcript.
            Output JSON ONLY with these keys:
            - emotional_state: string
            - narrative_summary: string
            - key_topics: string[]
            - risk_flags: string[]
          `
        },
        // Use nullish coalescing (??) instead of OR (||) for safer typing
        { role: "user", content: transcript ?? "No transcript available." }
      ],
      response_format: { type: "json_object" }
    });

    const rawContent = analysisCompletion.choices[0]?.message?.content ?? "{}";
    const analysis = JSON.parse(rawContent) as AnalysisResult;

    // --- FIX FOR P2003 ERROR ---
    // If userId is "guest" or missing, set it to null.
    let dbUserId: string | null = null;
    
    if (metadata?.userId && metadata.userId !== "guest") {
        dbUserId = metadata.userId;
    }

    // 4. Save to Database (Strictly Typed)
    await prisma.therapySession.create({
      data: {
        retellCallId: call_id,
        userId: dbUserId, // This will be null for guests, avoiding the constraint error
        transcript: transcript ?? "",
        audioUrl: recording_url ?? null,
        summary: analysis.narrative_summary ?? "No summary generated.",
        emotionalState: analysis.emotional_state ?? "Unknown",
        topics: analysis.key_topics ?? [],
        riskFlags: analysis.risk_flags ?? [],
        endedAt: new Date(),
      }
    });

    console.log(`[Webhook] Saved session ${call_id}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Webhook Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}