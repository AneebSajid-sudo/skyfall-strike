# SKYFALL STRIKE 🚀

A web-based space shooter game where you control a fighter jet using your hands! Powered by Google's MediaPipe AI for real-time hand gesture recognition and tracking in the browser.

## Features
- **Hand Gesture Controls**: Steer with your right hand, shoot with an open left hand, and make a fist for a special attack!
- **Upgrade System**: Spend your score on upgrades between waves — fire rate, damage, health, spread shot, and special charge!
- **AI Vision**: Uses MediaPipe Tasks Vision (Hand Landmarker) for completely client-side, real-time hand tracking.
- **Procedural Audio**: Web Audio API generates all sound effects from math on the fly — no external audio files required.
- **Cyberpunk Aesthetic**: Pure HTML5 Canvas and CSS glassmorphism styling.
- **Keyboard Fallback**: Standard keyboard controls if no camera is available (Arrow keys + Space + Shift).

## How to Run Locally
Since the game uses ES Modules, it needs to be served via a local web server (opening the file directly in the browser will result in CORS errors).

**Using the included PowerShell Server (Windows):**
```bash
cd "C:\path\to\skyfall"
powershell -ExecutionPolicy Bypass -File .\server.ps1
```
Then navigate to `http://localhost:3000` in your browser.

**Using Python:**
```bash
python3 -m http.server 3000
```

**Using Node.js:**
```bash
npx serve .
```

## How to Play
1. Allow camera access when prompted.
2. Wait a moment for the AI model to initialize.
3. ✋ Move your **right hand** to steer your ship.
4. 🤚 Show your **left hand open** (fingers spread) to fire weapons.
5. ✊ Make a **fist with your left hand** to unleash a special shockwave attack!
6. 🛒 After each wave, spend your score on **upgrades** to power up your ship!

## Technologies
- HTML5 Canvas
- JavaScript (ES Modules)
- CSS3 (Variables, Animations, Flexbox/Grid)
- MediaPipe Tasks Vision (Hand Landmarker)
- Web Audio API (Procedural Sound Effects)
