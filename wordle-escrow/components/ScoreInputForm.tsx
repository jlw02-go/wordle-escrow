// components/ScoreInputForm.tsx
import React from 'react';
import { useParams } from 'react-router-dom';

import { Submission, DailySubmissions } from '../types';
import { parseWordleHeader, extractGrid } from '../utils/parsing';

import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

import { getDisplayName, setDisplayName as saveDisplayName } from '../utils/currentUser';

interface ScoreInputFormProps {
  addSubmission: (submission: Submission) => void;
  todaysSubmissions: DailySubmissions;
  players: string[];
}

const DEFAULT_OPTIONS = ["Joe", "Pete"];
const OTHER_VALUE = "__OTHER__";

const ScoreInputForm: React.FC<ScoreInputFormProps> = ({
  addSubmission,
  todaysSubmissions,
  players,
}) => {
  const { groupId } = useParams();

  // Build dropdown list: always include Joe/Pete + unique players from props
  const dropdownPlayers = React.useMemo(() => {
    const set = new Set<string>(DEFAULT_OPTIONS);
    if (Array.isArray(players)) {
      for (const p of players) if (p) set.add(p);
    }
    return Array.from(set);
  }, [players]);

  // Preselect to current saved name if present, but DO NOT lock it
  const currentUser = getDisplayName();
  const initialSelection = React.useMemo(() => {
    if (currentUser && dropdownPlayers.includes(currentUser)) return currentUser;
    return "";
  }, [currentUser, dropdownPlayers]);

  const [player, setPlayer] = React.useState<string>(initialSelection);
  const [useOther, setUseOther] = React.useState(false);
  const [otherName, setOtherName] = React.useState("");
  const [shareText, setShareText] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    // If dropdown list updates and contains currentUser, select it (still editable)
    if (!player && currentUser && dropdownPlayers.includes(currentUser)) {
      setPlayer(currentUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropdownPlayers, currentUser]);

  const effectiveName = (useOther ? otherName : player).trim();
  const alreadySubmitted = effectiveName && (todaysSubmissions as any)?.[effectiveName];

  const onPlayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === OTHER_VALUE) {
      setUseOther(true);
      setPlayer("");
    } else {
      setUseOther(false);
      setOtherName("");
      setPlayer(val);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const chosen = (useOther ? otherName : player).trim();
    const text = (shareText || '').trim();

    if (!chosen) {
      setError(useOther ? 'Please enter your name.' : 'Please select your name.');
      return;
    }
    if (!text) {
      setError('Please paste your Wordle score.');
      return;
    }

    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setError('Invalid Wordle share format. Please paste the full text from the share button.');
      return;
    }

    const headerData = parseWordleHeader(lines[0]);
    if (!headerData) {
      setError('Could not parse Wordle score. Make sure it includes the header (e.g., "Wordle 123 4/6").');
      return;
    }

    if (alreadySubmitted) {
      setError('You already submitted today.');
      return;
    }

    const { puzzleNumber, score } = headerData;
    const grid = extractGrid(lines);

    const today = new Date(
      new Date().getTime() - new Date().getTimezoneOffset() * 60 * 1000
    )
      .toISOString()
      .split('T')[0];

    const submission: Submission = {
      player: chosen,
      date: today,
      score,
      grid,
      puzzleNumber,
    };

    setSubmitting(true);
    try {
      // If they typed a new name, add to roster + remember locally
      if (useOther && chosen && db && groupId) {
        const gref = doc(db, "groups", groupId);
        const snap = await getDoc(gref);
        if (snap.exists()) {
          await updateDoc(gref, { players: arrayUnion(chosen) });
        }
        saveDisplayName(chosen);
      }

      // Local update
      addSubmission(submission);

      // Persist to Firestore
      if (!db) throw new Error('Firestore not initialized');
      await addDoc(collection(db, 'submissions'), {
        groupId: groupId ?? 'default',
        player: chosen,
        date: today,
        score,
        grid,
        puzzleNumber,
        createdAt: serverTimestamp(),
      });

      setSuccess(`Thanks, ${chosen}! Your score has been submitted.`);
      // Keep their name selected for convenience
      if (!useOther) {
        setPlayer(chosen);
      } else {
        setPlayer(chosen);
        setUseOther(false);
        setOtherName("");
      }
      setShareText('');
    } catch (err: any) {
      console.error('Failed to save to Firestore:', err?.code, err?.message, err);
      setError('Saved locally, but could not save to the server. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || !effectiveName || !!alreadySubmitted;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Submit Today&apos;s Score</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Player select */}
        <div>
          <label
            htmlFor="player-select"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Player
          </label>

          <select
            id="player-select"
            value={useOther ? OTHER_VALUE : player}
            onChange={onPlayerChange}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
          >
            <option value="" disabled>Select your name</option>
            {dropdownPlayers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value={OTHER_VALUE}>Other… (add your name)</option>
          </select>

          {useOther && (
            <input
              type="text"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="Enter your name"
              className="mt-2 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
              maxLength={40}
            />
          )}

          {effectiveName && (todaysSubmissions as any)?.[effectiveName] && (
            <p className="mt-1 text-xs text-gray-400">
              {effectiveName} has already submitted today.
            </p>
          )}
        </div>

        {/* Wordle paste box */}
        <div>
          <label
            htmlFor="share-text"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Paste Wordle Score
          </label>
          <textarea
            id="share-text"
            rows={6}
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            placeholder={`Wordle 1,114 4/6

⬜🟨⬜⬜🟩
⬜⬜🟨⬜🟩
🟩🟩⬜⬜🟩
🟩🟩🟩🟩🟩`}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green placeholder-gray-500"
          ></textarea>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full bg-wordle-green text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {submitting
            ? 'Submitting…'
            : submitDisabled
            ? 'Already submitted'
            : 'Submit Score'}
        </button>
      </form>
    </div>
  );
};

export default ScoreInputForm;
