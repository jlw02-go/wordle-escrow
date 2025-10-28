// netlify/functions/getAiSummary.ts
import { GoogleGenAI } from "@google/genai";
import { Handler } from "@netlify/functions";

// This function runs on the server, so it can safely use process.env
const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not configured.");
}

const ai = new GoogleGenAI({ apiKey });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { submissions } = JSON.parse(event.body || '{}');
    if (!submissions) {
      return { statusCode: 400, body: 'Missing submissions data.' };
    }

    const scoresText = Object.values(submissions)
      .map((sub: any) => {
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
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ summary: response.text }),
    };
  } catch (error) {
    console.error("Error in getAiSummary function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate summary." }),
    };
  }
};

