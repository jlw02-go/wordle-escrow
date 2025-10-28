// IMPORTANT: To enable Giphy integration, the GIPHY_API_KEY environment variable must be set.
// This is configured in the environment settings, similar to the Gemini API key.
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const getGiphyUrl = async (isWinner: boolean): Promise<string | null> => {
    if (!GIPHY_API_KEY || GIPHY_API_KEY === "your_key_here") {
        console.error("GIPHY_API_KEY environment variable is not set.");
        return null;
    }

    const winTerms = ['wordle win', 'success', 'celebration', 'nailed it', 'genius'];
    const loseTerms = ['wordle fail', 'so close', 'disappointed', 'try again tomorrow'];
    
    const searchTerm = isWinner ? getRandomItem(winTerms) : getRandomItem(loseTerms);
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=25&offset=0&rating=g&lang=en`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Giphy API request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.data.length);
            return data.data[randomIndex].images.original.url;
        }
        return null;
    } catch (error) {
        console.error('Error fetching from Giphy:', error);
        return null;
    }
};