export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1
        className="font-display text-ink"
        style={{ fontSize: 44, lineHeight: "48px", fontWeight: 600, letterSpacing: "-0.025em" }}
      >
        Rekrutly
      </h1>
      <p className="text-ink-2" style={{ fontSize: 13, lineHeight: "18px" }}>
        Foundation ready.
      </p>
    </main>
  );
}
