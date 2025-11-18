import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("audio") as File;
  if (!file) return NextResponse.json({ error: "No audio file sent" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fd = new FormData();
  fd.append("audio", new Blob([buffer]), "audio.wav");

  // Transcribe audio to text
  const whisperRes = await fetch(process.env.WHISPER_API_URL!, {
    method: "POST",
    body: fd,
  });
  if (!whisperRes.ok) {
    return NextResponse.json({ error: "Whisper server error" }, { status: 502 });
  }
  const whisperData = await whisperRes.json();
  const transcript = whisperData.text;

  // Send transcript to Gemini for AI response
 const geminiPayload = {
  contents: [
    {
      role: "user",
      parts: [{ text: transcript }]
    }
  ],
  system_instruction: {
    parts: [
      { text: "You are an empathetic, caring, and solution-focused therapist. Respond calmly, supportively, and with practical emotional advice. Do not offer medical diagnosis or crisis counseling—if the user is in crisis or at risk, encourage them to seek in-person professional help immediately." }
    ]
  }
};


  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    }
  );
  if (!geminiRes.ok) {
    return NextResponse.json({ transcript, error: "Gemini API error" }, { status: 502 });
  }
  const geminiData = await geminiRes.json();
  const reply =
    geminiData.candidates?.[0]?.content?.parts?.[0]?.text ??
    geminiData?.candidates?.[0]?.content?.parts?.[0] ??
    "(No reply)";

  return NextResponse.json({ transcript, reply });
}
