/* eslint-disable */
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import Retell from "retell-sdk";
import Groq from "groq-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY!,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

const mapSessionToSummary = (session: any) => {
    return {
        emotional_state: session.emotionalState ?? "Neutral",
        key_topics: session.topics ?? [],
        risk_flags: session.riskFlags ?? [],
        narrative_summary: session.summary ?? "Summary unavailable.",
    };
}

export const therapyRouter = createTRPCRouter({
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

  generateSummary: publicProcedure
    .input(z.object({ callId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Database Check
        const savedSession = await ctx.prisma.therapySession.findUnique({
          where: { retellCallId: input.callId }
        });
        
        if (savedSession) {
          console.log("✅ returning saved summary from DB");
          return mapSessionToSummary(savedSession);
        }

        console.log("⚠️ Webhook pending. Generating live summary...");
        
        // 2. Wait & Fetch
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

        // 3. Analyze (Fast Model)
        const completion = await groq.chat.completions.create({
            messages: [
            {
                role: "system",
                content: `
                You are an expert clinical supervisor. Analyze this therapy transcript.
                Output a JSON object with EXACTLY this structure:
                {
                  "emotional_state": "string",
                  "key_topics": ["string"],
                  "risk_flags": ["string"],
                  "narrative_summary": "string"
                }
                `
            },
            { role: "user", content: call.transcript }
            ],
            model: "llama-3.1-8b-instant", 
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0]?.message?.content || "{}");

        // 4. Upsert to DB
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
        console.error("❌ SUMMARY GENERATION FAILED:", error);
        return {
            emotional_state: "Error",
            key_topics: [],
            risk_flags: [],
            narrative_summary: "We couldn't generate the summary right now. Please try again later."
        };
      }
    }),
});