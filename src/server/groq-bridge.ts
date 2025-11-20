/* eslint-disable */
import { WebSocketServer } from "ws";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

// Verify API Key
if (!process.env.GROQ_API_KEY) {
  console.error("❌ CRITICAL ERROR: GROQ_API_KEY is missing in .env");
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Create raw HTTP server first to handle startup errors
const server = createServer();
const wss = new WebSocketServer({ server });

// Handle Server Startup Errors (Like Port in Use)
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error("❌ FATAL ERROR: Port 8080 is already in use.");
    console.error("   ACTION: You must kill the previous terminal process or restart your computer.");
  } else {
    console.error("❌ Server Error:", err);
  }
  process.exit(1);
});

wss.on("connection", (ws, req) => {
  console.log("✅ Retell connected to Bridge");

  const welcomeConfig = {
    response_type: "config",
    config: {
      auto_reconnect: true,
      call_details: true,
    },
  };
  ws.send(JSON.stringify(welcomeConfig));

  ws.on("message", async (data) => {
    try {
      const event = JSON.parse(data.toString());

      if (event.interaction_type === "response_required") {
        const transcript = event.transcript;
        const vars = event.call?.retell_llm_dynamic_variables || {};
        const userName = vars.user_name || "Friend";
        const userContext = vars.context || "No context provided";

        console.log(`💬 User: ${userName} | Context: ${userContext}`);

        const systemPrompt = `
          You are Serenity, a compassionate therapy AI.
          User Name: ${userName}.
          Situation: ${userContext}.
          Guidelines: Keep answers short (1-2 sentences). Be empathetic. No lists.
        `;

        const sanitizedTranscript = transcript.map((msg: any) => ({
          role: msg.role === "agent" ? "assistant" : msg.role,
          content: msg.content
        }));

        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            ...sanitizedTranscript, 
          ],
          model: "llama-3.3-70b-versatile",
          stream: true, 
        });

        // --- SMART BUFFERING (Prevents Crash) ---
        let buffer = "";
        
        for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            buffer += content;

            // Send only when we have a sentence-like chunk or >50 chars
            if (buffer.length > 50 || /[.!?]$/.test(buffer)) {
                const response = {
                    response_type: "response",
                    response_id: event.response_id,
                    content: buffer,
                    content_complete: false,
                    end_call: false,
                };
                ws.send(JSON.stringify(response));
                buffer = ""; 
            }
        }

        // Flush remaining buffer
        if (buffer.length > 0) {
            ws.send(JSON.stringify({
                response_type: "response",
                response_id: event.response_id,
                content: buffer,
                content_complete: false,
                end_call: false,
            }));
        }

        // End Turn
        ws.send(JSON.stringify({
            response_type: "response",
            response_id: event.response_id,
            content: "",
            content_complete: true,
            end_call: false,
        }));
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("❌ Retell disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket Error:", err);
  });
});

// Start listening
server.listen(8080, () => {
  console.log("🧠 Groq Bridge (Buffered & Robust) running on port 8080");
});