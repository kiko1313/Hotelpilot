"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

// Minimal shape for the Web Speech API — not fully standardized in TS's DOM lib.
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);

  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: unknown) => {
      const e = event as { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      finalTranscriptRef.current = final;
      setInput(final || interim);
    };

    recognition.onerror = (event: unknown) => {
      const e = event as { error?: string };
      setListening(false);
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        setMicError("Microphone access was denied. You can still type your question.");
      } else if (e.error === "no-speech") {
        setMicError(null); // not a real problem, just nothing heard
      } else {
        setMicError("Voice input isn't working right now — you can still type.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (finalTranscriptRef.current.trim()) {
        ask(finalTranscriptRef.current.trim());
        finalTranscriptRef.current = "";
        setInput("");
      }
    };

    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setMicError(null);
      finalTranscriptRef.current = "";
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        setMicError("Could not start the microphone. You can still type.");
      }
    }
  }

  function speak(text: string) {
    if (!voiceOutputEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }

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
      if (result.ok) speak(result.answer);
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
      if (result.ok) speak(result.answer);
    });
  }

  function cancel() {
    setMessages((m) => [
      ...m,
      { role: "assistant", text: "Cancelled — no changes were made.", resolvedAction: true },
    ]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
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
        ) : (
          <div />
        )}
        <button
          onClick={() => {
            setVoiceOutputEnabled((v) => !v);
            if (voiceOutputEnabled) window.speechSynthesis?.cancel();
          }}
          title={voiceOutputEnabled ? "Voice replies on — click to mute" : "Voice replies off — click to enable"}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            voiceOutputEnabled
              ? "border-brass bg-brass/15 text-brass-bright"
              : "border-ink-600 text-parchment-dim hover:border-brass-dim"
          }`}
        >
          {voiceOutputEnabled ? "🔊 Voice on" : "🔇 Voice off"}
        </button>
      </div>

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
                    onClick={cancel}
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

      {micError && (
        <p className="mb-2 text-xs text-warn">{micError}</p>
      )}

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
          placeholder={listening ? "Listening…" : "Ask about occupancy, payments, staff, shifts…"}
          className="flex-1 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
        />
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            title={listening ? "Stop listening" : "Speak your question"}
            className={`shrink-0 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              listening
                ? "border-danger bg-danger/15 text-danger"
                : "border-ink-600 text-parchment-dim hover:border-brass-dim hover:text-parchment"
            }`}
          >
            {listening ? "⏹" : "🎙️"}
          </button>
        )}
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
