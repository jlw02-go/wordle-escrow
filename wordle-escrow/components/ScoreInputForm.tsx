import React, { useState } from 'react';
import { Submission, DailySubmissions } from '../types';
import { parseWordleHeader, extractGrid } from '../utils/parsing';

// NEW: Firestore
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useParams } from 'react-router-dom';

interface ScoreInputFormProps {
  addSubmission: (submission: Submission) => void;
  todaysSubmissions: DailySubmissions;
  players: string[];
}

const ScoreInputForm: React.FC<ScoreInputFormProps> = ({ addSubmission, todaysSubmissions, players }) => {
  const { groupId } = useParams();
  const [player, setPlayer] = useState('');
  const [shareText, setShareText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availablePlayers = players.filter(p => !todaysSubmissions[p]);

  const parseAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!player) {
      setError('Please select your name.');
      return;
    }
    if (!shareText) {
      setError('Please paste your Wordle score.');
      return;
    }

    const lines = shareText.trim().split('\n');
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

    // YYYY-MM-DD in local time (stable for your app’s date use)
    const today = new Date(new Date().getTime() - (new Date().getTimezoneOffset()*60*1000)).toISOString().split('T')[0];

    const submission: Submission = {
      player,
      date: today,
      score,
      grid,
      puzzleNumber,
    };

    // Keep existing local update (so anything relying on it still works)
    addSubmission(submission);

    // ALSO write to Firestore as a single-player submission
    try {
      if (!db) throw new Error('Firestore not initialized');
      await addDoc(collection(db, 'submissions'), {
        groupId: groupId ?? 'default',
        player,
        date: today,
        score,
        grid,
        puzzleNumber,
        createdAt: serverTimestamp(),
        // room for future fields, e.g. gifUrl/gifAlt/gifProvider
      });
      setSuccess(`Thanks, ${player}! Your score has been submitted.`);
      setPlayer('');
      setShareText('');
    } catch (err: any) {
      console.error('Failed to save to Firestore:', err?.code, err?.message);
      setError('Saved locally, but could not save to the server. Please try again later.');
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Submit Today&apos;s Score</h2>
      <form onSubmit={parseAndSubmit} className="space-y-4">
        <div>
          <label htmlFor="player-select" className="block text-sm font-medium text-gray-300 mb-1">
            Player
          </label>
          <select
            id="player-select"
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
          >
            <option value="" disabled>Select your name</option>
            {availablePlayers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="share-text" className="block text-sm font-medium text-gray-300 mb-1">
            Paste Wordle Score
          </label>
          <textarea
            id="share-text"
            rows={6}
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            placeholder={`Wordle 1,114 4/6\n\n⬜🟨⬜⬜🟩\n⬜⬜🟨⬜🟩\n🟩🟩⬜⬜🟩\n🟩🟩🟩🟩🟩`}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green placeholder-gray-500"
          ></textarea>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button 
          type="submit"
          disabled={availablePlayers.length === 0}
          className="w-full bg-wordle-green text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {availablePlayers.length > 0 ? 'Submit Score' : 'All Scores Submitted!'}
        </button>
      </form>
    </div>
  );
};

export default ScoreInputForm;
