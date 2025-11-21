import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/server/db";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. Define Interfaces to fix "Unsafe member access" errors
interface RetellEvent {
  event: string;
  call: {
    call_id: string;
    transcript?: string;
    recording_url?: string;
    metadata?: {
      userId?: string;
    };
  };
}

interface AnalysisResult {
  emotional_state?: string;
  narrative_summary?: string;
  key_topics?: string[];
  risk_flags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    // 2. Cast request body to interface (and disable lint for the initial fetch)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const event: RetellEvent = await req.json();

    if (event.event !== "call_ended") {
      return NextResponse.json({ received: true });
    }

    const { call_id, transcript, recording_url, metadata } = event.call;

    console.log(`[Webhook] Processing call ${call_id}`);

    const analysisCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
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
        // 3. Fix: Use ?? instead of ||
        { role: "user", content: transcript ?? "No transcript available." }
      ],
      response_format: { type: "json_object" }
    });

    // 4. Fix: Use ?? for null checks
    const content = analysisCompletion.choices[0]?.message?.content ?? "{}";
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const analysis: AnalysisResult = JSON.parse(content);

    await prisma.therapySession.create({
      data: {
        retellCallId: call_id,
        // 5. Fix: All unsafe accesses are now typed via interfaces
        userId: metadata?.userId ?? null,
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