import { DailySubmissions } from '../types';

export const getDailySummary = async (submissions: DailySubmissions): Promise<string> => {
    try {
        const response = await fetch('/.netlify/functions/getAiSummary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ submissions }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch summary from the server.');
        }

        const data = await response.json();
        return data.summary;
    } catch (error) {
        console.error("Error calling getAiSummary function:", error);
        throw new Error("Failed to get summary from server.");
    }
};
