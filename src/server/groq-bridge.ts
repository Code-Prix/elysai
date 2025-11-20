/* eslint-disable */
import { WebSocketServer } from "ws";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

// Initialize Groq SDK client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Set up WebSocket Server on port 8080 to listen for Retell
const wss = new WebSocketServer({ port: 8080 });

console.log("🧠 Groq Bridge running on port 8080");

wss.on("connection", (ws, req) => {
  console.log("Retell connected to the Brain 🧠");

  // Send initial config to Retell upon connection
  const welcomeConfig = {
    response_type: "config",
    config: {
      auto_reconnect: true,
      call_details: true, // CRITICAL: This is needed to receive dynamic_variables
    },
  };
  ws.send(JSON.stringify(welcomeConfig));

  ws.on("message", async (data) => {
    // Force string conversion to satisfy linter
    const event = JSON.parse(data.toString());

    if (event.interaction_type === "response_required") {
      const transcript = event.transcript;
      
      // 1. Extract Custom Payload (user_name and context)
      // These come from the Frontend -> Router -> Retell -> Here
      const vars = event.call?.retell_llm_dynamic_variables || {};
      const userName = vars.user_name || "Friend";
      const userContext = vars.context || "No context provided";

      console.log(`Context: Speaking to ${userName} (${userContext})`);

      // 2. Dynamic System Prompt using the custom payload
      const systemPrompt = `
        You are Serenity, a compassionate, warm therapy AI. 
        You are speaking with ${userName}.
        Context about their situation: ${userContext}.
        
        Guidelines:
        - Keep answers short (1-2 sentences).
        - Be empathetic but direct.
        - Do not use lists.
      `;

      // 3. FIX: Sanitize transcript AND map 'agent' to 'assistant'
      // This prevents both "property 'words' unsupported" AND "discriminator 'role' invalid" errors
      const sanitizedTranscript = transcript.map((msg: any) => ({
        role: msg.role === "agent" ? "assistant" : msg.role,
        content: msg.content
      }));

      try {
        // Call Groq (Llama 3) for streaming response
        const completion = await groq.chat.completions.create({
            messages: [
            { role: "system", content: systemPrompt },
            ...sanitizedTranscript, // Use the mapped transcript
            ],
            model: "llama-3.3-70b-versatile",
            stream: true, 
        });

        // Stream Groq response back to Retell
        for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            
            const response = {
            response_type: "response",
            response_id: event.response_id,
            content: content,
            content_complete: false,
            end_call: false,
            };
            ws.send(JSON.stringify(response));
        }

        // Send content_complete signal
        const endResponse = {
            response_type: "response",
            response_id: event.response_id,
            content: "",
            content_complete: true,
            end_call: false,
        };
        ws.send(JSON.stringify(endResponse));

      } catch (error) {
        console.error("Groq API Error:", error);
      }
    }
  });

  ws.on("close", () => {
    console.log("Retell disconnected");
  });
});