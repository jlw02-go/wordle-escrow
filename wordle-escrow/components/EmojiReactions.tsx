// components/EmojiReactions.tsx
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
} from "firebase/firestore";

type Props = {
  today: string;              // YYYY-MM-DD
  reveal: boolean;            // unlocked after both submit or 7:00 PM CT
  currentUser?: string;       // optional postedBy
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
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (!db || !groupId) return;
    setLoading(true);
    setUsingFallback(false);

    const baseCol = collection(db, "reactions");

    // Try indexed query first (groupId==, date==, orderBy createdAt asc)
    const qIndexed = query(
      baseCol,
      where("groupId", "==", groupId),
      where("date", "==", today),
      orderBy("createdAt", "asc")
    );

    // Primary listener
    const unsubPrimary = onSnapshot(
      qIndexed,
      (snap) => {
        const rows: Reaction[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Reaction) }));
        setReactions(rows);
        setLoading(false);
      },
      // If index is missing, switch to fallback live listener without orderBy
      (err) => {
        if (err?.code === "failed-precondition") {
          setUsingFallback(true);
          setLoading(true);
          const qFallback = query(
            baseCol,
            where("groupId", "==", groupId),
            where("date", "==", today)
          );
          const unsubFallback = onSnapshot(
            qFallback,
            (snap) => {
              const rows: Reaction[] = [];
              snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Reaction) }));
              // locally sort by createdAt seconds if present
              rows.sort((a, b) => (a?.createdAt?.seconds || 0) - (b?.createdAt?.seconds || 0));
              setReactions(rows);
              setLoading(false);
            },
            (e2) => {
              console.error("[EmojiReactions] fallback onSnapshot error:", e2);
              setLoading(false);
            }
          );
          // replace the primary unsub with the fallback unsub
          return unsubFallback;
        } else {
          console.error("[EmojiReactions] onSnapshot error:", err);
          setLoading(false);
        }
      }
    );

    return () => {
      try {
        unsubPrimary();
      } catch {
        // ignore
      }
    };
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
    if (!showIndexWarning || !usingFallback) return null;
    return (
      <div className="mb-2 text-xs text-amber-400">
        Live feed fallback in use (no Firestore index). Reactions will still appear.
      </div>
    );
  }, [showIndexWarning, usingFallback]);

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
