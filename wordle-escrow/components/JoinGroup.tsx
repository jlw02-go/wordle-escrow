// src/components/JoinGroup.tsx
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { getDisplayName, setDisplayName } from "../utils/currentUser";

type Props = {
  maxPlayers?: number; // default 10
};

export default function JoinGroup({ maxPlayers = 10 }: Props) {
  const { groupId } = useParams();
  const [name, setName] = useState(getDisplayName());
  const [status, setStatus] = useState<string>("");

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const n = name.trim();
    if (!n) {
      setStatus("Please enter a name.");
      return;
    }
    if (!db || !groupId) {
      setStatus("Problem connecting. Try again.");
      return;
    }

    const gref = doc(db, "groups", groupId);
    const snap = await getDoc(gref);

    if (!snap.exists()) {
      // Create the group with the first player
      await setDoc(gref, { name: groupId, players: [n] });
    } else {
      const data = snap.data() as any;
      const players: string[] = Array.isArray(data.players) ? data.players : [];
      if (players.length >= maxPlayers && !players.includes(n)) {
        setStatus(`This group already has ${players.length}/${maxPlayers} players.`);
        return;
      }
      // arrayUnion avoids duplicates automatically (exact string match)
      await updateDoc(gref, { players: arrayUnion(n) });
    }

    setDisplayName(n);
    setStatus("Joined! You can submit your score now.");
    // Optional: reload to let any parent hooks refetch
    setTimeout(() => window.location.reload(), 500);
  }

  return (
    <form onSubmit={onJoin} className="rounded-lg border p-4 max-w-md">
      <h2 className="text-xl font-semibold mb-2">Join this group</h2>
      <p className="text-sm text-gray-600 mb-3">Enter the display name you want others to see.</p>
      <input
        type="text"
        className="w-full rounded border px-3 py-2 mb-3"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
      />
      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
        Join group
      </button>
      {status && <div className="mt-2 text-sm">{status}</div>}
    </form>
  );
}
