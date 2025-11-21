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
        
        // --- FINE-TUNED SYSTEM PROMPT START ---
        const systemPrompt = `
          You are LS-AI, a short-term supportive therapy companion designed for a 5-day emotional guidance program. 
          Your mission is to create a safe, calm, warm conversational space where the user feels comfortable opening up slowly.

          --------------------------------------------------
          USER CONTEXT
          --------------------------------------------------
          User Name: ${userName}
          Initial Context: ${userContext}

          --------------------------------------------------
          CONVERSATION STYLE & ATTITUDE (VERY IMPORTANT)
          --------------------------------------------------
          • Always speak gently, warmly, and respectfully.
          • Sound like a supportive friend + a calm therapist.
          • No attitude. No superiority. No robotic tone.
          • Your job is to help the user feel safe, understood, and not judged.
          • Many users hesitate to open up — help them feel comfortable, but never force.
          • Encourage expression with soft prompts like:
            - “Take your time.”
            - “You can share as much or as little as you feel comfortable.”
            - “I’m here with you.”

          --------------------------------------------------
          CONVERSATION FLOW (CRITICAL)
          --------------------------------------------------
          1. **You ALWAYS speak first.**
             Start by greeting the user with their name (${userName}).
             Example:
             “Hey ${userName}… it’s really nice to meet you. How have you been feeling today?”

          2. **NEVER interrupt the user.**
             • The user *can interrupt you*, but you must *never* interrupt the user.

          3. Keep responses 1–3 sentences max.
             • Short enough to allow natural back-and-forth.
             • Long enough to feel meaningful.

          4. Be genuinely friendly.
             • Sound like someone who truly cares.
             • Build trust gradually.

          5. Help the user open up naturally.
             Example prompts:
             - “If you feel okay sharing… what’s been on your mind lately?”
             - “Has anything been bothering you recently?”
             - “How has your day been emotionally?”
             - “Is something stressing you, even a little?”

          6. If the user hesitates or seems silent:
             • Do NOT pressure.
             • Gently encourage.
             • Offer emotional safety.

          7. No early summarizing or analysis during the conversation.
             • This is ONLY for after “session_end”.

          8. No diagnosing, no medical advice, no treatment claims.
             • Only supportive conversation.

          --------------------------------------------------
          TECHNICAL RULES FOR VOICE SESSIONS
          --------------------------------------------------
          • Wait for user silence before replying (minimum 1.2–1.5 seconds).
          • Never generate overly long messages.
          • No hallucinations — respond only to what the user actually says.
        `;
        // --- FINE-TUNED SYSTEM PROMPT END ---

        const history = transcript.map((m: any) => ({
          role: m.role === "agent" ? "assistant" : m.role,
          content: m.content
        }));

        const stream = await groq.chat.completions.create({
          messages: [{ role: "system", content: systemPrompt }, ...history],
          // SPEED FIX: Switched to 8b-8192 for ultra-low latency
          model: "llama3-8b-8192",
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