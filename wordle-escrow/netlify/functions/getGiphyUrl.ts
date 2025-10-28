// netlify/functions/getGiphyUrl.ts
import { Handler } from "@netlify/functions";

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const handler: Handler = async (event) => {
  if (!GIPHY_API_KEY) {
      console.error("GIPHY_API_KEY environment variable is not set.");
      return { statusCode: 500, body: JSON.stringify({ error: "Giphy API key not configured." }) };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { isWinner } = JSON.parse(event.body || '{}');

    const winTerms = ['wordle win', 'success', 'celebration', 'nailed it', 'genius'];
    const loseTerms = ['wordle fail', 'so close', 'disappointed', 'try again tomorrow'];
    
    const searchTerm = isWinner ? getRandomItem(winTerms) : getRandomItem(loseTerms);
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=25&offset=0&rating=g&lang=en`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Giphy API request failed with status ${response.status}`);
    }
    const data = await response.json();
    let gifUrl = null;
    if (data.data && data.data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.data.length);
        gifUrl = data.data[randomIndex].images.original.url;
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ gifUrl }),
    };
  } catch (error) {
      console.error('Error fetching from Giphy:', error);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch from Giphy." }) };
  }
};
