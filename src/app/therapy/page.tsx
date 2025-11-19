// Example: src/app/page.tsx or src/app/therapy/page.tsx
import { VoiceTherapyBot } from "@/app/_components/VoiceTherapyBot";

export default function TherapyPage() {
  return (
    <main>
      <h1 className="text-xl font-bold">Voice Therapy Assistant</h1>
      <VoiceTherapyBot />
    </main>
  );
}
