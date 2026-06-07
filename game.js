// ================================================
// SKYFALL STRIKE - Face Controlled Jet Combat Game
// ================================================

import { FaceLandmarker, FilesetResolver } from 
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

// ==================== CONFIG ====================
const CONFIG = {
  smoothing: 0.15,
  mouthThreshold: 0.3,
  browThreshold: 0.45,
  bulletCooldown: 150,
  playerHealth: 100,
  waveBaseEnemies: 8,
  enemyShootChance: 0.008,
};

// ==================== SOUND MANAGER ====================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch(e) {
      console.warn('Audio not available');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  shoot() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  explosion(big = false) {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const duration = big ? 0.5 : 0.25;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(big ? 800 : 1200, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    gain.gain.setValueAtTime(big ? 0.5 : 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.start(t);
  }

  powerUp() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = 'sine';
      const start = t + i * 0.08;
      osc.frequency.setValueAtTime(600 + i * 200, start);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  hit() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  special() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      const start = t + i * 0.04;
      osc.frequency.setValueAtTime(200 + i * 150, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.start(start);
      osc.stop(start + 0.2);
    }
    this.explosion(true);
  }
}

// ==================== FACE CONTROLLER ====================
class FaceController {
  constructor() {
    this.faceLandmarker = null;
    this.video = null;
    this.isReady = false;
    this.controls = {
      x: 0.5,
      y: 0.5,
      shooting: false,
      special: false,
    };
    this.smoothX = 0.5;
    this.smoothY = 0.5;
    this.faceDetected = false;
  }

  async init(videoElement, onProgress) {
    this.video = videoElement;
    
    onProgress(10, 'Loading AI Vision module...');
    
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    
    onProgress(40, 'Loading Face Landmark model...');
    
    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
    
    onProgress(70, 'Accessing camera...');
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: "user" }
    });
    this.video.srcObject = stream;
    
    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        resolve();
      };
    });
    
    onProgress(90, 'Calibrating...');
    
    // Warm up with a couple frames
    await new Promise(r => setTimeout(r, 500));
    
    this.isReady = true;
    onProgress(100, 'Ready!');
  }

  update() {
    if (!this.isReady || this.video.readyState < 2) return;
    
    const results = this.faceLandmarker.detectForVideo(this.video, performance.now());
    
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      this.faceDetected = true;
      const landmarks = results.faceLandmarks[0];
      
      // Nose tip for position (mirrored)
      const rawX = 1 - landmarks[4].x;
      const rawY = landmarks[4].y;
      
      // Smooth
      this.smoothX += (rawX - this.smoothX) * CONFIG.smoothing;
      this.smoothY += (rawY - this.smoothY) * CONFIG.smoothing;
      
      this.controls.x = this.smoothX;
      this.controls.y = this.smoothY;
      
      // Blendshapes
      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const bs = {};
        results.faceBlendshapes[0].categories.forEach(b => {
          bs[b.categoryName] = b.score;
        });
        
        this.controls.shooting = (bs['jawOpen'] || 0) > CONFIG.mouthThreshold;
        this.controls.special = (bs['browInnerUp'] || 0) > CONFIG.browThreshold;
      }
    } else {
      this.faceDetected = false;
    }
    
    return this.controls;
  }

  getControls() {
    return this.controls;
  }
}

// ==================== KEYBOARD CONTROLLER ====================
class KeyboardController {
  constructor() {
    this.keys = {};
    this.controls = { x: 0.5, y: 0.7, shooting: false, special: false };
    
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  update() {
    const speed = 0.015;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.controls.x -= speed;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) this.controls.x += speed;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) this.controls.y -= speed;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) this.controls.y += speed;
    
    this.controls.x = Math.max(0.05, Math.min(0.95, this.controls.x));
    this.controls.y = Math.max(0.05, Math.min(0.95, this.controls.y));
    
    this.controls.shooting = this.keys['Space'] || false;
    this.controls.special = this.keys['ShiftLeft'] || this.keys['ShiftRight'] || false;
    
    return this.controls;
  }

  getControls() {
    return this.controls;
  }
}

