// src/components/TodayResults.tsx
import { useTodayResults } from "@/hooks/useTodayResults";

export default function TodayResults() {
  const { data, isLoading, error, day } = useTodayResults();

  if (isLoading) return <div>Loading Today’s Results…</div>;
  if (error) return <div role="alert">Couldn’t load results.</div>;

  const results = data ?? [];
  return (
    <section aria-labelledby="today-h">
      <h2 id="today-h" className="text-xl font-semibold">Today’s Results ({day})</h2>

      {results.length === 0 ? (
        <p>No results yet for today.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {results.map((r: any) => (
            <li key={r.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <strong>{r.playerA} vs {r.playerB}</strong>
                <span>{r.scoreA}–{r.scoreB}</span>
              </div>

              {r.gifUrl && (
                <figure className="mt-2">
                  <img src={r.gifUrl} alt={r.gifAlt ?? "Selected GIF"} className="max-h-64 w-auto" />
                </figure>
              )}

              <div className="mt-1 text-xs text-gray-500">
                Submitted {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
