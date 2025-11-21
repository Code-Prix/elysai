/* eslint-disable */
import { WebSocketServer, WebSocket } from "ws";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("❌ CRITICAL ERROR: GROQ_API_KEY is missing");
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const server = createServer((req, res) => {
  // Health check for Railway
  res.writeHead(200);
  res.end("Bridge Active");
});

const wss = new WebSocketServer({ server });

// Heartbeat State
const clients = new Map<WebSocket, boolean>();

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (clients.get(ws) === false) return ws.terminate();
    clients.set(ws, false);
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(interval));

wss.on("connection", (ws) => {
  console.log("✅ Retell Connected");
  clients.set(ws, true);
  
  ws.on("pong", () => clients.set(ws, true));

  // Send Config Immediately
  ws.send(JSON.stringify({
    response_type: "config",
    config: { 
      auto_reconnect: true, 
      call_details: true 
    },
  }));

  ws.on("message", async (data) => {
    try {
      const rawMsg = data.toString();
      
      // FIX 1: Handle Ping without breaking Retell Parser
      // Retell sometimes sends literal "ping". We must ignore or handle strictly.
      if (rawMsg === "ping") {
        // Do NOT send {"type": "pong"} if Retell expects response objects.
        // Just log it and keep connection alive via standard ws.ping()
        console.log("💓 Received Text Ping");
        return; 
      }

      const event = JSON.parse(rawMsg);

      // FIX 2: Handle JSON Ping
      if (event.type === 'ping') {
        console.log("💓 Received JSON Ping");
        return;
      }

      if (event.interaction_type === "response_required") {
        const transcript = event.transcript;
        const vars = event.call?.retell_llm_dynamic_variables || {};
        
        console.log(`🗣️ User: ${transcript[transcript.length - 1]?.content}`);

        const systemPrompt = `
          You are Serenity, a supportive therapy AI.
          User: ${vars.user_name || "Friend"}. 
          Context: ${vars.context || "None"}.
          Guidelines: Be warm but concise. No lists. Max 2 sentences.
        `;

        const sanitizedTranscript = transcript.map((msg: any) => ({
          role: msg.role === "agent" ? "assistant" : msg.role,
          content: msg.content
        }));

        const completion = await groq.chat.completions.create({
          messages: [{ role: "system", content: systemPrompt }, ...sanitizedTranscript],
          model: "llama-3.3-70b-versatile",
          stream: true,
        });

        let buffer = "";
        
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          buffer += content;

          if (ws.readyState !== WebSocket.OPEN) break;

          // FIX 3: Strict Protocol Response
          if (/[.!?]/.test(content) || buffer.length > 50) {
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
      console.error("Error:", err);
    }
  });

  ws.on("close", () => {
    console.log("❌ Retell Disconnected");
    clients.delete(ws);
  });
  
  ws.on("error", (e) => console.error("Socket Error:", e));
});

// Start Server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🧠 Bridge Active on port ${PORT}`);
});

// Handle Shutdown Signal from Railway
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Shutting down...");
  server.close(() => process.exit(0));
});