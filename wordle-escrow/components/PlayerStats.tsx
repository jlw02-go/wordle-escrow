import React from 'react';
import { AllPlayerStats, PlayerStats as PlayerStatsType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PlayerStatsProps {
    stats: AllPlayerStats;
    players: string[];
}

const ScoreDistributionChart: React.FC<{ data: { name: string, value: number }[] }> = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: '#a0aec0' }} axisLine={{ stroke: '#4a5568' }} tickLine={{ stroke: '#4a5568' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#a0aec0' }} axisLine={{ stroke: '#4a5568' }} tickLine={{ stroke: '#4a5568' }} />
                <Tooltip cursor={{fill: '#4a5568'}} contentStyle={{backgroundColor: '#2d3748', border: '1px solid #4a5568'}} />
                <Bar dataKey="value">
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#538d4e' : '#3a3a3c'} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold">{value}</span>
    </div>
);

const PlayerStatsCard: React.FC<{ player: string; stats: PlayerStatsType }> = ({ player, stats }) => {
    const chartData = Object.entries(stats.scoreDistribution).map(([score, count]) => ({
        name: score,
        value: count,
    }));

    return (
        <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="font-bold text-xl mb-3">{player}</h3>
            <div className="space-y-2 mb-4">
                <StatItem label="Games Played" value={stats.gamesPlayed} />
                <StatItem label="Win %" value={`${stats.winPercentage}%`} />
                <StatItem label="Avg Score" value={stats.averageScore || 'N/A'} />
                <StatItem label="Current Streak" value={stats.currentStreak} />
                <StatItem label="Max Streak" value={stats.maxStreak} />
            </div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Guess Distribution</h4>
            <ScoreDistributionChart data={chartData} />
        </div>
    );
};

const PlayerStats: React.FC<PlayerStatsProps> = ({ stats, players }) => {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Player Statistics</h2>
      <div className="space-y-4">
        {players.map(player => (
            stats[player] && <PlayerStatsCard key={player} player={player} stats={stats[player]} />
        ))}
      </div>
    </div>
  );
};

export default PlayerStats;