// ==================== PARTICLE ====================
class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx ?? (Math.random() - 0.5) * 4;
    this.vy = opts.vy ?? (Math.random() - 0.5) * 4;
    this.life = opts.life ?? 1;
    this.decay = opts.decay ?? 0.02;
    this.size = opts.size ?? 3;
    this.color = opts.color ?? '#00f5ff';
    this.type = opts.type ?? 'circle';
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.size *= 0.97;
    return this.life > 0 && this.size > 0.3;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    
    if (this.type === 'circle') {
      ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
    } else {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(0.5, this.size * 0.5);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ==================== STAR FIELD ====================
class StarField {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.stars = [];
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 60 + layer * 25; i++) {
        this.stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * (layer + 1) * 0.7 + 0.2,
          speed: (layer + 1) * 0.4 + Math.random() * 0.2,
          brightness: Math.random() * 0.5 + 0.2 + layer * 0.1,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.03 + 0.005,
        });
      }
    }
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  update() {
    for (const s of this.stars) {
      s.y += s.speed;
      s.twinkle += s.twinkleSpeed;
      if (s.y > this.height) {
        s.y = -2;
        s.x = Math.random() * this.width;
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      const t = Math.sin(s.twinkle) * 0.3 + 0.7;
      ctx.globalAlpha = s.brightness * t;
      ctx.fillRect(s.x, s.y, s.size * 1.5, s.size * 1.5);
    }
    ctx.globalAlpha = 1;
  }
}

// ==================== BULLET ====================
class Bullet {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? -12;
    this.width = opts.width ?? 4;
    this.height = opts.height ?? 14;
    this.color = opts.color ?? '#00f5ff';
    this.isEnemy = opts.isEnemy ?? false;
    this.damage = opts.damage ?? 10;
    this.alive = true;
  }

  update(cw, ch) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.y < -30 || this.y > ch + 30 || this.x < -30 || this.x > cw + 30) {
      this.alive = false;
    }
    return this.alive;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Core glow
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.width / 4, this.height / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

// ==================== ENEMY ====================
class Enemy {
  constructor(x, y, type = 'basic') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.alive = true;
    this.phase = Math.random() * Math.PI * 2;
    this.spawnTime = Date.now();
    
    const defs = {
      basic:  { w: 28, h: 30, hp: 20, spd: 1.8, score: 100, color: '#ff2d55', shootRate: 0.004 },
      fast:   { w: 22, h: 24, hp: 12, spd: 3.5, score: 150, color: '#ff9500', shootRate: 0.002 },
      tank:   { w: 38, h: 40, hp: 60, spd: 1.0, score: 300, color: '#ff3b30', shootRate: 0.007 },
      boss:   { w: 55, h: 58, hp: 250, spd: 0.7, score: 1000, color: '#af52de', shootRate: 0.012 },
    };
    const d = defs[type] || defs.basic;
    this.width = d.w;
    this.height = d.h;
    this.health = d.hp;
    this.maxHealth = d.hp;
    this.speed = d.spd;
    this.score = d.score;
    this.color = d.color;
    this.shootRate = d.shootRate;
  }

  update(cw, ch) {
    this.phase += 0.02;
    
    if (this.type === 'fast') {
      this.x += Math.sin(this.phase) * 2.5;
    } else if (this.type === 'boss') {
      this.x += Math.sin(this.phase * 0.5) * 2;
      // Boss stays in upper portion
      if (this.y > ch * 0.25) {
        this.speed = 0;
      }
    } else if (this.type === 'tank') {
      this.x += Math.sin(this.phase * 0.8) * 1;
    }
    
    this.y += this.speed;
    this.x = Math.max(this.width, Math.min(cw - this.width, this.x));
    
    if (this.y > ch + 60) this.alive = false;
    return this.alive;
  }

  shouldShoot() {
    return this.y > 20 && Math.random() < this.shootRate;
  }

  takeDamage(amt) {
    this.health -= amt;
    if (this.health <= 0) { this.alive = false; return true; }
    return false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Glow
    ctx.fillStyle = this.color;
    
    const w = this.width;
    const h = this.height;
    
    // Enemy ship body (inverted from player - pointing down)
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);          // nose (bottom)
    ctx.lineTo(-w * 0.2, h * 0.15);
    ctx.lineTo(-w * 0.5, -h * 0.35); // left wing tip
    ctx.lineTo(-w * 0.15, -h * 0.2);
    ctx.lineTo(0, -h * 0.5);         // tail
    ctx.lineTo(w * 0.15, -h * 0.2);
    ctx.lineTo(w * 0.5, -h * 0.35);  // right wing tip
    ctx.lineTo(w * 0.2, h * 0.15);
    ctx.closePath();
    ctx.fill();
    
    // Cockpit glow
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(0, h * 0.1, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine glow (top, since enemy faces down)
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-5, -h * 0.5);
    ctx.lineTo(0, -h * 0.5 - 8 - Math.random() * 5);
    ctx.lineTo(5, -h * 0.5);
    ctx.closePath();
    ctx.fill();
    
    // Health bar for tough enemies
    if ((this.type === 'tank' || this.type === 'boss') && this.health < this.maxHealth) {
      ctx.globalAlpha = 0.9;
      ctx.shadowBlur = 0;
      const bw = w * 1.3;
      const bh = 3;
      const bx = -bw / 2;
      const by = -h * 0.5 - 14;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = this.color;
      ctx.fillRect(bx, by, bw * (this.health / this.maxHealth), bh);
    }
    
    ctx.restore();
  }
}

