export function ComingSoon({
  title,
  stage,
  description,
}: {
  title: string;
  stage: string;
  description: string;
}) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900 px-6 py-4">
        <h1 className="font-display text-lg font-semibold text-parchment">
          {title}
        </h1>
      </header>

      <div className="px-6 py-16">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-brass-dim bg-ink-800">
            <span className="font-display text-brass-bright">＋</span>
          </div>
          <h2 className="font-display text-lg font-semibold text-parchment">
            Not built yet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-parchment-dim">
            {description}
          </p>
          <p className="mt-4 inline-block rounded-full border border-ink-600 px-3 py-1 text-xs text-parchment-dim">
            Planned for {stage}
          </p>
        </div>
      </div>
    </main>
  );
}
