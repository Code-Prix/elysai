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

// 1. HTTP Server (Health Check)
const server = createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});

const wss = new WebSocketServer({ server });

// 2. Global Error Handler (Prevent Crash)
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

// 3. Aggressive Keep-Alive
const keepAliveInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping(); 
    }
  });
}, 3000); // Ping every 3s

wss.on("close", () => clearInterval(keepAliveInterval));

wss.on("connection", (ws) => {
  console.log("✅ Client Connected");

  // Send Config Immediately
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
      
      // Ignore raw Pings
      if (raw === "ping") return;

      const event = JSON.parse(raw);

      // Ignore JSON Pings
      if (event.type === 'ping') return;

      // Log Interactions
      if (event.interaction_type === "response_required") {
        const transcript = event.transcript;
        const lastMsg = transcript[transcript.length - 1]?.content || "Unknown";
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
          if (ws.readyState !== WebSocket.OPEN) break;

          const content = chunk.choices[0]?.delta?.content || "";
          buffer += content;

          // Safe Buffering: Send on punctuation OR length > 30
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
        if (ws.readyState === WebSocket.OPEN) {
          if (buffer.length > 0) {
            ws.send(JSON.stringify({
              response_type: "response",
              response_id: event.response_id,
              content: buffer,
              content_complete: false,
              end_call: false,
            }));
          }
          
          ws.send(JSON.stringify({
            response_type: "response",
            response_id: event.response_id,
            content: "",
            content_complete: true,
            end_call: false,
          }));
        }
      }
    } catch (err) {
      console.error("⚠️ Message Error:", err);
    }
  });

  ws.on("close", () => console.log("❌ Client Disconnected"));
  ws.on("error", (e) => console.error("❌ Socket Error:", e));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Bridge running on port ${PORT}`);
});

// Handle Shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Closing server...");
  server.close(() => process.exit(0));
});