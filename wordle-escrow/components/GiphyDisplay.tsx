// components/GiphyDisplay.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  url: string;
  title?: string;
  postedBy?: string;
  createdAt?: any;
};

type Props = {
  today: string;               // YYYY-MM-DD (from GroupPage)
  reveal: boolean;             // only allow posting/seeing after reveal
  currentUser?: string;        // optional, tags who posted
  autoClearOnPost?: boolean;   // default true
};

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";

const GiphyDisplay: React.FC<Props> = ({
  today,
  reveal,
  currentUser,
  autoClearOnPost = true,
}) => {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [gifs, setGifs] = useState<GifDoc[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  const [listenerError, setListenerError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Attach live listener with index fallback
  useEffect(() => {
    if (!db || !groupId || !today) return;

    setLoading(true);
    setListenerError(null);

    // helper to wire a listener from a built query
    const attach = (qRef: any) =>
      onSnapshot(
        qRef,
        (snap) => {
          const rows: GifDoc[] = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as GifDoc) }));
          setGifs(rows);
          setLoading(false);
        },
        (err) => {
          console.error("[GiphyDisplay] onSnapshot error:", err);
          setListenerError(err?.message || String(err));
          setLoading(false);
        }
      );

    // Try with orderBy first
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const qRef = query(
          collection(db, "gifs"),
          where("groupId", "==", groupId),
          where("date", "==", today),
          orderBy("createdAt", "asc")
        );
        unsub = attach(qRef);
      } catch (e: any) {
        // Some environments will throw at build time, but usually Firestore complains at runtime via callback.
        // As a second fallback, pull once without orderBy and then attach a listener without orderBy.
        console.warn("[GiphyDisplay] primary query failed, falling back w/o orderBy:", e);
        try {
          const fallbackQ = query(
            collection(db, "gifs"),
            where("groupId", "==", groupId),
            where("date", "==", today)
          );
          // Prime data once
          const snap = await getDocs(fallbackQ);
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as GifDoc) }));
          setGifs(rows);
          setLoading(false);
          // Attach listener without orderBy
          unsub = attach(fallbackQ);
        } catch (err2: any) {
          console.error("[GiphyDisplay] fallback query failed:", err2);
          setListenerError(err2?.message || String(err2));
          setLoading(false);
        }
      }
    })();

    return () => {
      try {
        if (unsub) unsub();
      } catch {}
    };
  }, [db, groupId, today]);

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
      setResults(Array.isArray(json?.data) ? json.data : []);
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
      setPostingId(gif?.id || "posting");

      // Optimistic add so user sees it right away
      const optimistic: GifDoc = {
        id: `optimistic-${Date.now()}`,
        groupId,
        date: today,
        url: best,
        title: gif?.title || "",
        postedBy: currentUser || "",
        createdAt: new Date().toISOString(),
      };
      setGifs((prev) => [...prev, optimistic]);

      await addDoc(collection(db, "gifs"), {
        groupId,
        date: today,
        url: best,
        title: gif?.title || "",
        postedBy: currentUser || "",
        createdAt: serverTimestamp(),
      } as GifDoc);

      setToast("GIF posted");
      setTimeout(() => setToast(""), 1800);

      // Scroll to feed
      requestAnimationFrame(() => {
        feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      if (autoClearOnPost) {
        setResults([]);
        setQ("");
      }
    } catch (err) {
      console.error("[GiphyDisplay] postGif error:", err);
      setToast("Could not post GIF");
      setTimeout(() => setToast(""), 2200);
      // remove the optimistic item if we added one
      setGifs((prev) => prev.filter((g) => !String(g.id).startsWith("optimistic-")));
    } finally {
      setPostingId(null);
    }
  };

  const header = useMemo(() => {
    if (!reveal) {
      return (
        <p className="text-sm text-gray-400">
          GIFs are hidden until both players submit or it’s 1:00 PM Central.
        </p>
      );
    }
    return (
      <p className="text-sm text-gray-400">
        Search GIPHY and click a result to add it to today’s feed.
      </p>
    );
  }, [reveal]);

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Today’s GIFs</h3>
        {toast && (
          <div className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-100">
            {toast}
          </div>
        )}
      </div>
      <div className="mt-1">{header}</div>

      {/* Optional listener warning */}
      {listenerError && (
        <p className="mt-2 text-xs text-yellow-400">
          Live feed fallback in use (no Firestore index). GIFs will still appear.
        </p>
      )}

      {/* Search UI */}
      <form onSubmit={doSearch} className="mt-3 flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search GIFs (e.g., victory, clutch, meltdown)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 disabled:opacity-60"
          disabled={!reveal}
        />
        <button
          type="submit"
          disabled={!reveal || searching || !q.trim()}
          className="bg-wordle-green text-white font-semibold px-4 rounded-md disabled:bg-gray-600"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        {results.length > 0 && (
          <button
            type="button"
            onClick={() => setResults([])}
            className="border border-gray-600 text-gray-300 px-3 rounded-md hover:bg-gray-800"
            title="Clear results"
          >
            Clear
          </button>
        )}
      </form>

      {/* Search results grid */}
      {reveal && results.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {results.map((g: any) => {
            const url =
              g?.images?.downsized_medium?.url ||
              g?.images?.downsized?.url ||
              g?.images?.original?.url;
            const isPosting = postingId === (g?.id || "posting");
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => postGif(g)}
                disabled={!!postingId}
                className={`relative border border-gray-700 rounded overflow-hidden hover:border-wordle-green ${
                  postingId ? "opacity-70 cursor-not-allowed" : ""
                }`}
                title="Add this GIF"
              >
                {url ? <img src={url} alt={g?.title || "GIF"} className="w-full h-auto" /> : null}
                {isPosting && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-xs text-white">
                    Posting…
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Today feed */}
      <div className="mt-4" ref={feedRef}>
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
