import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/server/db";
import Groq from "groq-sdk";

// Initialize Groq for post-call analysis
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Secret (Optional for Hackathon, Critical for Prod)
    // const signature = req.headers.get("x-retell-signature");
    // if (!verifySignature(signature, body)) return new Response("Unauthorized", { status: 401 });

    const event = await req.json();

    // 2. Only handle "call_ended" events
    if (event.event !== "call_ended") {
      return NextResponse.json({ received: true });
    }

    const { call_id, transcript, recording_url, metadata } = event.call;

    console.log(`[Webhook] Processing call ${call_id}`);

    // 3. Analyze Transcript with Groq (Narrative Summary & Risk)
    // We do this HERE so the data is ready when the user checks their dashboard.
    const analysisCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
            You are an expert clinical supervisor. Analyze this therapy transcript.
            Output JSON ONLY with these keys:
            - emotional_state: string (e.g. "Anxious", "Hopeful")
            - narrative_summary: string (2-3 sentence summary of the session)
            - key_topics: string[] (Max 3 topics)
            - risk_flags: string[] (e.g. "None", "Self-harm", "Suicidal Ideation")
          `
        },
        { role: "user", content: transcript || "No transcript available." }
      ],
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(analysisCompletion.choices[0]?.message?.content || "{}");

    // 4. Save to Database
    // We use the 'metadata.userId' we passed during call creation to link it.
    await prisma.therapySession.create({
      data: {
        retellCallId: call_id,
        userId: metadata?.userId || null, // Link to user if authenticated
        transcript: transcript || "",
        audioUrl: recording_url || null,
        summary: analysis.narrative_summary || "No summary generated.",
        emotionalState: analysis.emotional_state || "Unknown",
        topics: analysis.key_topics || [],
        riskFlags: analysis.risk_flags || [],
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