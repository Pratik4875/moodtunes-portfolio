// --- API Keys ---
const geminiApiKey = "AIzaSyBvjsE7nitKmbjyGE69K3g_meK8Akonbyw";

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

// --- NEW: Function to get a structured JSON response from Gemini ---
async function getGeminiSongSuggestions(prompt: string): Promise<{ artist: string, songTitle: string }[]> {
    if (geminiApiKey === "AIzaSyBvjsE7nitKmbjyGE69K3g_meK8Akonbyw") {
        console.error("Gemini API key not set.");
        return [];
    }

    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const userLocation = "India";

    const enhancedPrompt = `
        You are an expert music recommender.
        Considering the current date is ${currentDate} and the user is in ${userLocation}, please fulfill the following request:
        "${prompt}"
        Include a mix of both popular international and Indian (including Bollywood) songs if relevant.
    `;

    const payload = {
        contents: [{ parts: [{ text: enhancedPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "songs": {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "artist": { "type": "STRING" },
                                "songTitle": { "type": "STRING" }
                            },
                            required: ["artist", "songTitle"]
                        }
                    }
                }
            }
        }
    };

    try {
        const data = await fetchWithRetry(payload);
        if (data && data.candidates && data.candidates.length > 0) {
            const jsonText = data.candidates[0].content.parts[0].text;
            const suggestions = JSON.parse(jsonText).songs;
            console.log("Structured Gemini Suggestions:", suggestions);
            return suggestions || [];
        }
        return [];
    } catch (error) {
        console.error("Error fetching structured JSON from Gemini API:", error);
        return [];
    }
}

async function searchSpotify(artist: string, songTitle: string, spotifyToken: string) {
    // Use Spotify's advanced search syntax for better accuracy
    const query = `track:${songTitle} artist:${artist}`;
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
        headers: {
            Authorization: `Bearer ${spotifyToken}`,
        },
    });
    const data = await response.json();
    console.log(`Spotify results for "${query}":`, data.tracks.items);
    return data.tracks.items;
}

// --- NEW: Function to get the user's liked songs ---
async function getUsersLikedSongs(spotifyToken: string): Promise<any[]> {
    console.log("Fetching user's liked songs as a fallback...");
    try {
        const response = await fetch(`https://api.spotify.com/v1/me/tracks?limit=20`, { // Get up to 20 recent songs
            headers: {
                Authorization: `Bearer ${spotifyToken}`,
            },
        });
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            console.log("Found liked songs:", data.items.map((item: any) => item.track.name));
            return data.items.map((item: any) => item.track);
        }
        return [];
    } catch (error) {
        console.error("Could not fetch liked songs:", error);
        return [];
    }
}

// --- Main Exported Function ---
export async function findSongForEmotion(prompt: string, spotifyToken: string): Promise<any | null> {
    console.log("Finding song for base prompt:", prompt);
    const songSuggestions = await getGeminiSongSuggestions(prompt);
    
    if (songSuggestions && songSuggestions.length > 0) {
        for (const suggestion of songSuggestions) {
            console.log("Searching Spotify for:", suggestion);
            const tracks = await searchSpotify(suggestion.artist, suggestion.songTitle, spotifyToken);
            if (tracks.length > 0) {
                return tracks[0]; // Return the first successful match
            }
        }
    }
    
    // --- Final fallback to the user's library ---
    console.log("Could not find any of the AI's suggestions on Spotify. Trying user's liked songs.");
    const likedSongs = await getUsersLikedSongs(spotifyToken);
    if (likedSongs.length > 0) {
        // Shuffle and pick a random song from the liked songs
        const randomSong = likedSongs[Math.floor(Math.random() * likedSongs.length)];
        return randomSong;
    }

    return null; // Return null only if everything fails
}
