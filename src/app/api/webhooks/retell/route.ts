/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/server/db";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. Define Types
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
    const body = await req.json();
    const event = body as RetellWebhookEvent;

    if (event.event !== "call_ended") {
      return NextResponse.json({ received: true });
    }

    const { call_id, transcript, recording_url, metadata } = event.call;
    console.log(`[Webhook] Processing call ${call_id}`);

    // 2. Analyze with Groq (Using Fast Model)
    const analysisCompletion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // Low latency model
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
        { role: "user", content: transcript ?? "No transcript available." }
      ],
      response_format: { type: "json_object" }
    });

    const rawContent = analysisCompletion.choices[0]?.message?.content ?? "{}";
    const analysis = JSON.parse(rawContent) as AnalysisResult;

    // 3. Handle Guest User ID
    let dbUserId: string | null = null;
    if (metadata?.userId && metadata.userId !== "guest") {
        dbUserId = metadata.userId;
    }

    // 4. UPSERT instead of CREATE (Fixes Unique Constraint Error)
    await prisma.therapySession.upsert({
      where: { retellCallId: call_id },
      update: {
        // If it exists, update the analysis in case it's better/newer
        transcript: transcript ?? "",
        audioUrl: recording_url ?? null,
        summary: analysis.narrative_summary ?? "No summary generated.",
        emotionalState: analysis.emotional_state ?? "Unknown",
        topics: analysis.key_topics ?? [],
        riskFlags: analysis.risk_flags ?? [],
        endedAt: new Date(),
      },
      create: {
        retellCallId: call_id,
        userId: dbUserId,
        transcript: transcript ?? "",
        audioUrl: recording_url ?? null,
        summary: analysis.narrative_summary ?? "No summary generated.",
        emotionalState: analysis.emotional_state ?? "Unknown",
        topics: analysis.key_topics ?? [],
        riskFlags: analysis.risk_flags ?? [],
        endedAt: new Date(),
      }
    });

    console.log(`[Webhook] Saved/Updated session ${call_id}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Webhook Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}