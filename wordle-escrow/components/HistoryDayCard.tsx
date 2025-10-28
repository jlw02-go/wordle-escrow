import React, { useState } from 'react';
import { DailyData, Submission } from '../types';

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
              className={`w-6 h-6 sm:w-7 sm:h-7 ${parseSquare(char)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};


interface HistoryDayCardProps {
    date: string;
    dailyData: DailyData;
    players: string[];
}

const HistoryDayCard: React.FC<HistoryDayCardProps> = ({ date, dailyData, players }) => {
    const [isOpen, setIsOpen] = useState(false);

    const { submissions, aiSummary } = dailyData;
    const puzzleNumber = (Object.values(submissions) as Submission[])[0]?.puzzleNumber;

    const sortedPlayers = [...players].sort((a, b) => {
        const scoreA = submissions[a]?.score || Infinity;
        const scoreB = submissions[b]?.score || Infinity;
        if (scoreA === scoreB) {
            return a.localeCompare(b); // Alphabetical tie-breaker
        }
        return scoreA - scoreB;
    });

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gray-700 hover:bg-gray-600 p-4 text-left flex justify-between items-center transition-colors focus:outline-none"
                aria-expanded={isOpen}
            >
                <div>
                    <p className="font-bold text-xl">
                        {puzzleNumber ? `Wordle ${puzzleNumber}` : 'Game Results'}
                    </p>
                    <p className="text-gray-400">{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-6 w-6 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="p-4 md:p-6 space-y-6 bg-gray-800 border-t border-gray-700">
                    <div>
                        <h3 className="text-lg font-semibold mb-3 px-1">Scores</h3>
                        <div className="space-y-3">
                            {sortedPlayers.map(player => {
                                const submission = submissions[player];
                                return (
                                    <div key={player} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                                        <span className="font-semibold text-md">{player}</span>
                                        {submission ? (
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold text-lg">{submission.score > 6 ? 'X/6' : `${submission.score}/6`}</span>
                                                <WordleGrid grid={submission.grid} />
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 italic">No entry</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {aiSummary && (
                        <div>
                            <h3 className="text-lg font-semibold mb-3 px-1">AI Banter</h3>
                            <div className="bg-gray-700 p-4 rounded-md">
                                <p className="text-gray-300 whitespace-pre-wrap font-mono">{aiSummary}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HistoryDayCard;