// ==================== POWERUP ====================
class PowerUp {
  constructor(x, y, type = 'health') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = 14;
    this.speed = 1.2;
    this.alive = true;
    this.phase = 0;
    
    const defs = {
      health:  { color: '#34c759', symbol: '＋' },
      spread:  { color: '#ffcc00', symbol: '✦' },
      shield:  { color: '#5ac8fa', symbol: '◆' },
    };
    const d = defs[type] || defs.health;
    this.color = d.color;
    this.symbol = d.symbol;
  }

  update(ch) {
    this.y += this.speed;
    this.phase += 0.06;
    if (this.y > ch + 30) this.alive = false;
    return this.alive;
  }

  draw(ctx) {
    ctx.save();
    const pulse = Math.sin(this.phase) * 2;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.phase * 0.4);
    
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    
    // Diamond
    const s = this.size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.15;
    ctx.fill();
    
    // Symbol
    ctx.globalAlpha = 1;
    ctx.rotate(-this.phase * 0.4);
    ctx.font = 'bold 12px Orbitron, sans-serif';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.symbol, 0, 1);
    
    ctx.restore();
  }
}

// ==================== PLAYER ====================
class Player {
  constructor(cw, ch) {
    this.cw = cw;
    this.ch = ch;
    this.x = cw / 2;
    this.y = ch * 0.8;
    this.width = 30;
    this.height = 38;
    this.health = CONFIG.playerHealth;
    this.maxHealth = CONFIG.playerHealth;
    this.special = 0;
    this.maxSpecial = 100;
    this.lastShot = 0;
    this.invincible = false;
    this.invTimer = 0;
    this.spreadShot = false;
    this.spreadTimer = 0;
    this.shielded = false;
    this.shieldTimer = 0;
    this.tilt = 0;
    this.alive = true;
    this.enginePhase = 0;
  }

  resize(cw, ch) {
    this.cw = cw;
    this.ch = ch;
  }

