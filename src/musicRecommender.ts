// --- API Keys ---
const geminiApiKey = "AIzaSyBvjsE7nitKmbjyGE69K3g_meK8Akonbyw";
const youtubeApiKey = "AIzaSyCjn0k2v7ZhSVd42rt-ADuAEgs_q6_bRSM";

// --- Helper Functions ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(payload: object) {
    let attempt = 0;
    const maxAttempts = 5;
    let delay = 1000;

    while (attempt < maxAttempts) {
        attempt++;
        try {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 503) throw new Error("Server is overloaded (503)");
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`Attempt ${attempt} failed: ${(error as Error).message}`);
            if (attempt >= maxAttempts) throw error;
            await sleep(delay);
            delay *= 2;
        }
    }
}

async function getGeminiSongSuggestions(prompt: string): Promise<string[]> {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const userLocation = "India"; 

    const enhancedPrompt = `
        You are an expert music recommender.
        Considering the current date is ${currentDate} and the user is in ${userLocation}, please fulfill the following request:
        "${prompt}"
        Include a mix of both popular international and Indian (including Bollywood) songs if relevant.
    `;

    const payload = {
        contents: [{
            parts: [{ text: `${enhancedPrompt} Respond with a numbered list. For each item, provide only the artist and song title in the format: Artist - Song Title.` }]
        }]
    };

    try {
        const data = await fetchWithRetry(payload);
        if (data && data.candidates && data.candidates.length > 0) {
            const text = data.candidates[0].content.parts[0].text.trim();
            const suggestions = text.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
            console.log("Context-Aware Gemini Suggestions:", suggestions);
            return suggestions;
        }
        return [];
    } catch (error) {
        console.error("Error fetching from Gemini API:", error);
        return [];
    }
}

async function searchSpotify(query: string, spotifyToken: string) {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
        headers: {
            Authorization: `Bearer ${spotifyToken}`,
        },
    });
    const data = await response.json();
    console.log(`Spotify results for "${query}":`, data.tracks.items);
    return data.tracks.items;
}

// --- NEW: Function to search YouTube ---
async function searchYouTube(query: string) {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=1&key=${youtubeApiKey}`);
    const data = await response.json();
    console.log(`YouTube results for "${query}":`, data.items);
    return data.items;
}

async function getUsersLikedSongs(spotifyToken: string): Promise<any[]> {
    console.log("Fetching user's liked songs as a fallback...");
    try {
        const response = await fetch(`https://api.spotify.com/v1/me/tracks?limit=20`, {
            headers: {
                Authorization: `Bearer ${spotifyToken}`,
            },
        });
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return data.items.map((item: any) => item.track);
        }
        return [];
    } catch (error) {
        console.error("Could not fetch liked songs:", error);
        return [];
    }
}

// --- Main Exported Function ---
export async function findSongForEmotion(prompt: string, spotifyToken: string | null): Promise<any | null> {
    console.log("Finding song for base prompt:", prompt);
    const songSuggestions = await getGeminiSongSuggestions(prompt);
    if (songSuggestions.length === 0) {
        console.log("AI could not suggest any songs.");
        // If AI fails and user is logged in, try liked songs immediately
        if (spotifyToken) {
            const likedSongs = await getUsersLikedSongs(spotifyToken);
            if (likedSongs.length > 0) {
                return { ...likedSongs[Math.floor(Math.random() * likedSongs.length)], source: 'spotify' };
            }
        }
        return null;
    }

    // If user is logged into Spotify, try that first
    if (spotifyToken) {
        for (const suggestion of songSuggestions) {
            const tracks = await searchSpotify(suggestion, spotifyToken);
            if (tracks.length > 0) {
                return { ...tracks[0], source: 'spotify' }; // Return with source
            }
        }
        // Fallback to liked songs if AI suggestions fail on Spotify
        const likedSongs = await getUsersLikedSongs(spotifyToken);
        if (likedSongs.length > 0) {
            return { ...likedSongs[Math.floor(Math.random() * likedSongs.length)], source: 'spotify' };
        }
    }

    // If Spotify fails or user is not logged in, search YouTube
    console.log("Searching YouTube for AI suggestions...");
    for (const suggestion of songSuggestions) {
        const videos = await searchYouTube(suggestion);
        if (videos.length > 0) {
            return { ...videos[0], source: 'youtube' }; // Return with source
        }
    }
    
    console.log("Could not find any songs on Spotify or YouTube.");
    return null;
}
