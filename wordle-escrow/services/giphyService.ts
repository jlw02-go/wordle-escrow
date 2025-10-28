export const getGiphyUrl = async (isWinner: boolean): Promise<string | null> => {
    try {
        const response = await fetch('/.netlify/functions/getGiphyUrl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isWinner }),
        });

        if (!response.ok) {
            console.error('Failed to fetch from Giphy function');
            return null;
        }

        const data = await response.json();
        return data.gifUrl;
    } catch (error) {
        console.error('Error calling Giphy function:', error);
        return null;
    }
};
