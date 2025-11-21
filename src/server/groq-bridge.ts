/* eslint-disable */
import { WebSocketServer, WebSocket } from "ws";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("❌ FATAL: GROQ_API_KEY missing.");
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. Simple HTTP Server (Passes Health Checks)
const server = createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});

const wss = new WebSocketServer({ server });

// 2. Connection Logic
wss.on("connection", (ws) => {
  console.log("✅ Client Connected");

  // Send Config
  const config = {
    response_type: "config",
    config: {
      auto_reconnect: true,
      call_details: true,
    },
  };
  ws.send(JSON.stringify(config));

  ws.on("message", async (data) => {
    try {
      const raw = data.toString();
      
      // IGNORE ALL PINGS (Do not reply manually)
      if (raw === "ping" || raw.includes('"type":"ping"')) return;

      const event = JSON.parse(raw);

      // Handle Response Request
      if (event.interaction_type === "response_required") {
        const transcript = event.transcript;
        const lastMsg = transcript[transcript.length - 1]?.content || "";
        console.log(`🗣️ User: "${lastMsg}"`);

        const vars = event.call?.retell_llm_dynamic_variables || {};
        const userName = vars.user_name || "Friend";
        
        const systemPrompt = `
          You are Serenity, a therapy AI.
          User: ${userName}. Context: ${vars.context || "None"}.
          Keep it short (1-2 sentences). Be kind.
        `;

        const history = transcript.map((m: any) => ({
          role: m.role === "agent" ? "assistant" : m.role,
          content: m.content
        }));

        const stream = await groq.chat.completions.create({
          messages: [{ role: "system", content: systemPrompt }, ...history],
          model: "llama-3.3-70b-versatile",
          stream: true,
        });

        let buffer = "";

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          buffer += content;

          // Simple Buffer: Send on punctuation or length > 30
          if (/[.!?]/.test(content) || buffer.length > 30) {
            ws.send(JSON.stringify({
              response_type: "response",
              response_id: event.response_id,
              content: buffer,
              content_complete: false,
              end_call: false,
            }));
            buffer = "";
          }
        }

        // Flush
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
      console.error("⚠️ Error:", err);
    }
  });

  ws.on("error", (e) => console.error("❌ Socket Error:", e));
});

// 3. Listen on Dynamic Port
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Bridge running on port ${PORT}`);
});

// 4. Handle Shutdown Cleanly
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});