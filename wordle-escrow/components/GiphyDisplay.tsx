// components/GiphyDisplay.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

type GifDoc = {
  id?: string;
  groupId: string;
  date: string; // YYYY-MM-DD
  url: string;
  title?: string;
  postedBy?: string;
  createdAt?: any;
};

type Props = {
  today: string; // YYYY-MM-DD
  reveal: boolean; // allow posting/seeing only after reveal
  currentUser?: string; // optional for “posted by”
};

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";

const GiphyDisplay: React.FC<Props> = ({ today, reveal, currentUser }) => {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [gifs, setGifs] = useState<GifDoc[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !reveal;

  // ---- STEP 1: live listener without orderBy (no index required)
  useEffect(() => {
    if (!db || !groupId) return;
    setLoading(true);
    setError(null);

    const qRef = query(
      collection(db, "gifs"),
      where("groupId", "==", groupId),
      where("date", "==", today)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: GifDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as GifDoc) }));
        // client-side sort by createdAt if present
        rows.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });
        setGifs(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[GiphyDisplay] onSnapshot error:", err);
        setError("Could not load GIFs.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [groupId, today]);

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!q.trim()) return;
    if (!GIPHY_KEY) {
      setError("Missing VITE_GIPHY_API_KEY.");
      return;
    }
    try {
      setSearching(true);
      const endpoint = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
        GIPHY_KEY
      )}&q=${encodeURIComponent(q.trim())}&limit=12&rating=pg-13`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Giphy HTTP ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      setResults(items);
    } catch (err) {
      console.error("[GiphyDisplay] search error:", err);
      setResults([]);
      setError("Giphy search failed.");
    } finally {
      setSearching(false);
    }
  };

  const postGif = async (gif: any) => {
    setError(null);
    if (!db || !groupId) {
      setError("Firestore not initialized.");
      return;
    }
    if (!reveal) {
      setError("GIFs are disabled until reveal.");
      return;
    }
    const best =
      gif?.images?.downsized_medium?.url ||
      gif?.images?.downsized?.url ||
      gif?.images?.original?.url ||
      gif?.url;
    if (!best) {
      setError("Could not resolve GIF URL.");
      return;
    }

    // Optimistic UI: show it immediately
    const tempId = `temp-${Date.now()}`;
    const optimistic: GifDoc = {
      id: tempId,
      groupId,
      date: today,
      url: best,
      title: gif?.title || "",
      postedBy: currentUser || "",
      createdAt: { toMillis: () => Date.now() },
    };
    setGifs((prev) => [...prev, optimistic]);

    try {
      const ref = await addDoc(collection(db, "gifs"), {
        groupId,
        date: today,
        url: best,
        title: gif?.title || "",
        postedBy: currentUser || "",
        createdAt: serverTimestamp(),
      } as GifDoc);

      // Replace optimistic entry with real doc
      setGifs((prev) =>
        prev.map((g) => (g.id === tempId ? { ...optimistic, id: ref.id } : g))
      );
    } catch (err) {
      console.error("[GiphyDisplay] postGif error:", err);
      setError("Failed to post GIF (check Firestore rules or quota).");
      setGifs((prev) => prev.filter((g) => g.id !== tempId));
    }
  };

  const banner = useMemo(() => {
    if (!reveal) {
      return "GIFs are hidden until both players submit or it’s 1:00 PM Central.";
    }
    if (!GIPHY_KEY) {
      return "Missing VITE_GIPHY_API_KEY — set it in Netlify env to enable GIF search.";
    }
    return "Search GIPHY and click a result to add it to today’s feed.";
  }, [reveal]);

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">Today’s GIFs</h3>
      <p className="text-sm text-gray-400">{banner}</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {/* Search UI */}
      <form onSubmit={doSearch} className="mt-3 flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search GIFs (e.g., victory, clutch, meltdown)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 disabled:opacity-60"
          disabled={!reveal || !GIPHY_KEY}
        />
        <button
          type="submit"
          disabled={!reveal || !GIPHY_KEY || searching || !q.trim()}
          className="bg-wordle-green text-white font-semibold px-4 rounded-md disabled:bg-gray-600"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Search results */}
      {reveal && GIPHY_KEY && results.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {results.map((g: any) => {
            const url =
              g?.images?.downsized_medium?.url ||
              g?.images?.downsized?.url ||
              g?.images?.original?.url;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => postGif(g)}
                className="border border-gray-700 rounded overflow-hidden hover:border-wordle-green"
                title="Add this GIF"
              >
                {url ? <img src={url} alt={g?.title || "GIF"} className="w-full h-auto" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Today feed */}
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading GIFs…</p>
        ) : gifs.length === 0 ? (
          <p className="text-sm text-gray-500">No GIFs yet today.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gifs.map((g) => (
              <figure key={g.id} className="rounded border border-gray-700 p-2 bg-gray-800/40">
                <img src={g.url} alt={g.title || "GIF"} className="w-full h-auto rounded" />
                {(g.title || g.postedBy) && (
                  <figcaption className="mt-1 text-xs text-gray-400">
                    {g.title ? <span className="italic">{g.title}</span> : null}
                    {g.title && g.postedBy ? " — " : ""}
                    {g.postedBy ? <span>by {g.postedBy}</span> : null}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default GiphyDisplay;
