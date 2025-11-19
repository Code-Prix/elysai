"use client";

import { useRef, useState } from "react";
import { api } from "~/trpc/react"; // tRPC hooks

function speak(text: string) {
  const synth = window.speechSynthesis;
  const utter = new window.SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  synth.speak(utter);
}

export function VoiceTherapyBot() {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const chatMutation = api.openai.chat.useMutation({
    onSuccess: (data) => {
      setStatus("AI replying...");
      speak(data.reply); // speak reply instantly!
      setStatus("Waiting...");
    },
    onError: () => setStatus("Error with AI reply."),
  });

  // Start voice recognition
  const startListening = () => {
    setStatus("Listening...");
    const SpeechRecognition =
      (window.SpeechRecognition || window.webkitSpeechRecognition) as typeof window.SpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Speech recognition not supported");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setStatus("Mic error.");
    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setStatus(`You said: "${transcript}"`);
      chatMutation.mutate({ message: transcript });
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Stop voice recognition
  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("Stopped listening.");
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <button
        type="button"
        className={`px-6 py-3 rounded text-white ${listening ? "bg-red-500" : "bg-blue-500"}`}
        onClick={listening ? stopListening : startListening}
        disabled={chatMutation.isPending}
      >
        {listening ? "Stop Listening" : "Start Talking"}
      </button>
      <div className="text-lg">{status}</div>
      {chatMutation.isPending && <div>AI: Thinking...</div>}
    </div>
  );
}
