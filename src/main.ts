import './style.css';
import * as faceapi from 'face-api.js';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, Firestore } from "firebase/firestore";
import { findSongForEmotion } from './musicRecommender'; // <-- IMPORT OUR NEW MODULE

// --- API Keys and Configuration ---
const spotifyClientId = "7bee23d2ac4c43ffac4005b45f15cb50";
const spotifyClientSecret = "07c0797216b04eb0aef21504af1e8097";
const redirectUri = 'http://127.0.0.1:5173'; 

const firebaseConfig = {
  apiKey: "AIzaSyB-xjaUYsrNzP4VEYRAOiDXI6uuSSW6bv4",
  authDomain: "emo-music-e4276.firebaseapp.com",
  projectId: "emo-music-e4276",
  storageBucket: "emo-music-e4276.appspot.com",
  messagingSenderId: "871548316848",
  appId: "1:871548316848:web:bada37462a5c93fc241f75",
  measurementId: "G-WPEF2VP0W8"
};

// --- App HTML Structure ---
const appElement = document.getElementById('app')!;
appElement.innerHTML = `
  <!-- Loading Overlay -->
  <div id="loading-overlay" class="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 transition-opacity duration-500">
      <div class="loading-spinner mb-4"></div>
      <p id="loading-status" class="text-lg text-gray-300">Initializing...</p>
  </div>

  <!-- Main Content -->
  <div id="main-content" class="min-h-screen p-4 sm:p-8 opacity-0 transition-opacity duration-500">
      <header class="text-center mb-12">
          <h1 class="text-4xl md:text-5xl font-bold mb-2">MoodTunes</h1>
          <p class="text-lg text-gray-300">AI-powered music for your emotions</p>
      </header>

      <main class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <!-- Left Column: Camera and Controls -->
          <div class="space-y-8">
              <div class="glass-card rounded-2xl p-6">
                  <h2 class="text-2xl font-semibold mb-4">Camera Feed</h2>
                  <div class="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <video id="video" autoplay muted playsinline class="w-full h-full object-cover"></video>
                      <div id="camera-off-message" class="absolute inset-0 flex items-center justify-center text-gray-400">
                          Camera is off
                      </div>
                  </div>
              </div>
              <div class="glass-card rounded-2xl p-6 text-center">
                  <h2 class="text-2xl font-semibold mb-4">Controls</h2>
                  <div id="controls" class="flex flex-col sm:flex-row gap-4 justify-center">
                      <button id="spotify-connect-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300">
                          Connect to Spotify
                      </button>
                      <button id="start-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                          Start Detection
                      </button>
                      <button id="stop-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                          Stop Detection
                      </button>
                  </div>
              </div>
          </div>

          <!-- Right Column: Emotion and Music -->
          <div class="space-y-8">
              <div class="glass-card rounded-2xl p-6 min-h-[200px] flex flex-col items-center justify-center text-center">
                  <h2 class="text-2xl font-semibold mb-4">Detected Emotion</h2>
                  <div id="emotion-display">
                      <p class="text-gray-400">Connect to Spotify, then start detection.</p>
                  </div>
              </div>
              <div class="glass-card rounded-2xl p-6 min-h-[200px] flex flex-col items-center justify-center text-center">
                  <h2 class="text-2xl font-semibold mb-4">Music Recommendation</h2>
                  <div id="music-display">
                       <p class="text-gray-400">Music will appear here</p>
                  </div>
              </div>
          </div>
      </main>
  </div>

  <style>
      .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 251, 0.1);
      }
      .loading-spinner {
          width: 48px;
          height: 48px;
          border: 5px solid rgba(255, 255, 255, 0.3);
          border-bottom-color: #3b82f6;
          border-radius: 50%;
          display: inline-block;
          box-sizing: border-box;
          animation: rotation 1s linear infinite;
      }
      @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
      }
  </style>
`;

// --- App State and Elements ---
const video = document.getElementById('video') as HTMLVideoElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
const spotifyConnectBtn = document.getElementById('spotify-connect-btn') as HTMLButtonElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLDivElement;
const loadingStatus = document.getElementById('loading-status') as HTMLParagraphElement;
const mainContent = document.getElementById('main-content') as HTMLDivElement;
const emotionDisplay = document.getElementById('emotion-display') as HTMLDivElement;
const musicDisplay = document.getElementById('music-display') as HTMLDivElement;
const cameraOffMessage = document.getElementById('camera-off-message') as HTMLDivElement;

let isDetecting = false;
let detectionInterval: number;
let currentEmotion: string | null = null;
let spotifyToken: string | null = null;

// --- Emotion & Music Mapping ---
const emotionMap: { [key: string]: { emoji: string; color: string; prompt: string } } = {
  angry: { emoji: '😠', color: 'text-red-400', prompt: 'List 5 popular, high-energy songs from the last 20 years for someone feeling angry.' },
  disgusted: { emoji: '🤢', color: 'text-lime-400', prompt: 'List 5 classic, raw punk rock songs for a feeling of disgust.' },
  fearful: { emoji: '😨', color: 'text-purple-400', prompt: 'List 5 dark, atmospheric, and suspenseful ambient or cinematic songs for a fearful mood.' },
  happy: { emoji: '😊', color: 'text-yellow-400', prompt: 'List 5 iconic, universally happy pop songs from the 2010s.' },
  neutral: { emoji: '😐', color: 'text-gray-400', prompt: 'List 5 very famous, calming instrumental lofi or chillhop songs.' },
  sad: { emoji: '😢', color: 'text-blue-400', prompt: 'List 5 famous, melancholic, and emotional acoustic songs for a moment of sadness.' },
  surprised: { emoji: '😲', color: 'text-pink-400', prompt: 'List 5 exciting and uplifting electronic dance songs that feel like a pleasant surprise.' },
};

