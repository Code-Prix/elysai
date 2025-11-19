import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const openaiRouter = createTRPCRouter({
  chat: publicProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) throw new Error("OpenAI API key missing");

      // Compose messages for ChatGPT
      const payload = {
        model: "gpt-4", // or "gpt-3.5-turbo"
        messages: [
          { role: "system", content: "You are a helpful, supportive AI therapist." },
          { role: "user", content: input.message },
        ]
      };

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";

      return { reply };
    }),
});
