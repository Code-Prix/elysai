/* eslint-disable */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import Retell from "retell-sdk";
import Groq from "groq-sdk";

// Initialize SDKs
// Ensure RETELL_API_KEY and GROQ_API_KEY are in your .env file
const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY!,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export const therapyRouter = createTRPCRouter({
  // 1. Phone Call Endpoint (Required by PhoneCallView)
  createPhoneCall: publicProcedure
    .input(z.object({ 
      userPhoneNumber: z.string(),
      userName: z.string().optional(),
      userContext: z.string().optional() 
    }))
    .mutation(async ({ input }) => {
      try {
        const call = await retell.call.createPhoneCall({
          from_number: process.env.RETELL_PHONE_NUMBER!,
          to_number: input.userPhoneNumber,
          override_agent_id: process.env.RETELL_AGENT_ID,
          retell_llm_dynamic_variables: {
            user_name: input.userName ?? "Friend",
            context: input.userContext ?? "New session",
          },
        });
        return { callId: call.call_id };
      } catch (error) {
        console.error("Phone Call Error:", error);
        throw new Error("Failed to initiate phone call.");
      }
    }),

  // 2. Web Call Endpoint (Required by WebSessionView)
  createWebCall: publicProcedure
    .input(z.object({ 
      userName: z.string().optional(),
      userContext: z.string().optional() 
    }))
    .mutation(async ({ input }) => {
      try {
        const webCall = await retell.call.createWebCall({
          agent_id: process.env.RETELL_AGENT_ID!,
          retell_llm_dynamic_variables: {
            user_name: input.userName ?? "Friend",
            context: input.userContext ?? "User just started the app.",
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

  // 3. Summary Endpoint (Required by handleGenerateSummary)
  generateSummary: publicProcedure
    .input(z.object({ callId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        // Wait briefly to ensure Retell has finalized the transcript
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const call = await retell.call.retrieve(input.callId);
        
        if (!call.transcript) {
            return {
                emotional_state: "Unknown",
                key_topics: [],
                risk_flags: [],
                narrative_summary: "No transcript available."
            };
        }

        // Analyze with Groq
        const completion = await groq.chat.completions.create({
            messages: [
            {
                role: "system",
                content: `
                Analyze this therapy session transcript.
                Output a JSON object with:
                - emotional_state (string)
                - key_topics (array of strings)
                - risk_flags (array of strings, e.g. "None" or "Self-harm")
                - narrative_summary (string, 2 sentences)
                `
            },
            { role: "user", content: call.transcript }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0]?.message?.content || "{}");
      } catch (error) {
        console.error("Summary Error:", error);
        throw new Error("Failed to generate summary.");
      }
    }),
});