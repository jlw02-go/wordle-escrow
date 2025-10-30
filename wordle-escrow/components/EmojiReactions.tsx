// components/EmojiReactions.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

type Props = {
  today: string;             // YYYY-MM-DD
  reveal: boolean;           // after both submitted OR 7pm CT
  currentUser?: string;      // optional "postedBy"
  showIndexWarning?: boolean; // default false
};

type Reaction = {
  id?: string;
  groupId: string;
  date: string;
  emoji: string;
  postedBy?: string;
  createdAt?: any;
};

const EMOJI_CHOICES = ["🎉", "🔥", "👏", "💀", "😅", "🤯", "🤝", "🍀", "🧠", "🏆"];

const EmojiReactions: React.FC<Props> = ({
  today,
  reveal,
  currentUser,
  showIndexWarning = false,
}) => {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!db || !groupId) return;
    setLoading(true);
    setFallback(false);

    const base = collection(db, "reactions");

    // Prefer indexed query (groupId + date + orderBy createdAt)
    const tryIndexed = query(
      base,
      where("groupId", "==", groupId),
      where("date", "==", today),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      tryIndexed,
      (snap) => {
        const rows: Reaction[] = [];
        snap.forEach((d) => {
          rows.push({ id: d.id, ...(d.data() as Reaction) });
        });
        setReactions(Array.isArray(rows) ? rows : []);
        setLoading(false);
      },
      async (err) => {
        console.warn("[EmojiReactions] indexed query failed; fallback:", err?.code || err);
        setFallback(true);
        // Fallback: no orderBy (no index)
        const plain = query(base, where("groupId", "==", groupId), where("date", "==", today));
        const s2 = await getDocs(plain);
        const rows: Reaction[] = [];
        s2.forEach((d) => {
          rows.push({ id: d.id, ...(d.data() as Reaction) });
        });
        rows.sort((a, b) => {
          const ta = a?.createdAt?.seconds || 0;
          const tb = b?.createdAt?.seconds || 0;
          return ta - tb;
        });
        setReactions(Array.isArray(rows) ? rows : []);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [groupId, today]);

  const post = async (emoji: string) => {
    if (!db || !groupId || !reveal) return;
    try {
      await addDoc(collection(db, "reactions"), {
        groupId,
        date: today,
        emoji,
        postedBy: currentUser || "",
        createdAt: serverTimestamp(),
      } as Reaction);
    } catch (e) {
      console.error("[EmojiReactions] post error:", e);
    }
  };

  const banner = useMemo(() => {
    if (!showIndexWarning) return null;
    if (!fallback) return null;
    return (
      <div className="mb-2 text-xs text-amber-400">
        Live feed fallback in use (no Firestore index). Reactions will still appear.
      </div>
    );
  }, [fallback, showIndexWarning]);

  if (!reveal) {
    return (
      <section className="rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-2">Reactions</h3>
        <p className="text-sm text-gray-400">
          Reactions unlock after both players submit or at 7:00 PM Central.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-2">Reactions</h3>
      {banner}
      <div className="flex flex-wrap gap-2">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => post(e)}
            className="px-3 py-2 rounded bg-gray-800 border border-gray-700 hover:border-wordle-green"
            title="Add reaction"
          >
            <span className="text-xl">{e}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading reactions…</p>
        ) : reactions.length === 0 ? (
          <p className="text-sm text-gray-500">No reactions yet.</p>
        ) : (
          <ul className="space-y-1">
            {reactions.map((r) => (
              <li key={r.id} className="text-sm text-gray-300">
                <span className="mr-2">{r.emoji}</span>
                {r.postedBy ? <span className="text-gray-500">by {r.postedBy}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default EmojiReactions;
