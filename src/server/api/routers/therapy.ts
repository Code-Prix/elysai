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

    key_topics: (session.topics as string[]) ?? [],
    topics: (session.topics as string[]) ?? [],

    risk_flags: (session.riskFlags as string[]) ?? [],
    riskFlags: (session.riskFlags as string[]) ?? [],

    narrative_summary: session.summary ?? "Summary unavailable.",
    summary: session.summary ?? "Summary unavailable.",
  };
}

export const therapyRouter = createTRPCRouter({
  createWebCall: protectedProcedure
    .input(z.object({
      userName: z.string().optional(),
      userContext: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;

        // 1. Check Session Limit (Max 7)
        const sessionCount = await ctx.prisma.therapySession.count({
          where: { userId }
        });

        if (sessionCount >= 7) {
          throw new Error("Session limit reached. You can only have 7 sessions.");
        }

        const userName = input.userName || ctx.session.user.name || "Friend";

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
      } catch (error: any) {
        console.error("Web Call Error:", error);
        throw new Error(error.message || "Failed to start web session.");
      }
    }),

  generateSummary: protectedProcedure
    .input(z.object({ callId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Database Check
        const savedSession = await ctx.prisma.therapySession.findUnique({
          where: { retellCallId: input.callId },
          include: { generatedTasks: true }
        });

        if (savedSession) {
          console.log("✅ returning saved summary from DB");
          return {
            ...mapSessionToSummary(savedSession),
            generatedTasks: savedSession.generatedTasks
          };
        }

        console.log("⚠️ Webhook pending. Generating live summary...");

        await new Promise(resolve => setTimeout(resolve, 1500));
        const call = await retell.call.retrieve(input.callId);

        if (!call.transcript) {
          return {
            emotional_state: "Processing",
            key_topics: [],
            risk_flags: [],
            narrative_summary: "Processing...",
            emotionalState: "Processing",
            generatedTasks: []
          };
        }

        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `
                Analyze this therapy transcript.
                1. Summarize the session.
                2. Identify emotional state.
                3. Extract key topics and risk flags.
                4. Generate 1-3 actionable tasks for the user for the next day based on the session.
                
                Output JSON:
                {
                  "emotional_state": "string",
                  "key_topics": ["string"],
                  "risk_flags": ["string"],
                  "narrative_summary": "string",
                  "next_day_tasks": ["string"]
                }
                `
            },
            { role: "user", content: call.transcript }
          ],
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0]?.message?.content || "{}");
        const tasks = analysis.next_day_tasks || [];

        // Upsert safely
        const session = await ctx.prisma.therapySession.upsert({
          where: { retellCallId: input.callId },
          update: {
            transcript: call.transcript,
            audioUrl: call.recording_url,
            summary: analysis.narrative_summary || "Summary unavailable",
            emotionalState: analysis.emotional_state || "Unknown",
            topics: analysis.key_topics || [],
            riskFlags: analysis.risk_flags || [],
            endedAt: new Date(),
            generatedTasks: {
              create: tasks.map((t: string) => ({
                description: t,
                userId: ctx.session.user.id
              }))
            }
          },
          create: {
            retellCallId: input.callId,
            userId: ctx.session.user.id,
            transcript: call.transcript,
            audioUrl: call.recording_url,
            summary: analysis.narrative_summary || "Summary unavailable",
            emotionalState: analysis.emotional_state || "Unknown",
            topics: analysis.key_topics || [],
            riskFlags: analysis.risk_flags || [],
            endedAt: new Date(),
            generatedTasks: {
              create: tasks.map((t: string) => ({
                description: t,
                userId: ctx.session.user.id
              }))
            }
          },
          include: { generatedTasks: true }
        });

        return {
          ...analysis,
          // Polyfill camelCase so frontend is happy regardless
          emotionalState: analysis.emotional_state,
          topics: analysis.key_topics,
          riskFlags: analysis.risk_flags,
          summary: analysis.narrative_summary,
          generatedTasks: session.generatedTasks
        };

      } catch (error) {
        console.error("❌ SUMMARY GENERATION FAILED:", error);
        return {
          emotional_state: "Error",
          emotionalState: "Error",
          key_topics: [],
          risk_flags: [],
          narrative_summary: "We couldn't generate the summary right now.",
          generatedTasks: []
        };
      }
    }),

  // Get all sessions for the authenticated user
  getUserSessions: protectedProcedure
    .query(async ({ ctx }) => {
      const sessions = await ctx.prisma.therapySession.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          retellCallId: true,
          startedAt: true,
          endedAt: true,
          emotionalState: true,
          summary: true,
        }
      });

      return sessions;
    }),

  // Get a specific session by ID
  getSessionById: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.therapySession.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.session.user.id, // Ensure user owns this session
        },
        include: {
          generatedTasks: true,
        }
      });

      if (!session) {
        throw new Error("Session not found");
      }

      return {
        ...mapSessionToSummary(session),
        generatedTasks: session.generatedTasks,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      };
    }),
});