  update(controls, dt) {
    // Map face coords to screen
    const targetX = ((controls.x - 0.2) / 0.6) * this.cw;
    const targetY = ((controls.y - 0.15) / 0.55) * this.ch;
    
    this.x += (targetX - this.x) * 0.1;
    this.y += (targetY - this.y) * 0.1;
    
    // Clamp
    this.x = Math.max(this.width + 5, Math.min(this.cw - this.width - 5, this.x));
    this.y = Math.max(this.height + 5, Math.min(this.ch - this.height - 5, this.y));
    
    // Tilt
    const dx = targetX - this.x;
    this.tilt += (Math.max(-0.35, Math.min(0.35, dx * 0.008)) - this.tilt) * 0.1;
    
    this.enginePhase += 0.3;
    
    // Charge special
    this.special = Math.min(this.maxSpecial, this.special + 0.12);
    
    // Timers
    if (this.invincible) {
      this.invTimer -= dt;
      if (this.invTimer <= 0) this.invincible = false;
    }
    if (this.spreadShot) {
      this.spreadTimer -= dt;
      if (this.spreadTimer <= 0) this.spreadShot = false;
    }
    if (this.shielded) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shielded = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    
    // Invincibility flash
    if (this.invincible && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    
    // Shield bubble
    if (this.shielded) {
      ctx.save();
      ctx.strokeStyle = '#5ac8fa';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.35 + Math.sin(Date.now() * 0.006) * 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, this.width * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    const h = this.height;
    const w = this.width;
    const ef = Math.sin(this.enginePhase) * 0.2 + 0.8;
    
    // Engine flames
    ctx.fillStyle = '#00f5ff';
    ctx.globalAlpha = 0.7 * ef;
    ctx.beginPath();
    ctx.moveTo(-7, h * 0.42);
    ctx.lineTo(0, h * 0.42 + 14 + Math.random() * 8);
    ctx.lineTo(7, h * 0.42);
    ctx.closePath();
    ctx.fill();
    // Inner white
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.35 * ef;
    ctx.beginPath();
    ctx.moveTo(-3, h * 0.42);
    ctx.lineTo(0, h * 0.42 + 8 + Math.random() * 4);
    ctx.lineTo(3, h * 0.42);
    ctx.closePath();
    ctx.fill();
    
    ctx.globalAlpha = this.invincible && Math.floor(Date.now() / 80) % 2 === 0 ? 0.4 : 1;
    
    // Fuselage
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.5);          // nose
    ctx.lineTo(-w * 0.22, -h * 0.2);
    ctx.lineTo(-w * 0.22, h * 0.3);
    ctx.lineTo(0, h * 0.45);
    ctx.lineTo(w * 0.22, h * 0.3);
    ctx.lineTo(w * 0.22, -h * 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Wings
    ctx.fillStyle = '#0099cc';
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -h * 0.05);
    ctx.lineTo(-w * 0.95, h * 0.2);
    ctx.lineTo(-w * 0.75, h * 0.3);
    ctx.lineTo(-w * 0.22, h * 0.12);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(w * 0.22, -h * 0.05);
    ctx.lineTo(w * 0.95, h * 0.2);
    ctx.lineTo(w * 0.75, h * 0.3);
    ctx.lineTo(w * 0.22, h * 0.12);
    ctx.closePath();
    ctx.fill();
    
    // Tail fins
    ctx.fillStyle = '#007799';
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, h * 0.25);
    ctx.lineTo(-w * 0.4, h * 0.45);
    ctx.lineTo(-w * 0.25, h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.25);
    ctx.lineTo(w * 0.4, h * 0.45);
    ctx.lineTo(w * 0.25, h * 0.4);
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#80e5ff';
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.15, 4.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  takeDamage(amt) {
    if (this.invincible || this.shielded) return false;
    this.health -= amt;
    this.invincible = true;
    this.invTimer = 1200;
    if (this.health <= 0) { this.health = 0; this.alive = false; return true; }
    return false;
  }

  canShoot() {
    const now = Date.now();
    if (now - this.lastShot >= CONFIG.bulletCooldown) {
      this.lastShot = now;
      return true;
    }
    return false;
  }

  canSpecial() {
    if (this.special >= 50) {
      this.special = 0;
      return true;
    }
    return false;
  }
}

// ==================== MAIN GAME ====================
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.faceCtrl = new FaceController();
    this.kbCtrl = new KeyboardController();
    this.sound = new SoundManager();
    
    this.state = 'loading';
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    
    this.player = null;
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.powerUps = [];
    this.starField = null;
    
    this.waveSpawned = 0;
    this.waveTotal = CONFIG.waveBaseEnemies;
    this.waveSpawnTimer = 0;
    this.waveActive = false;
    this.waveCooldown = 0;
    
