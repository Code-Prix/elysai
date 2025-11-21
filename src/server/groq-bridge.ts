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

  // CRITICAL FIX 1: Handle Standard WebSocket Pings (Opcode 0x9)
  ws.on("ping", () => {
    console.log("🏓 Received Standard PING -> Sending PONG");
    ws.pong();
  });

  ws.on("message", async (data) => {
    try {
      const raw = data.toString();
      const event = JSON.parse(raw);

      // CRITICAL FIX 2: Handle Retell's Application-Layer Ping
      if (event.interaction_type === "ping_pong") {
        console.log("🏓 Received Retell JSON PING -> Sending PONG");
        ws.send(JSON.stringify({
          response_type: "ping_pong",
          timestamp: event.timestamp
        }));
        return;
      }

      // Handle Response Request
      if (event.interaction_type === "response_required") {
        const transcript = event.transcript;
        const lastMsg = transcript[transcript.length - 1]?.content || "";
        console.log(`🗣️ User: "${lastMsg}"`);

        const vars = event.call?.retell_llm_dynamic_variables || {};
        const userName = vars.user_name || "Friend";
        const userContext = vars.context || "No specific context provided.";

        // 1. HARDCODED GREETING (Zero Latency)
        if (transcript.length === 0) {
          console.log("⚡ Sending Hardcoded Greeting");
          const greeting = `Hey ${userName}... it's really nice to meet you. How have you been feeling today?`;

          ws.send(JSON.stringify({
            response_type: "response",
            response_id: event.response_id,
            content: greeting,
            content_complete: true,
            end_call: false,
          }));
          return;
        }

        // --- OPTIMIZED SYSTEM PROMPT START ---
        const systemPrompt = `You are LS-AI, a supportive therapy companion. Create a safe, warm space.
User: ${userName}. Context: ${userContext}.
Style: Gentle, warm, respectful. Friend + calm therapist. No attitude/robotic tone.
LOCATION: India.
CRITICAL: If user mentions suicide/self-harm, provide INDIAN resources ONLY:
- Vandrevala Foundation: 1860 266 2345
- iCall: 9152987821
- AASRA: 9820466726
DO NOT provide US numbers (like 988).

Flow:
1. You speak first. Greet ${userName}.
2. NEVER interrupt.
3. Max 1-3 sentences.
4. Be friendly, build trust.
5. Help user open up (e.g., "What's on your mind?").
6. If silent, gently encourage.
7. No early summarizing.
8. No medical advice.
Rules: Wait 1.2s before replying. Short messages. No hallucinations.`;
        // --- OPTIMIZED SYSTEM PROMPT END ---

        const history = transcript.map((m: any) => ({
          role: m.role === "agent" ? "assistant" : m.role,
          content: m.content
        }));

        // REINFORCEMENT: Inject a system note at the end of history to override any default training bias
        const reinforcedMessages = [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "system", content: "IMPORTANT: You are in INDIA. If emergency resources are needed, provide ONLY Indian numbers (Vandrevala: 18602662345). DO NOT provide US numbers." }
        ];

        const stream = await groq.chat.completions.create({
          messages: reinforcedMessages,
          // FIX: Using llama-3.1-8b-instant for lowest latency voice response
          model: "llama-3.1-8b-instant",
          stream: true,
        });

        let buffer = "";

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          buffer += content;

          // Optimized Buffer: Send on punctuation or length > 10 for faster streaming
          if (/[.!?]/.test(content) || buffer.length > 10) {
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
      console.error("⚠️ Error processing message:", err);
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