import React, { useState, useEffect } from 'react';
import { DailySubmissions } from '../types';
import { getGiphyUrl } from '../services/giphyService';

interface GiphyDisplayProps {
    todaysSubmissions: DailySubmissions;
}

const GiphyDisplay: React.FC<GiphyDisplayProps> = ({ todaysSubmissions }) => {
    const [gifUrl, setGifUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchGif = async () => {
            setIsLoading(true);
            const scores = Object.values(todaysSubmissions).map(s => s.score);
            if (scores.length === 0) {
                 setIsLoading(false);
                 return;
            };
            
            const minScore = Math.min(...scores);
            const isWinner = minScore <= 6; // Check if there was at least one win

            const url = await getGiphyUrl(isWinner);
            setGifUrl(url);
            setIsLoading(false);
        };

        // Only fetch when there are submissions
        if (Object.keys(todaysSubmissions).length > 0) {
            fetchGif();
        } else {
            setIsLoading(false);
        }
    }, [todaysSubmissions]);

    if (isLoading) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                 <div className="flex justify-center items-center">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-3">Summoning a celebratory GIF...</span>
                </div>
            </div>
        );
    }
    
    if (!gifUrl) {
         // Silently fail if no Giphy key or API error
        return null;
    }

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">End of Day Reaction</h2>
            <div className="flex justify-center">
                 <img src={gifUrl} alt="Giphy reaction" className="rounded-md max-h-64 object-contain" />
            </div>
        </div>
    );
};

export default GiphyDisplay;