    this.shakeAmt = 0;
    this.shakeDur = 0;
    
    this.lastTime = 0;
    this.animFrame = null;
    this.useFace = true;
    
    this.gameLoop = this.gameLoop.bind(this);
  }

  async init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    const video = document.getElementById('webcam');
    
    try {
      await this.faceCtrl.init(video, (pct, text) => {
        this.updateLoading(pct, text);
      });
      this.useFace = true;
    } catch (err) {
      console.warn('Face detection failed, using keyboard:', err);
      this.useFace = false;
      this.updateLoading(100, 'Camera unavailable — keyboard mode');
      // Hide face cam
      document.getElementById('face-cam-container').style.display = 'none';
    }
    
    setTimeout(() => this.showScreen('start'), 600);
    
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
    document.getElementById('menu-btn').addEventListener('click', () => this.showScreen('start'));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.starField) this.starField.resize(this.canvas.width, this.canvas.height);
    if (this.player) this.player.resize(this.canvas.width, this.canvas.height);
  }

  updateLoading(pct, text) {
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('loading-text');
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = text;
  }

  showScreen(name) {
    ['loading', 'start', 'game', 'gameover'].forEach(s => {
      const el = document.getElementById(s + '-screen');
      if (el) el.classList.toggle('hidden', s !== name);
    });
    this.state = name === 'game' ? 'playing' : name;
  }

  startGame() {
    this.sound.init();
    this.sound.resume();
    
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    
    this.player = new Player(this.canvas.width, this.canvas.height);
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.powerUps = [];
    this.starField = new StarField(this.canvas.width, this.canvas.height);
    
    this.waveSpawned = 0;
    this.waveTotal = CONFIG.waveBaseEnemies;
    this.waveSpawnTimer = 0;
    this.waveActive = true;
    this.waveCooldown = 0;
    
    this.shakeAmt = 0;
    this.shakeDur = 0;
    
    // Reset keyboard controller position
    this.kbCtrl.controls.x = 0.5;
    this.kbCtrl.controls.y = 0.7;
    
    this.updateHUD();
    this.showScreen('game');
    this.announceWave();
    
    this.lastTime = performance.now();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.gameLoop(performance.now());
  }

  announceWave() {
    const el = document.getElementById('wave-announce');
    document.getElementById('wave-num').textContent = this.wave;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2500);
  }

  gameLoop(ts) {
    if (this.state !== 'playing') return;
    
    const dt = Math.min(ts - this.lastTime, 50); // cap dt
    this.lastTime = ts;
    
    // Get controls
    let controls;
    if (this.useFace) {
      this.faceCtrl.update();
      controls = this.faceCtrl.getControls();
    }
    // Always update keyboard (can override/supplement face)
    this.kbCtrl.update();
    const kbCtrl = this.kbCtrl.getControls();
    
    if (!this.useFace || !this.faceCtrl.faceDetected) {
      controls = kbCtrl;
    } else {
      // Merge: keyboard overrides face for shooting/special
      if (kbCtrl.shooting) controls.shooting = true;
      if (kbCtrl.special) controls.special = true;
    }
    
    this.update(dt, controls);
    this.render();
    
    this.animFrame = requestAnimationFrame(this.gameLoop);
  }

  update(dt, controls) {
    this.player.update(controls, dt);
    
    // Shooting
    if (controls.shooting && this.player.canShoot()) {
      this.playerShoot();
      document.getElementById('ind-mouth').classList.add('active');
    } else if (!controls.shooting) {
      document.getElementById('ind-mouth').classList.remove('active');
    }
    
    // Special
    if (controls.special && this.player.canSpecial()) {
      this.activateSpecial();
      document.getElementById('ind-brow').classList.add('active');
    } else if (!controls.special) {
      document.getElementById('ind-brow').classList.remove('active');
    }
    
    // Stars
    this.starField.update();
    
    // Bullets
    const cw = this.canvas.width, ch = this.canvas.height;
    this.playerBullets = this.playerBullets.filter(b => b.update(cw, ch));
    this.enemyBullets = this.enemyBullets.filter(b => b.update(cw, ch));
    
    // Enemies
    for (const e of this.enemies) {
      e.update(cw, ch);
      if (e.alive && e.shouldShoot()) {
        this.enemyShoot(e);
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);
    
    // Particles
    this.particles = this.particles.filter(p => p.update());
    
    // Power-ups
    this.powerUps = this.powerUps.filter(p => p.update(ch));
    
    // Waves
    this.updateWave(dt);
    
    // Collisions
    this.checkCollisions();
    
    // Shake
    if (this.shakeDur > 0) {
      this.shakeDur -= dt;
      this.shakeAmt *= 0.92;
    }
    
    // Combo
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    
    // Combo display
    const comboEl = document.getElementById('combo-display');
    if (this.combo > 1) {
      comboEl.classList.remove('hidden');
      document.getElementById('combo-value').textContent = this.combo + 'x';
    } else {
      comboEl.classList.add('hidden');
    }
    
    this.updateHUD();
    
    if (!this.player.alive) this.gameOver();
  }

  playerShoot() {
    this.sound.shoot();
    const px = this.player.x, py = this.player.y - this.player.height * 0.5;
    
    if (this.player.spreadShot) {
      for (let a = -0.18; a <= 0.18; a += 0.18) {
        this.playerBullets.push(new Bullet(px + Math.sin(a) * 12, py, {
          vx: Math.sin(a) * 4, vy: -13, color: '#ffcc00', damage: 10
        }));
      }
    } else {
      this.playerBullets.push(new Bullet(px, py, { vy: -14, color: '#00f5ff', damage: 10 }));
    }
    
    // Muzzle flash
    for (let i = 0; i < 3; i++) {
      this.particles.push(new Particle(px, py, {
        vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 3 - 1,
        life: 0.4, decay: 0.06, size: 2, color: '#00f5ff'
      }));
    }
  }

  enemyShoot(enemy) {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = enemy.type === 'boss' ? 5 : 3.5;
    
    this.enemyBullets.push(new Bullet(enemy.x, enemy.y + enemy.height * 0.4, {
      vx: (dx / dist) * spd, vy: (dy / dist) * spd,
      color: '#ff2d55', isEnemy: true, damage: 12
    }));
    
    if (enemy.type === 'boss') {
      // Boss fires 3 spread bullets
      for (let a = -0.3; a <= 0.3; a += 0.3) {
        this.enemyBullets.push(new Bullet(enemy.x, enemy.y + enemy.height * 0.4, {
          vx: (dx / dist) * spd + Math.sin(a) * 2,
          vy: (dy / dist) * spd + Math.cos(a),
          color: '#af52de', isEnemy: true, damage: 10
        }));
      }
    }
  }

  activateSpecial() {
    this.sound.special();
    this.shake(12, 400);
    
    // Shockwave particles
    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 / 50) * i;
      this.particles.push(new Particle(this.player.x, this.player.y, {
        vx: Math.cos(angle) * (7 + Math.random() * 3),
        vy: Math.sin(angle) * (7 + Math.random() * 3),
        life: 1, decay: 0.015, size: 3.5,
        color: ['#00f5ff', '#ff2d55', '#ffcc00', '#af52de'][i % 4],
        type: 'spark'
      }));
    }
    
    // Damage all enemies
    for (const e of this.enemies) {
      if (e.takeDamage(80)) {
        this.explode(e.x, e.y, e.color, e.type === 'boss' ? 2 : 1);
        this.score += e.score;
        this.kills++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.comboTimer = 2000;
      }
    }
    
    this.enemyBullets = [];
  }

  shake(amt, dur) {
    this.shakeAmt = amt;
    this.shakeDur = dur;
  }

  explode(x, y, color, scale = 1) {
    this.sound.explosion(scale > 1);
    const count = Math.floor(18 * scale);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 * scale + 1;
      this.particles.push(new Particle(x, y, {
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 1, decay: 0.018 + Math.random() * 0.02,
        size: Math.random() * 4 * scale + 1,
        color: [color, '#fff', '#ffcc00', '#ff9500'][Math.floor(Math.random() * 4)],
        type: Math.random() > 0.4 ? 'spark' : 'circle'
      }));
    }
  }

  updateWave(dt) {
    if (this.waveActive) {
      this.waveSpawnTimer += dt;
      const interval = Math.max(350, 1400 - this.wave * 80);
      
      if (this.waveSpawnTimer >= interval && this.waveSpawned < this.waveTotal) {
        this.spawnEnemy();
        this.waveSpawned++;
        this.waveSpawnTimer = 0;
      }
      
      if (this.waveSpawned >= this.waveTotal && this.enemies.length === 0) {
        this.waveActive = false;
        this.waveCooldown = 3000;
      }
    } else {
      this.waveCooldown -= dt;
      if (this.waveCooldown <= 0) {
        this.wave++;
        this.waveSpawned = 0;
        this.waveTotal = CONFIG.waveBaseEnemies + (this.wave - 1) * 3;
        this.waveActive = true;
        this.waveSpawnTimer = 0;
        this.announceWave();
      }
    }
  }

  spawnEnemy() {
    const x = Math.random() * (this.canvas.width - 120) + 60;
    let type = 'basic';
    const r = Math.random();
    
    if (this.wave >= 5 && this.waveSpawned === this.waveTotal - 1) {
      type = 'boss';
    } else if (r < 0.18 && this.wave >= 2) {
      type = 'fast';
    } else if (r < 0.3 && this.wave >= 3) {
      type = 'tank';
    }
    
    this.enemies.push(new Enemy(x, -50, type));
  }

  checkCollisions() {
    // Player bullets → enemies
    for (const b of this.playerBullets) {
      if (!b.alive) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.abs(b.x - e.x) < e.width * 0.5 + b.width &&
            Math.abs(b.y - e.y) < e.height * 0.5 + b.height) {
          b.alive = false;
          // Hit sparks
          for (let i = 0; i < 4; i++) {
            this.particles.push(new Particle(b.x, b.y, {
              vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
              life: 0.4, decay: 0.05, size: 2, color: e.color
            }));
          }
          if (e.takeDamage(b.damage)) {
            this.explode(e.x, e.y, e.color, e.type === 'boss' ? 2 : 1);
            this.score += e.score * (1 + this.combo * 0.1);
            this.kills++;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.comboTimer = 2000;
            this.shake(e.type === 'boss' ? 10 : 3, 180);
            
            // Power-up drop
            if (Math.random() < 0.18) {
              const types = ['health', 'spread', 'shield'];
              this.powerUps.push(new PowerUp(e.x, e.y, types[Math.floor(Math.random() * types.length)]));
            }
          }
          break;
        }
      }
    }
    
    // Enemy bullets → player
    for (const b of this.enemyBullets) {
      if (!b.alive) continue;
      const dx = b.x - this.player.x;
      const dy = b.y - this.player.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.player.width * 0.9) {
        b.alive = false;
        if (this.player.takeDamage(b.damage)) {
          // Player destroyed
        } else {
          this.sound.hit();
        }
        this.shake(5, 120);
        for (let i = 0; i < 8; i++) {
          this.particles.push(new Particle(this.player.x, this.player.y, {
            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
            life: 0.6, decay: 0.04, size: 2.5, color: '#ff2d55'
          }));
        }
      }
    }
    
    // Enemy body → player
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.player.width + e.width * 0.4) {
        e.alive = false;
        this.player.takeDamage(25);
        this.explode(e.x, e.y, e.color);
        this.shake(7, 250);
        this.sound.hit();
      }
    }
    
    // Power-ups → player
    for (const p of this.powerUps) {
      if (!p.alive) continue;
      const dx = p.x - this.player.x;
      const dy = p.y - this.player.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.player.width + p.size) {
        p.alive = false;
        this.sound.powerUp();
        
        switch (p.type) {
          case 'health':
            this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);
            break;
          case 'spread':
            this.player.spreadShot = true;
            this.player.spreadTimer = 8000;
            break;
          case 'shield':
            this.player.shielded = true;
            this.player.shieldTimer = 6000;
            break;
        }
        
        // Pickup burst
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI * 2 / 12) * i;
          this.particles.push(new Particle(p.x, p.y, {
            vx: Math.cos(a) * 3, vy: Math.sin(a) * 3,
            life: 0.7, decay: 0.04, size: 2.5, color: p.color
          }));
        }
      }
    }
  }

  updateHUD() {
    document.getElementById('score-value').textContent = Math.floor(this.score).toLocaleString();
    document.getElementById('wave-value').textContent = this.wave;
    document.getElementById('kills-value').textContent = this.kills;
    
    const hp = this.player.health / this.player.maxHealth;
    document.getElementById('health-fill').style.width = (hp * 100) + '%';
    document.getElementById('special-fill').style.width = (this.player.special / this.player.maxSpecial * 100) + '%';
    
    const hf = document.getElementById('health-fill');
    if (hp < 0.3) {
      hf.style.background = 'linear-gradient(90deg, #ff2d55, #ff3b30)';
    } else if (hp < 0.6) {
      hf.style.background = 'linear-gradient(90deg, #ff9500, #ffcc00)';
    } else {
      hf.style.background = 'linear-gradient(90deg, #00f5ff, #34c759)';
    }
  }

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    
    ctx.save();
    
    // Screen shake
    if (this.shakeDur > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shakeAmt,
        (Math.random() - 0.5) * this.shakeAmt
      );
    }
    
    // Background
    ctx.fillStyle = '#06080f';
    ctx.fillRect(-10, -10, cw + 20, ch + 20);
    
    // Ambient nebula
    const g = ctx.createRadialGradient(cw * 0.3, ch * 0.4, 0, cw * 0.3, ch * 0.4, cw * 0.5);
    g.addColorStop(0, 'rgba(0, 80, 160, 0.06)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    
    const g2 = ctx.createRadialGradient(cw * 0.7, ch * 0.6, 0, cw * 0.7, ch * 0.6, cw * 0.4);
    g2.addColorStop(0, 'rgba(100, 0, 150, 0.04)');
    g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, cw, ch);
    
    // Stars
    this.starField.draw(ctx);
    
    // Power-ups
    for (const p of this.powerUps) p.draw(ctx);
    
    // Enemy bullets
    for (const b of this.enemyBullets) b.draw(ctx);
    
    // Enemies
    for (const e of this.enemies) e.draw(ctx);
    
    // Player bullets
    for (const b of this.playerBullets) b.draw(ctx);
    
    // Player engine trail particles
    if (this.player.alive) {
      for (let i = 0; i < 2; i++) {
        this.particles.push(new Particle(
          this.player.x + (Math.random() - 0.5) * 7,
          this.player.y + this.player.height * 0.45 + 8,
          {
            vx: (Math.random() - 0.5) * 0.8,
            vy: Math.random() * 2 + 0.8,
            life: 0.5, decay: 0.03,
            size: Math.random() * 2.5 + 0.8,
            color: Math.random() > 0.5 ? '#00f5ff' : '#0077cc'
          }
        ));
      }
      this.player.draw(ctx);
    }
    
    // Particles
    for (const p of this.particles) p.draw(ctx);
    
    ctx.restore();
  }

  gameOver() {
    this.state = 'gameover';
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    
    this.explode(this.player.x, this.player.y, '#00f5ff', 3);
    
    // Render one last frame to show explosion
    this.render();
    
    document.getElementById('final-score').textContent = Math.floor(this.score).toLocaleString();
    document.getElementById('final-waves').textContent = this.wave;
    document.getElementById('final-kills').textContent = this.kills;
    document.getElementById('final-combo').textContent = this.maxCombo + 'x';
    
    setTimeout(() => this.showScreen('gameover'), 1500);
  }
}

// ==================== INIT ====================
const game = new Game();
game.init().catch(err => {
  console.error('Game initialization failed:', err);
  const label = document.getElementById('loading-text');
  if (label) label.textContent = 'Error: ' + err.message;
});
