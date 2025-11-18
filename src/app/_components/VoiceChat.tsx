"use client";
import React, { useRef, useState } from "react";

export default function VoiceChat() {
  const [messages, setMessages] = useState<{ user: string; ai: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunks.current = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    recorder.onstop = async () => {
      setLoading(true);
      const blob = new Blob(chunks.current, { type: "audio/wav" });
      const fd = new FormData();
      fd.append("audio", blob, "audio.wav");
      const res = await fetch("/api/voicechat", { method: "POST", body: fd });
      const data = await res.json();
      setMessages(messages => [...messages, { user: data.transcript, ai: data.reply }]);
      speakAI(data.reply);
      setLoading(false);
    };
    mediaRecorder.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const speakAI = (text: string) => {
    const utter = new window.SpeechSynthesisUtterance(text);
    // Customize as needed: utter.lang = "en-US";
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 rounded bg-gray-100 shadow">
      <h2 className="text-xl font-bold mb-4">Voice-AI Chat (Gemini)</h2>
      <div className="flex flex-col gap-4 mb-6 max-h-80 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className="mb-2"><span className="font-bold text-blue-700">You:</span> {msg.user}</div>
            <div><span className="font-bold text-purple-700">AI:</span> {msg.ai}</div>
            <button className="ml-2 bg-green-500 px-2 py-0.5 rounded text-white text-xs"
              onClick={() => speakAI(msg.ai)}>🔊 Hear Again</button>
          </div>
        ))}
      </div>
      <button
        className={`w-full px-4 py-2 rounded text-white ${isRecording ? "bg-red-600" : "bg-blue-600"} ${loading ? "opacity-50" : ""}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={loading}
      >
        {isRecording ? "Stop Recording" : loading ? "Processing..." : "Start Talking"}
      </button>
    </div>
  );
}
