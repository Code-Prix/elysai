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
const server = createServer();
const wss = new WebSocketServer({ server });

// --- 1. HEARTBEAT MECHANISM ---
function heartbeat(this: WebSocket) {
  // @ts-ignore
  this.isAlive = true;
}

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    // @ts-ignore
    if (ws.isAlive === false) return ws.terminate();
    // @ts-ignore
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(interval));

// --- 2. ROBUST ERROR HANDLING ---
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error("❌ FATAL: Port busy. Attempting to close and retry...");
    server.close();
    setTimeout(() => {
      server.listen(process.env.PORT || 8080);
    }, 1000);
  } else {
    console.error("Server Error:", err);
  }
});

wss.on("connection", (ws) => {
  console.log("✅ Retell Connected");
  
  // @ts-ignore
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  // Send config immediately
  ws.send(JSON.stringify({
    response_type: "config",
    config: { 
      auto_reconnect: true, 
      call_details: true 
    },
  }));

  ws.on("message", async (data) => {
    try {
      const event = JSON.parse(data.toString());

      // Handle Retell Pings
      if (event.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
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

          // Optimized Buffering
          if (/[.!?]/.test(content) || buffer.length > 100) {
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

  ws.on("close", () => console.log("❌ Retell Disconnected"));
  ws.on("error", (e) => console.error("Socket Error:", e));
});

// --- 3. GRACEFUL SHUTDOWN ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🧠 Bridge Active on port ${PORT}`);
});

const shutdown = () => {
  console.log("🛑 Shutting down server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);