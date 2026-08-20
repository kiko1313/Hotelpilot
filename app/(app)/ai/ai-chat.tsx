"use client";

import { useState, useTransition } from "react";
import { askHotelPilotAI, confirmAgentAction, type PendingAction } from "@/lib/actions/ai";

const SUGGESTIONS = [
  "What is the current occupancy?",
  "Are there unpaid stays?",
  "Show me today's arrivals",
  "Summarize shift issues",
  "What happened today?",
];

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; isError?: boolean; pendingAction?: PendingAction }
  | { role: "assistant"; text: string; resolvedAction: true };

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);

  function ask(question: string) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    startTransition(async () => {
      const result = await askHotelPilotAI(question);
      setMessages((m) => [
        ...m,
        result.ok
          ? { role: "assistant", text: result.answer, pendingAction: result.pendingAction }
          : { role: "assistant", text: result.error, isError: true },
      ]);
    });
  }

  function confirm(index: number, action: PendingAction) {
    setConfirmingIndex(index);
    startTransition(async () => {
      const result = await confirmAgentAction(action);
      setConfirmingIndex(null);
      setMessages((m) => [
        ...m,
        result.ok
          ? { role: "assistant", text: result.answer, resolvedAction: true as const }
          : { role: "assistant", text: result.error, isError: true },
      ]);
    });
  }

  function cancel(index: number) {
    setMessages((m) => [
      ...m,
      { role: "assistant", text: "Cancelled — no changes were made.", resolvedAction: true },
    ]);
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
          <div key={i}>
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "ml-auto max-w-[80%] bg-brass text-ink-950"
                  : "isError" in m && m.isError
                  ? "max-w-[80%] border border-danger/40 bg-danger/10 text-parchment"
                  : "max-w-[80%] border border-ink-700 bg-ink-900 text-parchment"
              }`}
            >
              {m.text}
            </div>

            {m.role === "assistant" && "pendingAction" in m && m.pendingAction && (
              <div className="mt-2 max-w-[80%] rounded-2xl border border-warn/40 bg-warn/10 p-3">
                <p className="mb-2 text-xs font-medium text-warn">
                  This will make a change — confirm to proceed.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirm(i, m.pendingAction!)}
                    disabled={isPending && confirmingIndex === i}
                    className="rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-brass-bright disabled:opacity-60"
                  >
                    {isPending && confirmingIndex === i ? "Working…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => cancel(i)}
                    className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-parchment transition-colors hover:border-brass-dim"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {isPending && confirmingIndex === null && (
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
          placeholder="Ask about occupancy, payments, staff, shifts…"
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
