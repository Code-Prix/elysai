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

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error("❌ FATAL: Port 8080 is busy. Kill the old process.");
    process.exit(1);
  }
});

wss.on("connection", (ws: WebSocket) => {
  console.log("✅ Retell Connected");
  
  // HEARTBEAT: Manually keep connection alive
  let isAlive = true;
  ws.on('pong', () => { isAlive = true; });
  
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping(); // Send ping to Retell to keep tunnel open
    }
  }, 10000); // Ping every 10s (aggressive)

  // Send config immediately
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
        response_type: "config",
        config: { 
        auto_reconnect: true, 
        call_details: true 
        },
    }));
  }

  ws.on("message", async (data) => {
    try {
      const event = JSON.parse(data.toString());

      // LOG PING/PONG Events for debugging (Optional, good for diagnosis)
      if (event.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
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

          // Only send if socket is OPEN
          if (ws.readyState !== WebSocket.OPEN) break;

          // Semantic Chunking: Wait for sentence end or comma pause
          if (/[.!?]/.test(content) || (buffer.length > 50 && /[,;]/.test(content))) {
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
            // Flush buffer
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
      }
    } catch (err) {
      console.error("Error:", err);
    }
  });

  ws.on("close", () => {
    console.log("❌ Retell Disconnected");
    clearInterval(pingInterval);
  });
  
  ws.on("error", (e) => console.error("Socket Error:", e));
});

server.listen(8080, () => console.log("🧠 Bridge Active on 8080"));

// CHANGE THIS LINE:
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🧠 Bridge Active on port ${PORT}`);
});