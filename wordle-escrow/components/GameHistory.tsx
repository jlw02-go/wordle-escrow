import React, { useState, useMemo } from 'react';
import { AllSubmissions } from '../types';
import HistoryDayCard from './HistoryDayCard';

interface GameHistoryProps {
    allSubmissions: AllSubmissions;
    today: string;
    players: string[];
}

const GameHistory: React.FC<GameHistoryProps> = ({ allSubmissions, today, players }) => {
    const [filterDate, setFilterDate] = useState('');

    const pastDates = useMemo(() => Object.keys(allSubmissions)
        .filter(date => date !== today && Object.keys(allSubmissions[date].submissions).length > 0)
        .sort()
        .reverse(), [allSubmissions, today]);
        
    const filteredDates = useMemo(() => {
        if (!filterDate) {
            return pastDates;
        }
        return pastDates.filter(date => date === filterDate);
    }, [filterDate, pastDates]);

    return (
        <main className="max-w-4xl mx-auto">
            <header className="text-center mb-6">
                <h2 className="text-3xl font-bold">Game History</h2>
                <div className="mt-4 max-w-sm mx-auto flex items-center gap-2">
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
                    />
                    <button
                        onClick={() => setFilterDate('')}
                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        title="Clear filter"
                    >
                        Clear
                    </button>
                </div>
            </header>
            
            {filteredDates.length > 0 ? (
                <div className="space-y-6">
                    {filteredDates.map(date => (
                        <HistoryDayCard
                            key={date}
                            date={date}
                            dailyData={allSubmissions[date]}
                            players={players}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center bg-gray-800 p-8 rounded-lg">
                    <p className="text-gray-400">
                        {filterDate ? `No games found for ${new Date(filterDate + 'T00:00:00').toLocaleDateString()}.` : 'No past games found.'}
                    </p>
                    <p className="text-gray-500 mt-2">
                        {filterDate ? 'Try clearing the filter to see all history.' : 'Complete a day\'s game with your friends, and it will appear here.'}
                    </p>
                </div>
            )}
        </main>
    );
};

export default GameHistory;
