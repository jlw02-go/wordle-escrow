import React from 'react';
import { DailySubmissions, Submission } from '../types';

interface TodaysResultsProps {
  todaysSubmissions: DailySubmissions;
  allSubmitted: boolean;
  players: string[];
}

const WordleGrid: React.FC<{ grid: string }> = ({ grid }) => {
  const parseSquare = (char: string) => {
    switch (char) {
      case '🟩':
      case 'G':
        return 'bg-wordle-green';
      case '🟨':
      case 'Y':
        return 'bg-wordle-yellow';
      case '⬛':
      case '⬜':
      case 'W':
        return 'bg-wordle-gray';
      default:
        return 'bg-transparent';
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {grid.split('\n').map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 justify-center">
          {row.split('').map((char, charIndex) => (
            <div
              key={charIndex}
              className={`w-6 h-6 sm:w-8 sm:h-8 ${parseSquare(char)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

const TodaysResults: React.FC<TodaysResultsProps> = ({ todaysSubmissions, allSubmitted, players }) => {
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = todaysSubmissions[a]?.score || Infinity;
    const scoreB = todaysSubmissions[b]?.score || Infinity;
    return scoreA - scoreB;
  });

  const puzzleNumber = (Object.values(todaysSubmissions) as Submission[])[0]?.puzzleNumber;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">
        {`Today's Results${puzzleNumber ? ` - Wordle ${puzzleNumber}` : ''}`}
      </h2>
      {!allSubmitted && (
        <div className="text-center py-4">
          <p className="text-gray-400 italic">Scores are in escrow. Waiting for all players to submit...</p>
        </div>
      )}
      <div className="space-y-4">
        {sortedPlayers.map(player => {
          const submission = todaysSubmissions[player];
          return (
            <div key={player} className="flex items-center justify-between bg-gray-700 p-4 rounded-md">
              <span className="font-semibold text-lg">{player}</span>
              {submission ? (
                allSubmitted ? (
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-xl">{submission.score > 6 ? 'X/6' : `${submission.score}/6`}</span>
                    <WordleGrid grid={submission.grid} />
                  </div>
                ) : (
                  <span className="text-wordle-green flex items-center gap-2">
                    Submitted 
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )
              ) : (
                <span className="text-gray-500 italic">Waiting...</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodaysResults;
