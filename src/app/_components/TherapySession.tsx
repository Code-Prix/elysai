/* eslint-disable */
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import Retell from "retell-sdk";
import Groq from "groq-sdk";

// Initialize SDKs with Environment Variables
const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY!,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Helper function to map Prisma output to expected API/Frontend format (snake_case)
const mapSessionToSummary = (session: any) => {
    // Note: session is typically camelCase from Prisma. Frontend/Groq API expect snake_case.
    return {
        emotional_state: session.emotionalState ?? "Neutral",
        key_topics: session.topics ?? [],
        risk_flags: session.riskFlags ?? [],
        narrative_summary: session.summary ?? "Summary unavailable.",
    };
}


export const therapyRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // 1. START WEB CALL
  // --------------------------------------------------------------------------
  // We use publicProcedure to allow guests, but we capture session.user.id if it exists.
  createWebCall: publicProcedure
    .input(z.object({ 
      userName: z.string().optional(),
      userContext: z.string().optional() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Identify the user (or mark as guest)
        const userId = ctx.session?.user?.id || "guest";

        const webCall = await retell.call.createWebCall({
          agent_id: process.env.RETELL_AGENT_ID!,
          
          // CRITICAL: Pass metadata so the Webhook can link this call to the user later
          metadata: {
            userId: userId,
          },
          
          // Inject context into the LLM for the "Fine-Tuning" effect
          retell_llm_dynamic_variables: {
            user_name: input.userName ?? "Friend",
            context: input.userContext ?? "User just started the session.",
          },
        });
        
        return { 
            accessToken: webCall.access_token,
            callId: webCall.call_id 
        };
      } catch (error) {
        console.error("Web Call Error:", error);
        throw new Error("Failed to start web session.");
      }
    }),

  // --------------------------------------------------------------------------
  // 2. GENERATE / RETRIEVE SUMMARY
  // --------------------------------------------------------------------------
  // This is called by the frontend when the call ends.
  generateSummary: publicProcedure
    .input(z.object({ callId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // STRATEGY A: Check if the Webhook already saved it (Fastest & Cheapest)
        const savedSession = await ctx.prisma.therapySession.findUnique({
          where: { retellCallId: input.callId }
        });
        
        if (savedSession) {
          console.log("✅ returning saved summary from DB");
          // FIX HERE: Map Prisma's camelCase output to frontend's snake_case expectation
          return mapSessionToSummary(savedSession);
        }

        // STRATEGY B: Webhook hasn't arrived yet. Generate Live. (Fallback)
        console.log("⚠️ Webhook pending. Generating live summary...");
        
        // 1. Fetch Transcript from Retell
        // We wait a moment to ensure Retell has processed the audio
        await new Promise(resolve => setTimeout(resolve, 1500));
        const call = await retell.call.retrieve(input.callId);
        
        if (!call.transcript) {
            // This return needs to match the structure the frontend checks for "Processing"
            return {
                emotional_state: "Processing",
                key_topics: [],
                risk_flags: [],
                narrative_summary: "The session transcript is still processing. Please refresh in a moment."
            };
        }

        // 2. Analyze with Groq (Llama 3)
        const completion = await groq.chat.completions.create({
            messages: [
            {
                role: "system",
                content: `
                You are an expert clinical supervisor. Analyze this therapy transcript.
                Output a JSON object with EXACTLY this structure:
                {
                  "emotional_state": "string (e.g. Anxious)",
                  "key_topics": ["string", "string"],
                  "risk_flags": ["string" (e.g. None, Self-harm)],
                  "narrative_summary": "string (2 sentences max)"
                }
                `
            },
            { role: "user", content: call.transcript }
            ],
            // Changed model to 70b versatile as it is known to work
            model: "llama-3.3-70b-versatile", 
            response_format: { type: "json_object" }
        });

        // Groq output is already in snake_case (emotional_state, key_topics)
        const analysis = JSON.parse(completion.choices[0]?.message?.content || "{}");

        // 3. Save to DB immediately 
        await ctx.prisma.therapySession.upsert({
            where: { retellCallId: input.callId },
            update: {
                // If this upsert fails, the webhook will try again later.
                // We ensure only actual DB fields are used (camelCase)
                transcript: call.transcript,
                audioUrl: call.recording_url,
                summary: analysis.narrative_summary || "Summary unavailable",
                emotionalState: analysis.emotional_state || "Unknown",
                topics: analysis.key_topics || [],
                riskFlags: analysis.risk_flags || [],
                endedAt: new Date()
            }, 
            create: {
                retellCallId: input.callId,
                userId: ctx.session?.user?.id || null,
                transcript: call.transcript,
                audioUrl: call.recording_url,
                summary: analysis.narrative_summary || "Summary unavailable",
                emotionalState: analysis.emotional_state || "Unknown",
                topics: analysis.key_topics || [],
                riskFlags: analysis.risk_flags || [],
                endedAt: new Date()
            }
        });

        // Return the snake_case JSON directly to the frontend
        return analysis;

      } catch (error) {
        console.error("Summary Error:", error);
        // Return a "graceful failure" object so the UI doesn't crash
        return {
            emotional_state: "Error",
            key_topics: [],
            risk_flags: [],
            narrative_summary: "We couldn't generate the summary right now. Please try again later."
        };
      }
    }),
});