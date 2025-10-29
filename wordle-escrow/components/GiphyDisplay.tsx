// components/GiphyDisplay.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const TZ = "America/Chicago";
function todayISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

type Props = {
  todaysSubmissions?: Record<string, any>; // kept for compatibility
};

type SavedGif = { url: string; alt?: string };

export default function GiphyDisplay(_: Props) {
  const { groupId } = useParams();
  const day = todayISO();
  const [query, setQuery] = useState("celebration");
  const [results, setResults] = useState<{ id: string; url: string; alt: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedGif | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved gif (if any)
  useEffect(() => {
    if (!db || !groupId) return;
    (async () => {
      try {
        const r = await getDoc(doc(db, "dayGifs", `${groupId}_${day}`));
        if (r.exists()) setSaved(r.data() as SavedGif);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [groupId, day]);

  async function searchGiphy(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setResults([]);

    const key = import.meta.env.VITE_GIPHY_API_KEY;
    if (!key) {
      setError("Missing VITE_GIPHY_API_KEY.");
      return;
    }
    try {
      const resp = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(
          query
        )}&limit=12&rating=pg-13`
      );
      const json = await resp.json();
      const items = (json?.data || []).map((d: any) => ({
        id: d.id,
        url: d.images?.downsized_large?.url || d.images?.original?.url,
        alt: d.title || "GIF",
      })).filter((x: any) => !!x.url);
      setResults(items);
    } catch (e: any) {
      console.error(e);
      setError("GIF search failed.");
    }
  }

  async function choose(url: string, alt?: string) {
    if (!db || !groupId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "dayGifs", `${groupId}_${day}`), { url, alt: alt || "Selected GIF" });
      setSaved({ url, alt });
      setResults([]);
    } catch (e) {
      console.error(e);
      setError("Could not save GIF.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="gif-h" className="rounded-lg border p-4">
      <h3 id="gif-h" className="text-lg font-semibold mb-3">Pick a victory GIF</h3>

      {saved ? (
        <figure>
          <img src={saved.url} alt={saved.alt || "Selected GIF"} className="max-h-64 w-auto rounded" />
          <figcaption className="mt-2 text-xs text-gray-500">Saved for {day}</figcaption>
        </figure>
      ) : (
        <>
          <form onSubmit={searchGiphy} className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 rounded border px-3 py-2 bg-gray-800 text-white"
              placeholder="Search GIPHY (e.g., celebration, victory, winner)"
            />
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">Search</button>
          </form>

          {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => choose(r.url, r.alt)}
                className="block overflow-hidden rounded border hover:ring-2 focus:outline-none"
                disabled={saving}
                title="Use this GIF"
              >
                <img src={r.url} alt={r.alt} className="w-full h-32 object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
