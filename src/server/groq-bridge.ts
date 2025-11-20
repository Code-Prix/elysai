/* eslint-disable */
import { WebSocketServer } from "ws";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const wss = new WebSocketServer({ port: 8080 });

console.log("🧠 Groq Bridge (Buffered) running on port 8080");

wss.on("connection", (ws, req) => {
  console.log("Retell connected");

  const welcomeConfig = {
    response_type: "config",
    config: {
      auto_reconnect: true,
      call_details: true,
    },
  };
  ws.send(JSON.stringify(welcomeConfig));

  ws.on("message", async (data) => {
    const event = JSON.parse(data.toString());

    if (event.interaction_type === "response_required") {
      const transcript = event.transcript;
      
      const vars = event.call?.retell_llm_dynamic_variables || {};
      const userName = vars.user_name || "Friend";
      const userContext = vars.context || "No context provided";

      console.log(`Talking to: ${userName}`);

      const systemPrompt = `
        You are Serenity, a compassionate therapy AI.
        User Name: ${userName}.
        Situation: ${userContext}.
        Guidelines: Keep answers short (1-2 sentences). Be empathetic. No lists.
      `;

      // Sanitize transcript
      const sanitizedTranscript = transcript.map((msg: any) => ({
        role: msg.role === "agent" ? "assistant" : msg.role,
        content: msg.content
      }));

      try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                ...sanitizedTranscript, 
            ],
            model: "llama-3.3-70b-versatile",
            stream: true, 
        });

        // --- SMART BUFFERING LOGIC ---
        let buffer = "";
        
        for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            buffer += content;

            // Only send if we have a full sentence OR a significant chunk
            // This prevents flooding the WebSocket with tiny packets
            if (buffer.length > 50 || /[.!?]$/.test(buffer)) {
                const response = {
                    response_type: "response",
                    response_id: event.response_id,
                    content: buffer,
                    content_complete: false,
                    end_call: false,
                };
                ws.send(JSON.stringify(response));
                buffer = ""; // Clear buffer
            }
        }

        // Send any remaining text in the buffer
        if (buffer.length > 0) {
            const response = {
                response_type: "response",
                response_id: event.response_id,
                content: buffer,
                content_complete: false,
                end_call: false,
            };
            ws.send(JSON.stringify(response));
        }

        // Send completion signal
        const endResponse = {
            response_type: "response",
            response_id: event.response_id,
            content: "",
            content_complete: true,
            end_call: false,
        };
        ws.send(JSON.stringify(endResponse));

      } catch (error) {
        console.error("Groq API Error:", error);
      }
    }
  });

  ws.on("close", () => {
    console.log("Retell disconnected");
  });
});