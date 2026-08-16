import { AIChat } from "./ai-chat";

export default function AIPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          🤖 HotelPilot AI
        </h1>
        <p className="text-xs text-parchment-dim">
          Ask anything about your hotel. Answers come from your real data.
        </p>
      </header>

      <div className="px-6 py-8">
        <AIChat />
      </div>
    </main>
  );
}
