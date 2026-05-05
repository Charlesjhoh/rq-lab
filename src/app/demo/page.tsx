// src/app/demo/page.tsx
import Recorder from "@/components/recorder";

export default function DemoPage() {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">발음 앱 데모</h1>
      <Recorder />
    </main>
  );
}
