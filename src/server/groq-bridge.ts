import { WebSocketServer } from "ws";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const wss = new WebSocketServer({ port: 8080 });

console.log("🧠 Groq Bridge Server running on port 8080");

wss.on("connection", (ws, req) => {
  console.log("Retell connected to the Brain 🧠");

  // Send config immediately
  const welcomeConfig = {
    response_type: "config",
    config: {
      auto_reconnect: true,
      call_details: true, // CRITICAL: Must be true to receive variables
    },
  };
  ws.send(JSON.stringify(welcomeConfig));

  ws.on("message", async (data) => {
    const event = JSON.parse(data.toString());

    if (event.interaction_type === "response_required") {
      const transcript = event.transcript;
      const lastUserMessage = transcript[transcript.length - 1].content;
      
      console.log("User said:", lastUserMessage);

      // 2. Extract Custom Payload from Retell Event
      // Retell passes the variables we set in the tRPC router here
      const vars = event.call?.retell_llm_dynamic_variables || {};
      const userName = vars.user_name || "Friend";
      const userContext = vars.context || "No context provided";

      console.log(`Context: Speaking to ${userName} (${userContext})`);

      // 3. Dynamic System Prompt
      const systemPrompt = `
        You are Serenity, a compassionate therapy AI. 
        You are speaking with ${userName}.
        Context about their situation: ${userContext}.
        
        Guidelines:
        - Keep answers short (1-2 sentences).
        - Be empathetic but direct.
        - Do not use lists.
      `;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...transcript, 
        ],
        model: "llama-3.3-70b-versatile",
        stream: true, 
      });

      let currentSentence = "";
      
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || "";
        currentSentence += content;
        
        const response = {
          response_type: "response",
          response_id: event.response_id,
          content: content,
          content_complete: false,
          end_call: false,
        };
        ws.send(JSON.stringify(response));
      }

      const endResponse = {
        response_type: "response",
        response_id: event.response_id,
        content: "",
        content_complete: true,
        end_call: false,
      };
      ws.send(JSON.stringify(endResponse));
    }
  });

  ws.on("close", () => {
    console.log("Retell disconnected");
  });
});