"use client";

import { useState, useTransition } from "react";
import { askHotelPilotAI } from "@/lib/actions/ai";

const SUGGESTIONS = [
  "Show me today's arrivals",
  "Who still owes money?",
  "What happened last night?",
  "Which rooms are reserved tomorrow?",
  "Is the current shift ready to close?",
];

type Message = { role: "user" | "assistant"; text: string; isError?: boolean };

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function ask(question: string) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    startTransition(async () => {
      const result = await askHotelPilotAI(question);
      setMessages((m) => [
        ...m,
        result.ok
          ? { role: "assistant", text: result.answer }
          : { role: "assistant", text: result.error, isError: true },
      ]);
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {messages.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-ink-600 px-3 py-1.5 text-xs text-parchment-dim transition-colors hover:border-brass-dim hover:text-parchment"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-3 text-sm ${
              m.role === "user"
                ? "ml-auto max-w-[80%] bg-brass text-ink-950"
                : m.isError
                ? "max-w-[80%] border border-danger/40 bg-danger/10 text-parchment"
                : "max-w-[80%] border border-ink-700 bg-ink-900 text-parchment"
            }`}
          >
            {m.text}
          </div>
        ))}
        {isPending && (
          <div className="max-w-[80%] rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-parchment-dim">
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your hotel…"
          className="flex-1 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
