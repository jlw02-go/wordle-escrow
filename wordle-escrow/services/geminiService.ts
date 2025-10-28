
import { GoogleGenAI } from "@google/genai";
import { DailySubmissions } from '../types';

export const getDailySummary = async (submissions: DailySubmissions): Promise<string> => {
    // Use Vite's method for accessing client-side environment variables.
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) {
        throw new Error("VITE_API_KEY is not configured.");
    }
    const ai = new GoogleGenAI({ apiKey });
    
    const scoresText = Object.values(submissions)
        .map(sub => {
            const scoreDisplay = sub.score > 6 ? 'X/6 (Failed)' : `${sub.score}/6`;
            return `${sub.player}: ${scoreDisplay}`;
        })
        .join(', ');

    const prompt = `
        You are a witty and slightly sarcastic sports commentator for the game of Wordle.
        Analyze the following daily Wordle scores from a group of friends and provide a short, funny summary (2-3 sentences).
        Feel free to gently roast the player with the worst score or praise the winner.
        
        Today's scores: ${scoresText}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get summary from Gemini API.");
    }
};
