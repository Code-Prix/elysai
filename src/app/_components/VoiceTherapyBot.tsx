"use client";
import { useRef, useState } from "react";
import { api } from "~/trpc/react"; // Adjust path if needed

function speak(text: string) {
  const synth = window.speechSynthesis;
  const utter = new window.SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  synth.speak(utter);
}

export default function VoiceTherapyBot() {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [lastAIText, setLastAIText] = useState("");
  const recognitionRef = useRef<any>(null);

  const chatMutation = api.openai.chat.useMutation({
    onSuccess: (data) => {
      setLastAIText(data.reply);
      setStatus("AI replying…");
      speak(data.reply);
      setStatus("");
    },
    onError: () => setStatus("Something went wrong, try again."),
  });

  const startListening = () => {
    setStatus("Listening…");
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Browser doesn't support speech recognition.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setStatus("Mic error.");
    recognition.onend = () => setListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setLastUserText(transcript);
      setStatus(`You: "${transcript}"`);
      chatMutation.mutate({ message: transcript });
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-blue-700 to-indigo-900 p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
        <h2 className="text-3xl font-bold mb-4 text-blue-700">Voice Therapy AI</h2>
        <p className="mb-4 text-gray-600">
          Tap to speak. Your words will be answered by an AI therapist using the latest OpenAI models.
        </p>
        <button
          type="button"
          className={`w-full px-6 py-3 rounded-full font-bold text-lg transition ${
            listening ? "bg-red-500" : "bg-blue-600"
          } text-white hover:opacity-90 mb-6`}
          onClick={listening ? stopListening : startListening}
          disabled={chatMutation.isPending}
        >
          {listening ? "Stop Listening" : "Start Speaking"}
        </button>
        <div className="mb-2 text-lg text-gray-700 min-h-[40px]">
          {status}
        </div>
        {lastUserText && (
          <div className="mb-2 italic text-gray-500">You: {lastUserText}</div>
        )}
        {chatMutation.isPending ? (
          <div className="mb-2 text-indigo-600 animate-pulse">AI: Thinking…</div>
        ) : lastAIText ? (
          <div className="mb-2 font-semibold text-indigo-800">AI: {lastAIText}</div>
        ) : null}
        <div className="mt-6 text-xs text-gray-400">
          Powered by OpenAI · Secure · Private
        </div>
      </div>
    </div>
  );
}
