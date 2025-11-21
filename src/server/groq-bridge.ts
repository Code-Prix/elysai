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

// 1. Create HTTP Server (Health Check for Railway)
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("OK");
  } else {
    res.writeHead(404);
    res.end();
  }
});

// 2. WebSocket Server
const wss = new WebSocketServer({ server });

// 3. Native Heartbeat (No Application Layer JSON)
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
    ws.ping(); // Standard WS Ping frame, NOT JSON
  });
}, 10000);

wss.on("close", () => clearInterval(interval));

wss.on("connection", (ws) => {
  console.log("✅ Retell Connected");
  
  // @ts-ignore
  ws.isAlive = true;
  ws.on("pong", heartbeat);

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
      
      // IGNORE Text Pings (Do not reply with JSON)
      if (rawMsg === "ping") {
        return; 
      }

      const event = JSON.parse(rawMsg);

      // IGNORE JSON Pings (Do not reply with JSON)
      if (event.type === 'ping') {
        return;
      }

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

          if (ws.readyState !== WebSocket.OPEN) break;

          // Safe Buffering
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

// 4. Robust Listen & Shutdown
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🧠 Bridge Active on port ${PORT}`);
});

// Handle Railway SIGTERM to prevent "Port in use" on restart
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM. Closing server...");
  server.close(() => {
    console.log("✅ Closed.");
    process.exit(0);
  });
});