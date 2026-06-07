SKYFALL STRIKE 🚀
A web-based space shooter game where you control a fighter jet using your face! Powered by Google's MediaPipe AI for real-time facial recognition and tracking in the browser.

Features
Face Controls: Steer with your head, shoot by opening your mouth, and use a special attack by raising your eyebrows!
AI Vision: Uses MediaPipe Tasks Vision for completely client-side, real-time landmark tracking.
Procedural Audio: Web Audio API generates all sound effects on the fly—no external audio files required.
Cyberpunk Aesthetic: Pure HTML5 Canvas and CSS glassmorphism styling.
Keyboard Fallback: Standard keyboard controls if no camera is available (Arrow keys + Space + Shift).
How to Run Locally
Since the game uses ES Modules, it needs to be served via a local web server (opening the file directly in the browser will result in CORS errors).

Using the included PowerShell Server (Windows):

powershell -ExecutionPolicy Bypass -File .\server.ps1
Then navigate to http://localhost:3000 in your browser.

Using Python:

python3 -m http.server 3000
Using Node.js:

npx serve .
How to Play
Allow camera access when prompted.
Wait a moment for the AI model to initialize and calibrate to your face.
Move your head to steer your ship.
Open your mouth to fire.
Raise your eyebrows to unleash a shockwave when your special meter is full!
Technologies
HTML5 Canvas
JavaScript (ES Modules)
CSS3 (Variables, Animations, Flexbox/Grid)
MediaPipe tasks-vision (Face Landmarker)
