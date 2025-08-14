import './style.css';
import * as THREE from 'three';
import * as faceapi from 'face-api.js';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, Firestore } from "firebase/firestore";
import { findSongForEmotion } from './musicRecommender';

// --- Page Content Templates ---
const pages = {
    home: `
        <div class="flex flex-col items-center justify-center text-center min-h-[80vh]">
            <h1 class="text-5xl md:text-7xl font-extrabold mb-4 animated-gradient-text">MoodTunes</h1>
            <p class="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8">
                An intelligent web application that analyzes your facial expressions to curate a personalized music experience just for you.
            </p>
            <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300" data-page="app">
                Launch App
            </button>
        </div>
    `,
    app: `
        <div id="loading-overlay" class="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 transition-opacity duration-500">
            <div class="loading-spinner mb-4"></div>
            <p id="loading-status" class="text-lg text-gray-300">Initializing...</p>
        </div>
        <main class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div class="space-y-8">
                <div class="glass-card p-6">
                    <h2 class="text-2xl font-semibold mb-4">Camera Feed</h2>
                    <div class="relative aspect-video bg-black rounded-lg overflow-hidden">
                        <video id="video" autoplay muted playsinline class="w-full h-full object-cover"></video>
                        <div id="camera-off-message" class="absolute inset-0 flex items-center justify-center text-gray-400">Camera is off</div>
                    </div>
                </div>
                <div class="glass-card p-6 text-center">
                    <h2 class="text-2xl font-semibold mb-4">Controls</h2>
                    <div id="controls" class="flex flex-col sm:flex-row gap-4 justify-center">
                        <button id="spotify-connect-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300">Connect to Spotify</button>
                        <button id="start-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50" disabled>Start Detection</button>
                        <button id="stop-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50" disabled>Stop Detection</button>
                    </div>
                </div>
            </div>
            <div class="space-y-8">
                <div class="glass-card p-6 min-h-[200px] flex flex-col items-center justify-center text-center">
                    <h2 class="text-2xl font-semibold mb-4">Detected Emotion</h2>
                    <div id="emotion-display"><p class="text-gray-400">Connect to Spotify, then start detection.</p></div>
                </div>
                <div class="glass-card p-6 min-h-[200px] flex flex-col items-center justify-center text-center">
                    <h2 class="text-2xl font-semibold mb-4">Music Recommendation</h2>
                    <div id="music-display"><p class="text-gray-400">Music will appear here</p></div>
                </div>
            </div>
        </main>
    `,
    about: `
        <div class="max-w-4xl mx-auto glass-card p-8">
            <h1 class="text-4xl font-bold mb-6 animated-gradient-text">About This Project</h1>
            <div class="space-y-4 text-lg text-gray-300">
                <p>MoodTunes is a portfolio project created by Pratik, designed to showcase the power of modern web technologies, including real-time AI, third-party API integration, and interactive 3D graphics.</p>
                <p>The application uses your device's camera to analyze facial expressions with a TensorFlow.js model running directly in the browser. The detected emotion is then sent to Google's Gemini AI, which acts as a music expert to suggest a curated list of relevant songs. Finally, the app searches for these songs on Spotify and provides a direct link to listen.</p>
                <h2 class="text-2xl font-bold pt-4">Technologies Used:</h2>
                <ul class="list-disc list-inside">
                    <li>HTML5, CSS3, TypeScript</li>
                    <li>Vite.js for development</li>
                    <li>Tailwind CSS for styling</li>
                    <li>Three.js for the 3D animated background</li>
                    <li>face-api.js (TensorFlow) for emotion detection</li>
                    <li>Google Gemini API for intelligent recommendations</li>
                    <li>Spotify Web API for music search</li>
                    <li>Firebase for backend services</li>
                </ul>
            </div>
        </div>
    `,
    contact: `
        <div class="max-w-4xl mx-auto glass-card p-8 text-center">
            <h1 class="text-4xl font-bold mb-6 animated-gradient-text">Get In Touch</h1>
            <p class="text-xl text-gray-300 mb-8">I'd love to hear from you! Feel free to reach out.</p>
            <div class="text-lg space-y-2">
                <p class="font-bold">Pratik Kadam</p>
                <a href="mailto:pratikkadam1030@gmail.com" class="text-blue-400 hover:text-blue-300">pratikkadam1030@gmail.com</a>
                <p class="mt-4">
                    Find me on 
                    <a href="https://www.linkedin.com/in/pratik-kadam30" target="_blank" class="text-blue-400 hover:text-blue-300">LinkedIn</a> or 
                    <a href="https://github.com/Pratik4875" target="_blank" class="text-blue-400 hover:text-blue-300">GitHub</a>.
                </p>
            </div>
        </div>
    `
};

