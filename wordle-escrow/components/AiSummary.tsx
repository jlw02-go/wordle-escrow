import React, { useState, useCallback, useEffect } from 'react';
import { DailySubmissions } from '../types';
import { getDailySummary } from '../services/geminiService';

interface AiSummaryProps {
    todaysSubmissions: DailySubmissions;
    saveAiSummary: (date: string, summary: string) => void;
    today: string;
    existingSummary?: string;
}

const AiSummary: React.FC<AiSummaryProps> = ({ todaysSubmissions, saveAiSummary, today, existingSummary }) => {
    const [summary, setSummary] = useState<string>(existingSummary || '');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (existingSummary) {
            setSummary(existingSummary);
        }
    }, [existingSummary]);

    const generateSummary = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setSummary('');
        try {
            const result = await getDailySummary(todaysSubmissions);
            setSummary(result);
            saveAiSummary(today, result);
        } catch (err) {
            setError('Failed to generate summary. The AI might be stumped!');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [todaysSubmissions, saveAiSummary, today]);

    const hasSummary = !!summary;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Daily AI Banter</h2>
                {!hasSummary && (
                    <button
                        onClick={generateSummary}
                        disabled={isLoading}
                        className="bg-wordle-yellow text-wordle-dark font-bold py-2 px-4 rounded-md hover:bg-yellow-500 transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Thinking...
                            </>
                        ) : 'Generate'}
                    </button>
                )}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {summary && (
                <div className="bg-gray-700 p-4 rounded-md">
                    <p className="text-gray-300 whitespace-pre-wrap font-mono">{summary}</p>
                </div>
            )}
            {!summary && !isLoading && !error && (
                <p className="text-gray-400 italic">Click "Generate" to get a witty summary of today's game from our resident AI.</p>
            )}
        </div>
    );
};

export default AiSummary;