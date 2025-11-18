"use client";
import React, { useState } from "react";
import AudioRecorder from "../_components/AudioRecorder";

export default function WhisperTestPage() {
  const [transcript, setTranscript] = useState("");
  return (
    <div className="max-w-md mx-auto mt-12 p-4 bg-gray-100 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Test Whisper OSS Transcription</h2>
      <AudioRecorder onTranscript={setTranscript} />
      {transcript && (
        <div className="mt-4 p-2 bg-white border border-gray-300 rounded">
          <b>Transcript:</b>
          <div className="mt-1">{transcript}</div>
        </div>
      )}
    </div>
  );
}
