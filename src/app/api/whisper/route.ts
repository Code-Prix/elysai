import { NextRequest, NextResponse } from "next/server";

// POST /api/whisper
export async function POST(req: NextRequest) {
  // Extract the uploaded audio file from the form data
  const formData = await req.formData();
  const file = formData.get("audio") as File;
  if (!file) return NextResponse.json({ error: "No audio file sent" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  // Forward the audio to Whisper OSS Flask API
  const fd = new FormData();
  fd.append("audio", new Blob([buffer]), "audio.wav");

  const whisperRes = await fetch("https://tartaric-nonpalliatively-freddie.ngrok-free.dev/transcribe", {
    method: "POST",
    body: fd,
  });
  if (!whisperRes.ok) {
    return NextResponse.json({ error: "Whisper server error" }, { status: 502 });
  }
  const whisperData = await whisperRes.json();

  return NextResponse.json({ transcript: whisperData.text });
}
