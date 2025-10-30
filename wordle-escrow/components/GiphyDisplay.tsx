// components/GiphyDisplay.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  getDocs,
} from "firebase/firestore";

type GifDoc = {
  id?: string;
  groupId: string;
  date: string;          // YYYY-MM-DD
  url: string;           // gif url
  title?: string;
  postedBy?: string;     // “Joe” / “Pete”
  createdAt?: any;
};

type Props = {
  today: string;               // YYYY-MM-DD
  reveal: boolean;             // only allow posting/seeing after reveal
  currentUser?: string;        // optional (for default)
  players: string[];           // roster for “Posting as” selector
};

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";

const GiphyDisplay: React.FC<Props> = ({ today, reveal, currentUser, players }) => {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [gifs, setGifs] = useState<GifDoc[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [listenerError, setListenerError] = useState<string | null>(null);

  // NEW: who is posting?
  const [poster, setPoster] = useState<string>("");

  useEffect(() => {
    // default to currentUser if it’s in the roster; else first player; else blank
    const choice =
      (currentUser && players.includes(currentUser) && currentUser) ||
      players[0] ||
      "";
    setPoster(choice);
  }, [currentUser, players]);

  // Live feed of today's GIFs (with index fallback)
  useEffect(() => {
    if (!db || !groupId) return;
    setLoading(true);
    setListenerError(null);

    let unsub: (() => void) | undefined;

    try {
      const qRef = query(
        collection(db, "gifs"),
        where("groupId", "==", groupId),
        where("date", "==", today),
        orderBy("createdAt", "asc")
      );

      unsub = onSnapshot(
        qRef,
        (snap) => {
          const rows: GifDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setGifs(rows);
          setLoading(false);
        },
        async (err) => {
          // likely index needed; fallback: no orderBy
          setListenerError(err?.message || "listener error");
          const noOrder = query(
            collection(db, "gifs"),
            where("groupId", "==", groupId),
            where("date", "==", today)
          );
          const snap = await getDocs(noOrder);
          const rows: GifDoc[] = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            // client sort by createdAt if present
            .sort((a, b) => {
              const at = (a.createdAt?.toMillis?.() ?? 0);
              const bt = (b.createdAt?.toMillis?.() ?? 0);
              return at - bt;
            });
          setGifs(rows);
          setLoading(false);
        }
      );
    } catch (e: any) {
      setListenerError(e?.message || String(e));
      setLoading(false);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [groupId, today]);

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || !GIPHY_KEY) return;
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
    } finally {
      setSearching(false);
    }
  };

  const postGif = async (gif: any) => {
    if (!db || !groupId || !reveal) return;
    const best =
      gif?.images?.downsized_medium?.url ||
      gif?.images?.downsized?.url ||
      gif?.images?.original?.url ||
      gif?.url;
    if (!best) return;

    try {
      await addDoc(collection(db, "gifs"), {
        groupId,
        date: today,
        url: best,
        title: gif?.title || "",
        postedBy: poster || "",                 // <-- use explicit poster
        createdAt: serverTimestamp(),
      } as GifDoc);

      // UX: collapse search results so it’s obvious something happened
      setResults([]);
      setQ("");
    } catch (err) {
      console.error("[GiphyDisplay] postGif error:", err);
    }
  };

  const header = useMemo(() => {
    if (!reveal) {
      return (
        <p className="text-sm text-gray-400">
          GIFs are hidden until both players submit or it’s 7:00 PM Central.
        </p>
      );
    }
    return (
      <p className="text-sm text-gray-400">
        Search GIPHY and click a result to add it to today’s feed.
      </p>
    );
  }, [reveal]);

  const disabled = !reveal;

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">Today’s GIFs</h3>
      {header}

      {/* Posting as selector */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-400">Posting as</span>
        <select
          value={poster}
          onChange={(e) => setPoster(e.target.value)}
          disabled={disabled}
          className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white disabled:opacity-60"
        >
          {players.map((p) => (
            <option key={`poster-${p}`} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Search UI (disabled if not revealed) */}
      <form onSubmit={doSearch} className="mt-3 flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search GIFs (e.g., victory, clutch, meltdown)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 disabled:opacity-60"
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || searching || !q.trim()}
          className="bg-wordle-green text-white font-semibold px-4 rounded-md disabled:bg-gray-600"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Search results grid */}
      {reveal && results.length > 0 && (
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
                title={`Post as ${poster || "?"}`}
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

        {/* Optional notice while index is missing */}
        {listenerError && (
          <p className="mt-2 text-xs text-yellow-400">
            Live feed fallback in use (no Firestore index). GIFs will still appear.
          </p>
        )}
      </div>
    </section>
  );
};

export default GiphyDisplay;
