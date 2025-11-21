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
  createWebCall: publicProcedure
    .input(z.object({ 
      userName: z.string().optional(),
      userContext: z.string().optional() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session?.user?.id || "guest";
        const userName = input.userName || "Friend";

        const webCall = await retell.call.createWebCall({
          agent_id: process.env.RETELL_AGENT_ID!,
          
          metadata: {
            userId: userId,
          },
          
          retell_llm_dynamic_variables: {
            user_name: userName,
            context: input.userContext ?? "User just started the session.",
            // NEW: Explicit instruction for the first turn
            start_instruction: `Say exactly: "Hi ${userName}, how are you doing today?"`
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

  // ... (generateSummary remains the same as previous step) ...
  // Copy the generateSummary function from the previous working version here
  generateSummary: publicProcedure
    .input(z.object({ callId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const savedSession = await ctx.prisma.therapySession.findUnique({
          where: { retellCallId: input.callId }
        });
        
        if (savedSession) {
          console.log("✅ returning saved summary from DB");
          return mapSessionToSummary(savedSession);
        }

        console.log("⚠️ Webhook pending. Generating live summary...");
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        const call = await retell.call.retrieve(input.callId);
        
        if (!call.transcript) {
            return {
                emotional_state: "Processing",
                key_topics: [],
                risk_flags: [],
                narrative_summary: "The session transcript is still processing. Please refresh in a moment."
            };
        }

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
            model: "llama-3.3-70b-versatile", 
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0]?.message?.content || "{}");

        await ctx.prisma.therapySession.upsert({
            where: { retellCallId: input.callId },
            update: {
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

        return analysis;

      } catch (error) {
        console.error("Summary Error:", error);
        return {
            emotional_state: "Error",
            key_topics: [],
            risk_flags: [],
            narrative_summary: "We couldn't generate the summary right now. Please try again later."
        };
      }
    }),
});