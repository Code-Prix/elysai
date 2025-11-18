"use client";
import React, { useRef, useState } from "react";

interface AudioRecorderProps {
  onTranscript: (text: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscript }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunks.current = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks.current, { type: "audio/wav" });
      setAudioUrl(URL.createObjectURL(blob));
      setLoading(true);
      const fd = new FormData();
      fd.append("audio", blob, "audio.wav");
      const res = await fetch("/api/whisper", { method: "POST", body: fd });
      const data = await res.json();
      setLoading(false);
      onTranscript(data.transcript || "");
    };
    mediaRecorder.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        className={`px-4 py-2 rounded text-white ${
          isRecording ? "bg-red-600" : "bg-blue-600"
        }`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={loading}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
      {audioUrl && (
        <audio src={audioUrl} controls className="mt-2" />
      )}
      {loading && <p>Transcribing…</p>}
    </div>
  );
};

export default AudioRecorder;
