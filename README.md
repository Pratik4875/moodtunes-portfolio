# MoodTunes v2.0 - AI-Powered Music Portfolio Project

MoodTunes is an intelligent web application that analyzes a user's facial expressions in real-time to provide personalized music recommendations. This project, created by Pratik Kadam, serves as a comprehensive portfolio piece demonstrating expertise in modern web development, real-time AI, third-party API integration, and interactive 3D graphics.

![MoodTunes Screenshot](https://i.imgur.com/your-screenshot-url.png) <!-- You can add a screenshot URL here later -->

**Live Demo:** [https://emo-music-e4276.web.app](https://emo-music-e4276.web.app)

---

## ✨ Core Features

-   **Real-time Emotion Detection:** Utilizes a TensorFlow.js model running directly in the browser to detect emotions from a live camera feed.
-   **Intelligent Music Curation:** Employs the Google Gemini AI to generate a curated list of context-aware song suggestions based on the user's detected emotion, location, and the current date.
-   **Dual Music Providers:** Offers music discovery through both **Spotify** and **YouTube**, making the app accessible to all users.
-   **Interactive 3D Background:** Features a dynamic, animated particle background built with Three.js that responds to mouse movements.
-   **Multi-Page Portfolio:** The app is integrated into a complete portfolio website with Home, About, and Contact pages.
-   **Firebase Integration:** Uses Firebase for anonymous user authentication and Firestore to log emotion data for potential future analysis.

---

## 🛠️ Technologies Used

-   **Frontend:** HTML5, CSS3, TypeScript, Vite.js, Tailwind CSS
-   **3D Graphics:** Three.js
-   **Artificial Intelligence:**
    -   **Emotion Detection:** face-api.js (built on TensorFlow.js)
    -   **Music Curation:** Google Gemini API
-   **Music APIs:**
    -   Spotify Web API
    -   YouTube Data API v3
-   **Backend & Hosting:**
    -   Firebase Authentication (Anonymous)
    -   Firestore Database
    -   Firebase Hosting with GitHub Actions for CI/CD

---

## 🚀 Setup and Installation

To run this project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/Pratik4875/moodtunes-portfolio.git](https://github.com/Pratik4875/moodtunes-portfolio.git)
    cd moodtunes-portfolio
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **API Keys:**
    -   You will need API keys from Google (for Gemini and YouTube), Spotify, and Firebase. Place these in the appropriate files (`musicRecommender.ts`, `main.ts`).

4.  **AI Models:**
    -   Download the `face-api.js` models from the [original repository's `weights` folder](https://github.com/justadudewhohacks/face-api.js/tree/master/weights).
    -   Place the downloaded model files in a `public/models` directory in your project root.

5.  **Run the development server:**
    ```bash
    npm run dev
    ```

---

## 📂 Project Structure


moodtunes-portfolio/
├── public/
│   └── models/         # AI model files
├── src/
│   ├── main.ts         # Main application logic, UI, and navigation
│   ├── musicRecommender.ts # Core AI and music search logic
│   └── style.css       # Tailwind CSS and custom styles
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.js


---

## 📞 Contact

**Pratik Kadam**
-   **Email:** [pratikkadam1030@gmail.com](mailto:pratikkadam1030@gmail.com)
-   **LinkedIn:** [linkedin.com/in/pratik-kadam30](https://www.linkedin.com/in/pratik-kadam30)
-   **GitHub:** [@Pratik4875](https://github.com/Pratik4875)

