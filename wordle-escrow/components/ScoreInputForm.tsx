import React from 'react';
import { useParams } from 'react-router-dom';

import { Submission, DailySubmissions } from '../types';
import { parseWordleHeader, extractGrid } from '../utils/parsing';

// Firestore
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Current user (from dynamic join flow)
import { getDisplayName } from '../utils/currentUser';

interface ScoreInputFormProps {
  addSubmission: (submission: Submission) => void;
  todaysSubmissions: DailySubmissions;
  players: string[];
}

const ScoreInputForm: React.FC<ScoreInputFormProps> = ({
  addSubmission,
  todaysSubmissions,
  players,
}) => {
  const { groupId } = useParams();
  const currentUser = getDisplayName();

  const [player, setPlayer] = React.useState('');
  const [shareText, setShareText] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Preselect and lock to current user if they’re on the roster
  const isCurrentUserInRoster = React.useMemo(
    () => !!currentUser && players.includes(currentUser),
    [players, currentUser]
  );

  React.useEffect(() => {
    if (isCurrentUserInRoster) {
      setPlayer(currentUser);
    }
  }, [isCurrentUserInRoster, currentUser]);

  // Players who haven't submitted yet (based on your existing local state)
  const availablePlayers = React.useMemo(
    () => players.filter((p) => !todaysSubmissions[p]),
    [players, todaysSubmissions]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const chosen = (player || '').trim();
    const text = (shareText || '').trim();

    if (!chosen) {
      setError('Please select your name.');
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

    const { puzzleNumber, score } = headerData;
    const grid = extractGrid(lines);

    // YYYY-MM-DD in local (stable for your app’s date use)
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
      // Keep your existing local update to preserve current behavior
      addSubmission(submission);

      // Also persist to Firestore (single-player submission model)
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
      setPlayer(isCurrentUserInRoster ? currentUser : '');
      setShareText('');
    } catch (err: any) {
      console.error('Failed to save to Firestore:', err?.code, err?.message, err);
      setError('Saved locally, but could not save to the server. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled =
    submitting ||
    (isCurrentUserInRoster ? !!todaysSubmissions[currentUser] : availablePlayers.length === 0);

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Submit Today&apos;s Score</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="player-select"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Player
          </label>
          <select
            id="player-select"
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            disabled={isCurrentUserInRoster} // lock to current user if in roster
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green disabled:opacity-70"
          >
            {!isCurrentUserInRoster && (
              <option value="" disabled>
                Select your name
              </option>
            )}

            {isCurrentUserInRoster ? (
              <option value={currentUser}>{currentUser}</option>
            ) : (
              availablePlayers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))
            )}
          </select>
          {!isCurrentUserInRoster && players.length > 0 && availablePlayers.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Everyone has already submitted for today.
            </p>
          )}
        </div>

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
            ? 'All Scores Submitted!'
            : 'Submit Score'}
        </button>
      </form>
    </div>
  );
};

export default ScoreInputForm;
