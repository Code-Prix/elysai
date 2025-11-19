import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import OpenAI from "openai";

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openaiRouter = createTRPCRouter({
  chat: publicProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const completion = await openai.chat.completions.create({
          messages: [
            { role: "system", content: "You are a helpful therapy AI." },
            { role: "user", content: input.message }
          ],
          model: "gpt-3.5-turbo",
        });

        return {
          reply: completion.choices[0]?.message?.content ?? "I'm not sure what to say.",
        };
      } catch (error) {
        console.error("OpenAI Error:", error);
        throw new Error("Failed to fetch response from AI");
      }
    }),
});