// --- Core Functions ---

/** Loads all the required face-api models. */
async function loadModels() {
  loadingStatus.textContent = 'Loading AI models...';
  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
  ]);
}

/** Starts the camera stream. */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
    cameraOffMessage.classList.add('hidden');
  } catch (err) {
    console.error("Camera Error:", err);
    emotionDisplay.innerHTML = `<p class="text-red-400">Could not access camera. Please check permissions.</p>`;
  }
}

/** Stops the camera stream. */
function stopCamera() {
  if (video.srcObject) {
    const stream = video.srcObject as MediaStream;
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    cameraOffMessage.classList.remove('hidden');
  }
}

/** Main detection loop. */
function startDetectionLoop(db: Firestore, userId: string) {
  isDetecting = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  emotionDisplay.innerHTML = `<p class="text-gray-400">Detecting...</p>`;

  detectionInterval = window.setInterval(async () => {
    if (!isDetecting || !video.srcObject) return;

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();

    if (detections) {
      const expressions = detections.expressions;
      const primaryEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);

      if (primaryEmotion !== currentEmotion) {
        currentEmotion = primaryEmotion;
        const emotionData = {
          emotion: currentEmotion,
          confidence: expressions[currentEmotion]
        };

        const { emoji, color, prompt } = emotionMap[currentEmotion] || emotionMap.neutral;
        emotionDisplay.innerHTML = `
            <div class="text-7xl mb-2">${emoji}</div>
            <p class="text-3xl font-bold capitalize ${color}">${currentEmotion}</p>
            <p class="text-sm text-gray-300">Confidence: ${(emotionData.confidence * 100).toFixed(1)}%</p>
        `;
        
        getSongForEmotion(prompt);
        saveEmotionToFirebase(db, userId, emotionData);
      }
    }
  }, 3000);
}

/** Stops the detection loop. */
function stopDetectionLoop() {
  isDetecting = false;
  clearInterval(detectionInterval);
  currentEmotion = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  emotionDisplay.innerHTML = `<p class="text-gray-400">Detection stopped.</p>`;
  musicDisplay.innerHTML = `<p class="text-gray-400">Music recommendations paused.</p>`;
}

/** Saves the detected emotion session to Firestore. */
async function saveEmotionToFirebase(db: Firestore, userId: string, emotion: { emotion: string; confidence: number }) {
  if (!userId || !db) return;
  try {
    await addDoc(collection(db, 'sessions'), {
      userId: userId,
      emotion: emotion.emotion,
      confidence: emotion.confidence,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving session to Firebase:", error);
  }
}

// --- Spotify Integration ---

/** Redirects user to Spotify for login */
function redirectToSpotifyLogin() {
    // **NEW:** Added 'user-library-read' to the scope to access liked songs
    const scope = 'user-read-private user-read-email user-library-read';
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(16));
    const randomString = randomValues.reduce((acc, x) => acc + possible[x % possible.length], "");
    
    window.localStorage.setItem('spotify_auth_state', randomString);

    const params = {
        response_type: 'code',
        client_id: spotifyClientId,
        scope,
        redirect_uri: redirectUri,
        state: randomString
    };
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
}

/** Fetches an access token from Spotify using the authorization code */
async function getAccessToken(code: string) {
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(spotifyClientId + ":" + spotifyClientSecret),
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectUri,
        }),
    });
    const data = await response.json();
    return data.access_token;
}

/** Gets a song by calling our new recommender module */
async function getSongForEmotion(prompt: string) {
    if (!spotifyToken) return;
    musicDisplay.innerHTML = `<p class="text-gray-400">Asking AI for songs...</p>`;

    const foundTrack = await findSongForEmotion(prompt, spotifyToken);
    
    if (foundTrack) {
        displaySong(foundTrack);
    } else {
        musicDisplay.innerHTML = `<p class="text-gray-400">Could not find a song. Please try again.</p>`;
    }
}

/** Displays the song info and a link to listen on Spotify */
function displaySong(track: any) {
    musicDisplay.innerHTML = `
        <img src="${track.album.images[0].url}" alt="${track.name}" class="w-32 h-32 rounded-lg mx-auto mb-4 shadow-lg">
        <p class="font-bold text-lg">${track.name}</p>
        <p class="text-gray-300 mb-4">${track.artists[0].name}</p>
        <a href="${track.external_urls.spotify}" target="_blank" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg inline-block transition duration-300">
            Listen on Spotify
        </a>
    `;
}


// --- Main Initialization Sequence ---
async function main() {
  try {
    loadingStatus.textContent = 'Connecting to server...';
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;

    // Handle Spotify Login Redirect
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        spotifyToken = await getAccessToken(code);
        window.history.replaceState({}, '', redirectUri);
    }
    
    if (user) {
      await loadModels();

      if (spotifyToken) {
          spotifyConnectBtn.textContent = "Spotify Connected";
          spotifyConnectBtn.classList.replace("bg-green-600", "bg-gray-500");
          spotifyConnectBtn.disabled = true;
          startBtn.disabled = false;
      } else {
          spotifyConnectBtn.addEventListener('click', redirectToSpotifyLogin);
      }
      
      startBtn.addEventListener('click', () => {
        startCamera();
        startDetectionLoop(db, user.uid);
      });

      stopBtn.addEventListener('click', () => {
        stopDetectionLoop();
        stopCamera();
      });

      loadingOverlay.classList.add('opacity-0');
      setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
      mainContent.classList.remove('opacity-0');
    } else {
      throw new Error("Anonymous authentication failed.");
    }

  } catch (error) {
    const err = error as Error;
    loadingStatus.textContent = `Initialization Failed: ${err.message}`;
    console.error("Initialization Failed:", error);
  }
}

// Run the app
main();
