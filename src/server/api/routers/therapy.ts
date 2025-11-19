import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import Retell from "retell-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY!,
});

export const therapyRouter = createTRPCRouter({
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
          // 1. Pass Custom Payload here
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

  createWebCall: publicProcedure
    .input(z.object({ 
      userName: z.string().optional(),
      userContext: z.string().optional() 
    }))
    .mutation(async ({ input }) => {
      try {
        const webCall = await retell.call.createWebCall({
          agent_id: process.env.RETELL_AGENT_ID!,
          // 1. Pass Custom Payload here
          retell_llm_dynamic_variables: {
            user_name: input.userName ?? "Friend",
            context: input.userContext ?? "User just started the app.",
          },
        });
        
        return { accessToken: webCall.access_token };
      } catch (error) {
        console.error("Web Call Error:", error);
        throw new Error("Failed to start web session.");
      }
    }),
});