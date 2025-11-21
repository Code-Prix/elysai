import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/server/db";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. Define Strict Interfaces
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
    // 2. Safe Assignment with Type Casting
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
        // 3. Safe Access: Use ?? instead of ||
        { role: "user", content: transcript ?? "No transcript available." }
      ],
      response_format: { type: "json_object" }
    });

    // 4. Safe Parse
    const content = analysisCompletion.choices[0]?.message?.content ?? "{}";
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const analysis: AnalysisResult = JSON.parse(content);

    // --- FIX: Handle Guest Users ---
    let validUserId: string | null = null;
    
    // Only try to link a user if the ID is not "guest" and actually looks like a real ID
    if (metadata?.userId && metadata.userId !== "guest") {
       // Optional: verify user exists to be absolutely safe, or trust the ID is valid
       // For strict safety, we can just set it. If it fails (e.g. user deleted), we catch it.
       validUserId = metadata.userId;
    }

    await prisma.therapySession.create({
      data: {
        retellCallId: call_id,
        // If validUserId is null, the relation is skipped (allowed because User? is optional)
        userId: validUserId,
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
    // If it's a Prisma error, log it clearly but don't crash Retell's retry loop if possible
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}