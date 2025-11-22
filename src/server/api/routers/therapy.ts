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
    // Return BOTH casing styles to be safe
    emotional_state: session.emotionalState ?? "Neutral",
    emotionalState: session.emotionalState ?? "Neutral",

    key_topics: session.topics ?? [],
    topics: session.topics ?? [],

    risk_flags: session.riskFlags ?? [],
    riskFlags: session.riskFlags ?? [],

    narrative_summary: session.summary ?? "Summary unavailable.",
    summary: session.summary ?? "Summary unavailable.",
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
      console.log(`[Summary] Request received for Call ID: ${input.callId}`);
      try {
        // 1. Database Check
        const savedSession = await ctx.prisma.therapySession.findUnique({
          where: { retellCallId: input.callId }
        });

        if (savedSession) {
          console.log("✅ [Summary] Returning saved summary from DB");
          return mapSessionToSummary(savedSession);
        }

        console.log("⚠️ [Summary] Webhook pending. Generating live summary...");

        // Wait a bit for Retell to finalize the transcript
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`[Summary] Fetching call details from Retell...`);
        const call = await retell.call.retrieve(input.callId);
        console.log(`[Summary] Retell status: ${call.call_status}, Transcript length: ${call.transcript?.length || 0}`);

        if (!call.transcript) {
          console.warn("[Summary] No transcript available yet.");
          return {
            emotional_state: "Processing",
            key_topics: [],
            risk_flags: [],
            narrative_summary: "Processing...",
            emotionalState: "Processing"
          };
        }

        console.log(`[Summary] Sending transcript to Groq for analysis...`);
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `
                Analyze this therapy transcript.
                Output JSON:
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

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Groq returned empty content");
        }

        const analysis = JSON.parse(content);
        console.log("[Summary] Analysis generated successfully.");

        // Upsert safely
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
        console.log("[Summary] Saved to database.");

        return {
          ...analysis,
          // Polyfill camelCase so frontend is happy regardless
          emotionalState: analysis.emotional_state,
          topics: analysis.key_topics,
          riskFlags: analysis.risk_flags,
          summary: analysis.narrative_summary
        };

      } catch (error) {
        console.error("❌ [Summary] GENERATION FAILED:", error);
        // Return a structured error that the frontend can recognize
        return {
          emotional_state: "Error",
          emotionalState: "Error",
          key_topics: [],
          risk_flags: [],
          narrative_summary: "We couldn't generate the summary right now. Please try again."
        };
      }
    }),

  testBridge: publicProcedure
    .mutation(async () => {
      try {
        const res = await fetch("http://localhost:8080");
        if (res.ok) {
          return { success: true };
        }
        return { success: false };
      } catch (e) {
        console.error("Bridge Test Failed:", e);
        return { success: false };
      }
    }),
});