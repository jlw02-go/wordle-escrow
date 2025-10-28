import React, { useState, useMemo } from 'react';
import { AllSubmissions } from '../types';
import { calculateHeadToHeadStats } from '../utils/stats';

interface HeadToHeadStatsProps {
    allSubmissions: AllSubmissions;
    players: string[];
}

const HeadToHeadStats: React.FC<HeadToHeadStatsProps> = ({ allSubmissions, players }) => {
    const [player1, setPlayer1] = useState<string>('');
    const [player2, setPlayer2] = useState<string>('');

    const stats = useMemo(() => {
        if (player1 && player2 && player1 !== player2) {
            return calculateHeadToHeadStats(allSubmissions, player1, player2);
        }
        return null;
    }, [allSubmissions, player1, player2]);

    const StatCard: React.FC<{ label: string; p1Value: string | number; p2Value: string | number }> = ({ label, p1Value, p2Value }) => (
        <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-gray-400 text-sm mb-2">{label}</div>
            <div className="grid grid-cols-2 items-center">
                <div className="text-xl font-bold">{p1Value}</div>
                <div className="text-xl font-bold">{p2Value}</div>
            </div>
        </div>
    );

    return (
        <main className="max-w-4xl mx-auto">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-3xl font-bold mb-6 text-center">Head-to-Head Comparison</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center mb-8">
                    <select
                        value={player1}
                        onChange={(e) => setPlayer1(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
                    >
                        <option value="">Select Player 1</option>
                        {players.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="text-center font-bold text-gray-400 text-xl">VS</div>
                    <select
                        value={player2}
                        onChange={(e) => setPlayer2(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
                    >
                        <option value="">Select Player 2</option>
                        {players.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                {stats ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 text-center mb-4">
                            <h3 className="text-2xl font-semibold text-wordle-green">{stats.player1}</h3>
                            <h3 className="text-2xl font-semibold text-wordle-green">{stats.player2}</h3>
                        </div>
                        <StatCard label="Wins" p1Value={stats.player1Wins} p2Value={stats.player2Wins} />
                        <StatCard label="Average Score (on wins)" p1Value={stats.player1AverageScore || 'N/A'} p2Value={stats.player2AverageScore || 'N/A'} />
                        <div className="bg-gray-700 p-4 rounded-lg text-center">
                            <div className="text-gray-400 text-sm mb-1">Ties</div>
                            <div className="text-2xl font-bold">{stats.ties}</div>
                        </div>
                         <div className="bg-gray-700 p-4 rounded-lg text-center">
                            <div className="text-gray-400 text-sm mb-1">Total Games Played Together</div>
                            <div className="text-2xl font-bold">{stats.gamesPlayed}</div>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-gray-400">
                        {player1 && player2 && player1 === player2 ? 'Please select two different players.' : 'Select two players to see their head-to-head stats.'}
                    </p>
                )}
            </div>
        </main>
    );
};

export default HeadToHeadStats;