// --- Global State ---
let currentPage = '';
let detectionInterval: number | undefined;
let videoStream: MediaStream | null = null;

// --- 3D Background Animation ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg-canvas') as HTMLCanvasElement, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 5;

const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 5000;
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 10;
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({ size: 0.005, color: 0xffffff });
const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

function animate() {
    requestAnimationFrame(animate);
    particlesMesh.rotation.y += mouse.x * 0.0005;
    particlesMesh.rotation.x += mouse.y * 0.0005;
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// --- Page Navigation & Cleanup ---
const pageContent = document.getElementById('page-content')!;

function cleanupAppLogic() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = undefined;
    }
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    console.log("App logic cleaned up.");
}

function loadPage(pageName: string) {
    if (currentPage === 'app') {
        cleanupAppLogic();
    }
    currentPage = pageName;
    pageContent.innerHTML = pages[pageName as keyof typeof pages] || pages.home;

    if (pageName === 'app') {
        initializeAppLogic();
    }
}

document.body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const pageLink = target.closest('[data-page]');
    if (pageLink) {
        e.preventDefault();
        const pageName = pageLink.getAttribute('data-page');
        if (pageName) {
            loadPage(pageName);
        }
    }
});


// --- MoodTunes App Logic ---
async function initializeAppLogic() {
    const video = document.getElementById('video') as HTMLVideoElement;
    const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
    const spotifyConnectBtn = document.getElementById('spotify-connect-btn') as HTMLButtonElement;
    const loadingOverlay = document.getElementById('loading-overlay') as HTMLDivElement;
    const loadingStatus = document.getElementById('loading-status') as HTMLParagraphElement;
    const emotionDisplay = document.getElementById('emotion-display') as HTMLDivElement;
    const musicDisplay = document.getElementById('music-display') as HTMLDivElement;
    const cameraOffMessage = document.getElementById('camera-off-message') as HTMLDivElement;
    
    let isDetecting = false;
    let currentEmotion: string | null = null;
    let spotifyToken: string | null = null;

    const emotionMap: { [key: string]: { emoji: string; color: string; prompt: string } } = {
        angry: { emoji: '😠', color: 'text-red-400', prompt: 'List 5 popular, high-energy songs from the last 20 years for someone feeling angry.' },
        happy: { emoji: '😊', color: 'text-yellow-400', prompt: 'List 5 iconic, universally happy pop songs from the 2010s.' },
        sad: { emoji: '😢', color: 'text-blue-400', prompt: 'List 5 famous, melancholic, and emotional acoustic songs for a moment of sadness.' },
        neutral: { emoji: '😐', color: 'text-gray-400', prompt: 'List 5 very famous, calming instrumental lofi or chillhop songs.' },
        surprised: { emoji: '😲', color: 'text-pink-400', prompt: 'List 5 exciting and uplifting electronic dance songs that feel like a pleasant surprise.' },
        fearful: { emoji: '😨', color: 'text-purple-400', prompt: 'List 5 dark, atmospheric, and suspenseful ambient or cinematic songs for a fearful mood.' },
        disgusted: { emoji: '🤢', color: 'text-lime-400', prompt: 'List 5 classic, raw punk rock songs for a feeling of disgust.' },
    };

    async function loadModels() {
        loadingStatus.textContent = 'Loading AI models...';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
    }

    async function startCamera() {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = videoStream;
            cameraOffMessage.style.display = 'none';
        } catch (err) {
            emotionDisplay.innerHTML = `<p class="text-red-400">Could not access camera. Please check permissions.</p>`;
        }
    }

    function stopCamera() {
        if (video.srcObject) {
            (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            video.srcObject = null;
            videoStream = null;
            cameraOffMessage.style.display = 'flex';
        }
    }

    function startDetectionLoop(db: Firestore, userId: string) {
        isDetecting = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        emotionDisplay.innerHTML = `<p class="text-gray-400">Detecting...</p>`;

        detectionInterval = window.setInterval(async () => {
            if (!isDetecting || !video.srcObject) return;
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
            if (detections) {
                const primaryEmotion = Object.keys(detections.expressions).reduce((a, b) => detections.expressions[a] > detections.expressions[b] ? a : b);
                if (primaryEmotion !== currentEmotion) {
                    currentEmotion = primaryEmotion;
                    const { emoji, color, prompt } = emotionMap[primaryEmotion] || emotionMap.neutral;
                    emotionDisplay.innerHTML = `
                        <div class="text-7xl mb-2">${emoji}</div>
                        <p class="text-3xl font-bold capitalize ${color}">${primaryEmotion}</p>
                        <p class="text-sm text-gray-300">Confidence: ${(detections.expressions[primaryEmotion] * 100).toFixed(1)}%</p>
                    `;
                    getSongForEmotion(prompt);
                    saveEmotionToFirebase(db, userId, { emotion: primaryEmotion, confidence: detections.expressions[primaryEmotion] });
                }
            }
        }, 3000);
    }

    function stopDetectionLoop() {
        isDetecting = false;
        if (detectionInterval) clearInterval(detectionInterval);
        currentEmotion = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        emotionDisplay.innerHTML = `<p class="text-gray-400">Detection stopped.</p>`;
        musicDisplay.innerHTML = `<p class="text-gray-400">Music recommendations paused.</p>`;
    }

    async function saveEmotionToFirebase(db: Firestore, userId: string, emotion: { emotion: string; confidence: number }) {
        try {
            await addDoc(collection(db, 'sessions'), { userId, ...emotion, timestamp: serverTimestamp() });
        } catch (error) {
            console.error("Error saving session:", error);
        }
    }

    function redirectToSpotifyLogin() {
        const scope = 'user-read-private user-read-email user-library-read';
        const authUrl = new URL("https://accounts.spotify.com/authorize");
        const randomString = crypto.randomUUID();
        window.localStorage.setItem('spotify_auth_state', randomString);
        const params = {
            response_type: 'code',
            client_id: "7bee23d2ac4c43ffac4005b45f15cb50",
            scope,
            redirect_uri: 'http://127.0.0.1:5173',
            state: randomString
        };
        authUrl.search = new URLSearchParams(params).toString();
        window.location.href = authUrl.toString();
    }

    async function getAccessToken(code: string) {
        loadingStatus.textContent = 'Connecting to Spotify...';
        loadingOverlay.style.display = 'flex';
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa("7bee23d2ac4c43ffac4005b45f15cb50" + ":" + "07c0797216b04eb0aef21504af1e8097"),
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: 'http://127.0.0.1:5173',
            }),
        });
        const data = await response.json();
        return data.access_token;
    }

    async function getSongForEmotion(prompt: string) {
        if (!spotifyToken) return;
        musicDisplay.innerHTML = `<p class="text-gray-400">Asking AI for songs...</p>`;
        const foundTrack = await findSongForEmotion(prompt, spotifyToken);
        if (foundTrack) {
            displaySong(foundTrack);
        } else {
            musicDisplay.innerHTML = `<p class="text-gray-400">No songs found for this mood.</p>`;
        }
    }

    function displaySong(track: any) {
        musicDisplay.innerHTML = `
            <img src="${track.album.images[0].url}" alt="${track.name}" class="w-32 h-32 rounded-lg mx-auto mb-4 shadow-lg">
            <p class="font-bold text-lg">${track.name}</p>
            <p class="text-gray-300 mb-4">${track.artists[0].name}</p>
            <a href="${track.external_urls.spotify}" target="_blank" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg inline-block transition duration-300">Listen on Spotify</a>
        `;
    }

    // --- App Initialization Sequence ---
    async function runFullInitialization() {
        try {
            loadingStatus.textContent = 'Connecting to server...';
            const firebaseApp = initializeApp({
                apiKey: "AIzaSyB-xjaUYsrNzP4VEYRAOiDXI6uuSSW6bv4",
                authDomain: "emo-music-e4276.firebaseapp.com",
                projectId: "emo-music-e4276",
                storageBucket: "emo-music-e4276.appspot.com",
                messagingSenderId: "871548316848",
                appId: "1:871548316848:web:bada37462a5c93fc241f75",
                measurementId: "G-WPEF2VP0W8"
            });
            const auth = getAuth(firebaseApp);
            const db = getFirestore(firebaseApp);
            const userCredential = await signInAnonymously(auth);
            const user = userCredential.user;

            if (user) {
                await loadModels();
                if (spotifyToken) {
                    spotifyConnectBtn.textContent = "Spotify Connected";
                    spotifyConnectBtn.disabled = true;
                    startBtn.disabled = false;
                } else {
                    spotifyConnectBtn.addEventListener('click', redirectToSpotifyLogin);
                }
                startBtn.addEventListener('click', () => startCamera().then(() => startDetectionLoop(db, user.uid)));
                stopBtn.addEventListener('click', () => { stopDetectionLoop(); stopCamera(); });
                loadingOverlay.style.display = 'none';
            } else {
                throw new Error("Authentication failed.");
            }
        } catch (error) {
            loadingStatus.textContent = `Initialization Failed: ${(error as Error).message}`;
        }
    }
    
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
        spotifyToken = await getAccessToken(code);
        window.history.replaceState({}, '', '/'); 
    }
    
    await runFullInitialization(); 
}

// --- Initial Page Load ---
const initialParams = new URLSearchParams(window.location.search);
if (initialParams.has('code')) {
    loadPage('app');
} else {
    loadPage('home');
}
