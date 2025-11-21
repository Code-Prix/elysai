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

// --- 1. AGGRESSIVE HEARTBEAT ---
// Retell expects a PONG within 5-10 seconds.
// We will log these to prove the connection is alive.
function heartbeat(this: WebSocket) {
  // @ts-ignore
  this.isAlive = true;
  console.log("💓 Pong sent to Retell");
}

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    // @ts-ignore
    if (ws.isAlive === false) {
        console.log("💀 Client dead, terminating");
        return ws.terminate();
    }
    // @ts-ignore
    ws.isAlive = false;
    ws.ping();
  });
}, 15000); // Check every 15s

wss.on("close", () => clearInterval(interval));

// --- 2. HANDLE PORT CONFLICTS ---
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error("❌ FATAL: Port busy. Attempting restart...");
    setTimeout(() => {
      server.close();
      server.listen(process.env.PORT || 8080);
    }, 1000);
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
      const rawMsg = data.toString();
      
      // 3. MANUAL PING HANDLER
      // Sometimes Retell sends a literal "ping" message text
      if (rawMsg === "ping" || rawMsg.includes("ping")) {
        ws.send(JSON.stringify({ type: "pong" }));
        console.log("💓 Manual Pong sent");
        return;
      }

      const event = JSON.parse(rawMsg);

      if (event.interaction_type === "response_required") {
        const transcript = event.transcript;
        const vars = event.call?.retell_llm_dynamic_variables || {};
        const userMsg = transcript[transcript.length - 1]?.content || "";
        
        console.log(`🗣️ User: ${userMsg}`);

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

          // 4. SAFETY CHECK
          if (ws.readyState !== WebSocket.OPEN) {
              console.log("⚠️ Socket closed during stream");
              break;
          }

          // 5. OPTIMIZED BUFFERING
          // Sends chunk if it ends with punctuation OR is getting too long
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

  ws.on("close", () => console.log("❌ Retell Disconnected"));
  ws.on("error", (e) => console.error("Socket Error:", e));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🧠 Bridge Active on port ${PORT}`);
});

// Graceful Shutdown
const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);