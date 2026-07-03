'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, RotateCcw, Volume2, VolumeX, Pause, ArrowLeft, 
  Award, Star, Lock, Trophy, HelpCircle, Zap, Volume1, ArrowRightLeft, Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface Bubble {
  x: number;
  y: number;
  colorIndex: number;
  isShielded: boolean; // Level 2/3 stretch feature: requires two hits or yields bonus
  isPopping: boolean;
  popProgress: number; // 0 to 1
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number; // current life
  maxLife: number;
  gravity?: number;
  spin?: number;
  angle?: number;
}

interface DroppedBubble {
  id: number;
  x: number;
  y: number;
  colorIndex: number;
  isShielded: boolean;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  alpha: number;
}

interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  colors: string[]; // hex values or descriptors
  colorNames: string[];
  rows: number;
  descentRate: number; // drops a row every N shots. 0 = never
  shotLimit: number | null; // null = unlimited
  winThreshold: number; // 0.8 = clear 80%, 1.0 = clear 100%
  description: string;
  layout: number[][]; // grid layout containing colorIndex or -1 for empty, colorIndex + 10 for shielded
}

// ==========================================
// COLOR PALETTE & ASSETS
// ==========================================

const BUBBLE_COLORS = [
  '#ff6b6b', // 0: Red
  '#4dabf7', // 1: Blue
  '#69db7c', // 2: Green
  '#ffd43b', // 3: Yellow
  '#b197fc', // 4: Purple
  '#ffa94d', // 5: Orange
];

const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'];

// ==========================================
// PRE-DESIGNED LEVEL LAYOUTS
// ==========================================
// Staggered grid where:
// Even rows (0, 2, 4, 6, 8) have 8 columns
// Odd rows (1, 3, 5, 7, 9) have 7 columns
// Layout grid is represented as alternating lengths:
// row 0: length 8
// row 1: length 7
// etc.
// Value -1 indicates empty cell.
// Value 0..5 indicates regular bubble color index.
// Value 10..15 indicates shielded/double bubble (color index + 10).

const LEVEL_1_LAYOUT: number[][] = [
  [0, 0, 1, 1, 2, 2, 3, 3], // row 0 (8)
  [0, 1, 1, 2, 2, 3, 3],    // row 1 (7)
  [1, -1, 2, -1, 3, -1, 0, 0], // row 2 (8)
  [-1, 2, 2, -1, 0, 0, -1],   // row 3 (7)
  [2, 2, -1, 3, 3, -1, 1, 1], // row 4 (8)
  [-1, -1, -1, -1, -1, -1, -1], // row 5 (7)
];

const LEVEL_2_LAYOUT: number[][] = [
  [14, 4, 0, 0, 1, 1, 4, 14], // row 0 (8) - index 14 is shielded Purple (4+10)
  [4, 0, 3, 3, 1, 4, 4],     // row 1 (7)
  [10, 0, -1, 2, 2, -1, 3, 13], // row 2 (8) - 10 is shielded Red, 13 is shielded Yellow
  [1, 1, 2, -1, 2, 3, 3],    // row 3 (7)
  [1, -1, -1, -1, -1, -1, -1, 1], // row 4 (8)
  [2, 2, -1, -1, -1, 0, 0],   // row 5 (7)
  [-1, -1, -1, -1, -1, -1, -1, -1], // row 6 (8)
  [-1, -1, -1, -1, -1, -1, -1], // row 7 (7)
];

const LEVEL_3_LAYOUT: number[][] = [
  [15, 0, 1, 2, 2, 1, 0, 15], // row 0 (8) - 15 is shielded Orange
  [5, 5, 4, 3, 4, 5, 5],     // row 1 (7)
  [0, 12, 1, -1, -1, 1, 12, 0], // row 2 (8)
  [11, -1, 3, 4, 3, -1, 11],   // row 3 (7)
  [-1, 2, 2, -1, -1, 2, 2, -1], // row 4 (8)
  [-1, -1, 0, 1, 0, -1, -1],   // row 5 (7)
  [-1, -1, -1, -1, -1, -1, -1, -1], // row 6 (8)
  [-1, -1, -1, -1, -1, -1, -1], // row 7 (7)
  [-1, -1, -1, -1, -1, -1, -1, -1], // row 8 (8)
  [-1, -1, -1, -1, -1, -1, -1], // row 9 (7)
];

const LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 1,
    name: "Warm Up",
    subtitle: "Level 1",
    colors: BUBBLE_COLORS.slice(0, 4),
    colorNames: COLOR_NAMES.slice(0, 4),
    rows: 6,
    descentRate: 0, // No ceiling descent
    shotLimit: null, // Unlimited shots
    winThreshold: 0.8, // Clear 80% of bubbles to win
    description: "Learn the ropes. Clear 80% of the bubble fleet! Aim carefully and bounce off the walls to reach tricky pockets.",
    layout: LEVEL_1_LAYOUT,
  },
  {
    id: 2,
    name: "Rhythm",
    subtitle: "Level 2",
    colors: BUBBLE_COLORS.slice(0, 5),
    colorNames: COLOR_NAMES.slice(0, 5),
    rows: 8,
    descentRate: 8, // Ceiling descends every 8 shots
    shotLimit: null, // Unlimited shots
    winThreshold: 1.0, // Clear 100% to win
    description: "The ceiling descends 1 row every 8 shots. Introduce shielded bubbles (steel borders) that yield double points when popped!",
    layout: LEVEL_2_LAYOUT,
  },
  {
    id: 3,
    name: "Mastery",
    subtitle: "Level 3",
    colors: BUBBLE_COLORS,
    colorNames: COLOR_NAMES,
    rows: 10,
    descentRate: 5, // Ceiling descends every 5 shots
    shotLimit: 40, // 40 shots limit
    winThreshold: 1.0, // Clear 100% to win
    description: "The ultimate trial. 6 colors, dense irregular patterns, ceiling moves down every 5 shots, and a strict limit of 40 shots!",
    layout: LEVEL_3_LAYOUT,
  }
];

// ==========================================
// SYNTHESIZER SOUND ENGINE (WEB AUDIO API)
// ==========================================
class SoundSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy initialized when user starts interacting to avoid browser auto-play warning
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (!mute) {
      this.init();
    }
  }

  getMuted() {
    return this.isMuted;
  }

  playShoot() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    // Frequency sweeps down quickly
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playPop() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Very quick high-pitch pop sound
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(1200, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playBounce() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playShieldCrack() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noise = this.ctx.createOscillator(); // we'll use a sawtooth as simple noise
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.setValueAtTime(150, now + 0.05);

    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(1000, now);
    noise.frequency.exponentialRampToValueAtTime(40, now + 0.1);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    noise.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.15);
    noise.stop(now + 0.15);
  }

  playDrop() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Series of descending little bubble slide plucks
    const notes = [320, 240, 180];
    notes.forEach((freq, idx) => {
      const time = now + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, time + 0.07);

      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.07);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(time);
      osc.stop(time + 0.07);
    });
  }

  playWin() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Elegant cheerful arpeggio (C4, E4, G4, C5)
    const pitches = [523.25, 659.25, 783.99, 1046.50];
    pitches.forEach((freq, index) => {
      const noteTime = now + index * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.25);
    });
  }

  playLose() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Descending sad tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.5);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }
}

const synth = new SoundSynth();

// ==========================================
// CORE GAME CONSTANTS
// ==========================================
const CANVAS_WIDTH = 440;
const CANVAS_HEIGHT = 600;
const BUBBLE_RADIUS = 24;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const HEX_ROW_HEIGHT = BUBBLE_RADIUS * 1.732; // Vertical distance between centers (~41.5 px)
const DANGER_LINE_Y = 480;

export default function BubbleShooterApp() {
  // Navigation Screens
  const [screen, setScreen] = useState<'start' | 'level_select' | 'playing' | 'paused' | 'win' | 'lose'>('start');
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1]);
  const [highScores, setHighScores] = useState<Record<number, number>>({});
  const [levelStars, setLevelStars] = useState<Record<number, number>>({});
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig | null>(null);

  // Audio state
  const [muted, setMuted] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Core Game State
  const [score, setScore] = useState(0);
  const [shotsFired, setShotsFired] = useState(0);
  const [shotsLeft, setShotsLeft] = useState<number | null>(null);
  const [shotsTillDescent, setShotsTillDescent] = useState<number>(0);
  const [comboCount, setComboCount] = useState(0);
  const [starsAwarded, setStarsAwarded] = useState(0);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Game Loop States & Animation Variables
  // We keep hot variables inside refs to avoid React re-render lag (60fps Canvas Loop)
  const gameStateRef = useRef({
    score: 0,
    activeLevel: LEVEL_CONFIGS[0],
    grid: [] as (Bubble | null)[][], // Hexagonal grid holding bubbles
    ceilingOffset: 0, // Pixels shifted down
    targetCeilingOffset: 0, // Target pixels for interpolation
    isCeilingMoving: false,
    
    // Shooter launcher state
    launcherX: CANVAS_WIDTH / 2,
    launcherY: 550,
    aimAngle: Math.PI / 2, // 90 degrees (facing straight up)
    loadedBubbleColorIndex: 0,
    loadedBubbleIsShielded: false,
    nextBubbleColorIndex: 1,
    nextBubbleIsShielded: false,
    
    // Active projectile bubble
    firedBubble: null as {
      x: number;
      y: number;
      vx: number;
      vy: number;
      colorIndex: number;
      isShielded: boolean;
      radius: number;
      squashX: number;
      squashY: number;
    } | null,
    
    // VFX arrays
    particles: [] as Particle[],
    droppedBubbles: [] as DroppedBubble[],
    popAnimations: [] as { r: number; c: number; x: number; y: number; progress: number; color: string }[],
    bounceEffectX: 0, // Wall hit flash / effect state
    screenShakeIntensity: 0,
    
    // Interaction
    isAiming: false,
    shotsCount: 0,
    initialTotalBubbles: 0,
    poppedBubblesCount: 0,
    gameEnded: false,
  });

  // Sound Sync state
  useEffect(() => {
    // Load local storage high scores & unlocked levels
    if (typeof window !== 'undefined') {
      const savedUnlocked = localStorage.getItem('bubble_unlocked_levels');
      if (savedUnlocked) {
        setUnlockedLevels(JSON.parse(savedUnlocked));
      }
      const savedHighScores = localStorage.getItem('bubble_highscores');
      if (savedHighScores) {
        setHighScores(JSON.parse(savedHighScores));
      }
      const savedStars = localStorage.getItem('bubble_stars');
      if (savedStars) {
        setLevelStars(JSON.parse(savedStars));
      }
    }
  }, []);

  const handleMuteToggle = () => {
    const nextMute = !muted;
    setMuted(nextMute);
    synth.setMute(nextMute);
  };

  // Safe initialize or reset a level
  const initLevel = (level: LevelConfig) => {
    const gs = gameStateRef.current;
    gs.activeLevel = level;
    gs.score = 0;
    gs.poppedBubblesCount = 0;
    gs.shotsCount = 0;
    gs.ceilingOffset = 0;
    gs.targetCeilingOffset = 0;
    gs.isCeilingMoving = false;
    gs.screenShakeIntensity = 0;
    gs.gameEnded = false;
    gs.firedBubble = null;
    gs.particles = [];
    gs.droppedBubbles = [];
    gs.popAnimations = [];

    // Generate random load/next colors from the allowed level palette
    gs.loadedBubbleColorIndex = getRandomLevelColor(level);
    gs.loadedBubbleIsShielded = Math.random() < 0.12; // 12% chance of shielded loader
    gs.nextBubbleColorIndex = getRandomLevelColor(level);
    gs.nextBubbleIsShielded = Math.random() < 0.12;

    // Load custom layouts
    const newGrid: (Bubble | null)[][] = [];
    let initialCount = 0;

    for (let r = 0; r < level.layout.length; r++) {
      const colCount = r % 2 === 0 ? 8 : 7;
      const rowBubbles: (Bubble | null)[] = [];
      for (let c = 0; c < colCount; c++) {
        const cellValue = level.layout[r][c];
        if (cellValue === -1) {
          rowBubbles.push(null);
        } else {
          // Check if value is >= 10, meaning shielded bubble
          const isShielded = cellValue >= 10;
          const finalColorIndex = isShielded ? (cellValue - 10) : cellValue;
          
          // Compute logical center coordinates
          const coords = getCellCenter(r, c, 0);
          rowBubbles.push({
            x: coords.x,
            y: coords.y,
            colorIndex: finalColorIndex,
            isShielded,
            isPopping: false,
            popProgress: 0,
          });
          initialCount++;
        }
      }
      newGrid.push(rowBubbles);
    }
    
    // Add 8 additional empty rows at the bottom for safety/play space
    for (let r = level.layout.length; r < level.layout.length + 8; r++) {
      const colCount = r % 2 === 0 ? 8 : 7;
      const rowBubbles: (Bubble | null)[] = [];
      for (let c = 0; c < colCount; c++) {
        rowBubbles.push(null);
      }
      newGrid.push(rowBubbles);
    }

    gs.grid = newGrid;
    gs.initialTotalBubbles = initialCount;

    // Update React display states
    setScore(0);
    setShotsFired(0);
    setShotsLeft(level.shotLimit);
    setShotsTillDescent(level.descentRate);
    setComboCount(0);
    setSelectedLevel(level);
    setScreen('playing');
  };

  const getRandomLevelColor = (level: LevelConfig): number => {
    return Math.floor(Math.random() * level.colors.length);
  };

  // Helper: Get hex center coords of r, c
  const getCellCenter = (r: number, c: number, ceilingOffset: number) => {
    // Total physical width of playboard is 440
    // Bubble diameter is 48 (R = 24)
    // 8 bubbles in an even row = 8 * 48 = 384px.
    // Margin on each side: (440 - 384) / 2 = 28px.
    const startXEven = 28 + BUBBLE_RADIUS; // 52
    const startXOdd = startXEven + BUBBLE_RADIUS; // 52 + 24 = 76
    
    const cy = BUBBLE_RADIUS + r * HEX_ROW_HEIGHT + ceilingOffset;
    const cx = (r % 2 === 0) 
      ? startXEven + c * BUBBLE_DIAMETER 
      : startXOdd + c * BUBBLE_DIAMETER;
      
    return { x: cx, y: cy };
  };

  // Hex grid adjacent neighbor coordinates
  const getNeighbors = (r: number, c: number, grid: (Bubble | null)[][]) => {
    const neighbors: { r: number; c: number }[] = [];
    const maxCols = r % 2 === 0 ? 8 : 7;

    // Direct left and right
    if (c > 0) neighbors.push({ r, c: c - 1 });
    if (c < maxCols - 1) neighbors.push({ r, c: c + 1 });

    // Top and bottom neighbors depend on whether row is even or odd
    const topRow = r - 1;
    const bottomRow = r + 1;

    if (r % 2 === 0) {
      // Even row: Top is row - 1, column indexes: c - 1, c
      // Top row is odd (length 7). So columns are c-1 and c.
      if (topRow >= 0) {
        if (c - 1 >= 0) neighbors.push({ r: topRow, c: c - 1 });
        if (c < 7) neighbors.push({ r: topRow, c });
      }
      // Bottom row is odd (length 7)
      if (bottomRow < grid.length) {
        if (c - 1 >= 0) neighbors.push({ r: bottomRow, c: c - 1 });
        if (c < 7) neighbors.push({ r: bottomRow, c });
      }
    } else {
      // Odd row: Top is row - 1, column indexes: c, c + 1
      // Top row is even (length 8). Columns are c and c+1.
      if (topRow >= 0) {
        neighbors.push({ r: topRow, c });
        if (c + 1 < 8) neighbors.push({ r: topRow, c: c + 1 });
      }
      // Bottom row is even (length 8)
      if (bottomRow < grid.length) {
        neighbors.push({ r: bottomRow, c });
        if (c + 1 < 8) neighbors.push({ r: bottomRow, c: c + 1 });
      }
    }

    return neighbors;
  };

  // Swap current loaded bubble with next preview
  const swapBubbles = () => {
    if (gameStateRef.current.firedBubble) return; // Cannot swap while projectile is active
    
    const gs = gameStateRef.current;
    const tempColor = gs.loadedBubbleColorIndex;
    const tempShielded = gs.loadedBubbleIsShielded;

    gs.loadedBubbleColorIndex = gs.nextBubbleColorIndex;
    gs.loadedBubbleIsShielded = gs.nextBubbleIsShielded;

    gs.nextBubbleColorIndex = tempColor;
    gs.nextBubbleIsShielded = tempShielded;

    synth.playBounce();
    // Quick state refresh to force component redraw for swapping graphic
    setShotsFired(prev => prev);
  };

  // Launch currently loaded bubble
  const fireProjectile = () => {
    const gs = gameStateRef.current;
    if (gs.firedBubble || gs.gameEnded || screen !== 'playing') return;

    // Check shot count limit
    if (gs.activeLevel.shotLimit !== null) {
      const remaining = gs.activeLevel.shotLimit - gs.shotsCount;
      if (remaining <= 0) return;
    }

    // Aim angle logic (already clamped between 10 deg and 170 deg)
    const speed = 14;
    const vx = Math.cos(gs.aimAngle) * speed;
    const vy = -Math.sin(gs.aimAngle) * speed; // Negative because Canvas y increases downwards

    gs.firedBubble = {
      x: gs.launcherX,
      y: gs.launcherY - 32,
      vx,
      vy,
      colorIndex: gs.loadedBubbleColorIndex,
      isShielded: gs.loadedBubbleIsShielded,
      radius: BUBBLE_RADIUS,
      squashX: 1.15, // Launch squeeze!
      squashY: 0.85,
    };

    gs.shotsCount++;
    setShotsFired(gs.shotsCount);

    if (gs.activeLevel.shotLimit !== null) {
      setShotsLeft(gs.activeLevel.shotLimit - gs.shotsCount);
    }

    // Descent rate calculation
    if (gs.activeLevel.descentRate > 0) {
      const countdown = gs.activeLevel.descentRate - (gs.shotsCount % gs.activeLevel.descentRate);
      setShotsTillDescent(countdown === gs.activeLevel.descentRate ? 0 : countdown);
    }

    // Play synthesized sound
    synth.playShoot();

    // Rotate bubble colors in launcher
    gs.loadedBubbleColorIndex = gs.nextBubbleColorIndex;
    gs.loadedBubbleIsShielded = gs.nextBubbleIsShielded;
    
    gs.nextBubbleColorIndex = getRandomLevelColor(gs.activeLevel);
    gs.nextBubbleIsShielded = Math.random() < 0.12; // 12% shielded rate
  };

  // ==========================================
  // FLOOD FILL MATCH & POPPING
  // ==========================================
  const resolveMatchAndFloating = (snapRow: number, snapCol: number) => {
    const gs = gameStateRef.current;
    const snappedBubble = gs.grid[snapRow]?.[snapCol];
    if (!snappedBubble) return;

    const targetColor = snappedBubble.colorIndex;
    const matchCluster: { r: number; c: number }[] = [];
    const queue: { r: number; c: number }[] = [{ r: snapRow, c: snapCol }];
    const visited = new Set<string>();
    visited.add(`${snapRow},${snapCol}`);

    // BFS to find all connected bubbles of identical color
    while (queue.length > 0) {
      const current = queue.shift()!;
      matchCluster.push(current);

      const neighbors = getNeighbors(current.r, current.c, gs.grid);
      for (const n of neighbors) {
        const neighborBubble = gs.grid[n.r]?.[n.c];
        if (neighborBubble && !neighborBubble.isPopping) {
          // If it matches color (or is a shielded bubble of identical baseline color)
          if (neighborBubble.colorIndex === targetColor && !visited.has(`${n.r},${n.c}`)) {
            visited.add(`${n.r},${n.c}`);
            queue.push(n);
          }
        }
      }
    }

    // Trigger match results if cluster is 3 or more bubbles
    if (matchCluster.length >= 3) {
      let basePoints = matchCluster.length * 10;
      let multiplier = 1.0;
      if (matchCluster.length === 4) multiplier = 1.5;
      else if (matchCluster.length >= 5) multiplier = 2.0;

      let scoreGain = Math.round(basePoints * multiplier);
      let shieldedBusted = 0;

      // Shake screen proportionally
      gs.screenShakeIntensity = Math.min(6, 2 + matchCluster.length * 0.8);

      // Pop bubbles
      matchCluster.forEach(cell => {
        const bubble = gs.grid[cell.r]?.[cell.c];
        if (bubble) {
          // Create pop animation visual trigger
          gs.popAnimations.push({
            r: cell.r,
            c: cell.c,
            x: bubble.x,
            y: bubble.y,
            progress: 0,
            color: gs.activeLevel.colors[bubble.colorIndex],
          });

          // Create a cloud of tiny shiny burst particles
          for (let p = 0; p < 12; p++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = 2 + Math.random() * 4;
            gs.particles.push({
              id: Math.random(),
              x: bubble.x,
              y: bubble.y,
              vx: Math.cos(angle) * velocity,
              vy: Math.sin(angle) * velocity,
              color: gs.activeLevel.colors[bubble.colorIndex],
              size: 3 + Math.random() * 4,
              alpha: 1,
              life: 0,
              maxLife: 24 + Math.random() * 16,
              gravity: 0.08,
            });
          }

          if (bubble.isShielded) {
            shieldedBusted++;
            scoreGain += 100; // Shield bubble bonus
          }

          gs.grid[cell.r][cell.c] = null; // Clear from grid
          gs.poppedBubblesCount++;
        }
      });

      // Play synthesized pop sound
      synth.playPop();
      if (shieldedBusted > 0) {
        setTimeout(() => synth.playShieldCrack(), 50);
      }

      gs.score += scoreGain;
      setScore(gs.score);
      setComboCount(prev => prev + 1);

      // Now process floating/disconnected bubble drops!
      processFloatingDrops();
    } else {
      // Reset combo counters on a non-match
      setComboCount(0);
    }
  };

  const processFloatingDrops = () => {
    const gs = gameStateRef.current;
    
    // Step 1: run BFS from the ceiling (row 0) to find all connected bubbles
    const visited = new Set<string>();
    const queue: { r: number; c: number }[] = [];

    // All active bubbles in row 0 are anchors connected to ceiling
    const colCountRow0 = 8; // Row 0 is even, has 8 columns
    for (let c = 0; c < colCountRow0; c++) {
      if (gs.grid[0]?.[c]) {
        queue.push({ r: 0, c });
        visited.add(`0,${c}`);
      }
    }

    // Standard BFS traversal
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = getNeighbors(current.r, current.c, gs.grid);
      
      for (const n of neighbors) {
        if (gs.grid[n.r]?.[n.c] && !visited.has(`${n.r},${n.c}`)) {
          visited.add(`${n.r},${n.c}`);
          queue.push(n);
        }
      }
    }

    // Step 2: identify any active bubble NOT visited (it means they are floating!)
    let dropCount = 0;
    for (let r = 0; r < gs.grid.length; r++) {
      const cols = r % 2 === 0 ? 8 : 7;
      for (let c = 0; c < cols; c++) {
        const bubble = gs.grid[r]?.[c];
        if (bubble && !visited.has(`${r},${c}`)) {
          // It's floating! Drop it!
          gs.droppedBubbles.push({
            id: Math.random(),
            x: bubble.x,
            y: bubble.y,
            colorIndex: bubble.colorIndex,
            isShielded: bubble.isShielded,
            vx: -2 + Math.random() * 4,
            vy: -1 - Math.random() * 3, // Slight jump up first for juicy floaty physics
            rotation: Math.random() * Math.PI,
            spin: -0.1 + Math.random() * 0.2,
            alpha: 1,
          });

          // Particle puff
          for (let p = 0; p < 4; p++) {
            gs.particles.push({
              id: Math.random(),
              x: bubble.x,
              y: bubble.y,
              vx: -1 + Math.random() * 2,
              vy: Math.random() * 2,
              color: 'rgba(255,255,255,0.4)',
              size: 2 + Math.random() * 3,
              alpha: 0.8,
              life: 0,
              maxLife: 20,
            });
          }

          gs.grid[r][c] = null; // Clear cell
          gs.poppedBubblesCount++;
          dropCount++;
        }
      }
    }

    if (dropCount > 0) {
      // Big drop points (20 per drop)
      const bonus = dropCount * 20;
      gs.score += bonus;
      setScore(gs.score);
      synth.playDrop();
    }
  };

  // Shift entire ceiling down by one row height (e.g. 42px)
  const descendCeiling = () => {
    const gs = gameStateRef.current;
    gs.targetCeilingOffset += HEX_ROW_HEIGHT;
    gs.isCeilingMoving = true;
    gs.screenShakeIntensity = 4;
    synth.playBounce();

    // Check if any bubble exceeds danger line after shifting
    // (This is also checked continuously in the update loop)
  };

  // Triggered when a level is cleared or lost
  const endLevel = (isWin: boolean) => {
    const gs = gameStateRef.current;
    if (gs.gameEnded) return;
    gs.gameEnded = true;

    if (isWin) {
      // Calculate star count (1 to 3 stars)
      let stars = 1;
      
      // Dynamic star thresholds based on level
      if (gs.activeLevel.id === 1) {
        if (gs.score >= 500) stars = 3;
        else if (gs.score >= 300) stars = 2;
      } else if (gs.activeLevel.id === 2) {
        if (gs.score >= 900) stars = 3;
        else if (gs.score >= 550) stars = 2;
      } else {
        // Level 3 mastery
        if (gs.score >= 1200) stars = 3;
        else if (gs.score >= 750) stars = 2;
      }

      setStarsAwarded(stars);

      // Save high scores and stars in Local Storage
      const currentHighScore = highScores[gs.activeLevel.id] || 0;
      const updatedHighScores = { ...highScores };
      if (gs.score > currentHighScore) {
        updatedHighScores[gs.activeLevel.id] = gs.score;
        setHighScores(updatedHighScores);
        localStorage.setItem('bubble_highscores', JSON.stringify(updatedHighScores));
      }

      const currentStars = levelStars[gs.activeLevel.id] || 0;
      const updatedStars = { ...levelStars };
      if (stars > currentStars) {
        updatedStars[gs.activeLevel.id] = stars;
        setLevelStars(updatedStars);
        localStorage.setItem('bubble_stars', JSON.stringify(updatedStars));
      }

      // Unlock next level sequentially
      const nextLevelId = gs.activeLevel.id + 1;
      if (LEVEL_CONFIGS.some(lvl => lvl.id === nextLevelId)) {
        if (!unlockedLevels.includes(nextLevelId)) {
          const updatedUnlocked = [...unlockedLevels, nextLevelId];
          setUnlockedLevels(updatedUnlocked);
          localStorage.setItem('bubble_unlocked_levels', JSON.stringify(updatedUnlocked));
        }
      }

      synth.playWin();
      setScreen('win');
    } else {
      synth.playLose();
      setScreen('lose');
    }
  };

  // ==========================================
  // CANVAS ANIMATION & PHYSICS LOOP
  // ==========================================
  useEffect(() => {
    if (screen !== 'playing') return;

    let animId: number;
    const gs = gameStateRef.current;

    const gameLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      updatePhysics();
      renderGame(ctx);
      animId = requestAnimationFrame(gameLoop);
    };

    // --- GAME PHYSICS & COLLISION RESOLUTION ---
    const updatePhysics = () => {
      // Screen shake decay
      if (gs.screenShakeIntensity > 0) {
        gs.screenShakeIntensity *= 0.9;
        if (gs.screenShakeIntensity < 0.1) gs.screenShakeIntensity = 0;
      }

      // Interpolate ceiling offset descent
      if (gs.isCeilingMoving) {
        if (gs.ceilingOffset < gs.targetCeilingOffset) {
          gs.ceilingOffset += 1.5; // Smooth slide speed
          // Update visual heights of all grid bubbles
          for (let r = 0; r < gs.grid.length; r++) {
            const cols = r % 2 === 0 ? 8 : 7;
            for (let c = 0; c < cols; c++) {
              const b = gs.grid[r]?.[c];
              if (b) {
                b.y = getCellCenter(r, c, gs.ceilingOffset).y;
              }
            }
          }
        } else {
          gs.ceilingOffset = gs.targetCeilingOffset;
          gs.isCeilingMoving = false;
        }
      }

      // Projectile Bubble updates
      const pb = gs.firedBubble;
      if (pb) {
        // Recover squash scale back to circular 1.0
        pb.squashX += (1.0 - pb.squashX) * 0.1;
        pb.squashY += (1.0 - pb.squashY) * 0.1;

        pb.x += pb.vx;
        pb.y += pb.vy;

        // Bounce off left/right walls
        if (pb.x - BUBBLE_RADIUS <= 0) {
          pb.x = BUBBLE_RADIUS;
          pb.vx = -pb.vx;
          synth.playBounce();
          gs.bounceEffectX = 1.0; // Left wall bounce VFX flash
        } else if (pb.x + BUBBLE_RADIUS >= CANVAS_WIDTH) {
          pb.x = CANVAS_WIDTH - BUBBLE_RADIUS;
          pb.vx = -pb.vx;
          synth.playBounce();
          gs.bounceEffectX = -1.0; // Right wall bounce VFX flash
        }

        // Left/right bounce visual flash fadeout
        if (gs.bounceEffectX !== 0) {
          gs.bounceEffectX *= 0.85;
          if (Math.abs(gs.bounceEffectX) < 0.05) gs.bounceEffectX = 0;
        }

        // Ceiling collision detection
        const topBoundary = BUBBLE_RADIUS + gs.ceilingOffset;
        let didCollide = false;
        let snapRow = -1;
        let snapCol = -1;

        if (pb.y - BUBBLE_RADIUS <= topBoundary) {
          didCollide = true;
        } else {
          // Check collision with all settled grid bubbles
          // We check row-by-row
          for (let r = 0; r < gs.grid.length; r++) {
            const cols = r % 2 === 0 ? 8 : 7;
            for (let c = 0; c < cols; c++) {
              const settled = gs.grid[r]?.[c];
              if (settled && !settled.isPopping) {
                const dx = pb.x - settled.x;
                const dy = pb.y - settled.y;
                const distSq = dx * dx + dy * dy;
                // Double radius squared with slight overlap margin for clean fits
                const collisionDist = BUBBLE_DIAMETER - 4;
                if (distSq <= collisionDist * collisionDist) {
                  didCollide = true;
                  break;
                }
              }
            }
            if (didCollide) break;
          }
        }

        if (didCollide) {
          // Snap bubble to nearest open hex cell
          let minDist = Infinity;
          
          // Check closest cell in any row
          for (let r = 0; r < gs.grid.length; r++) {
            const cols = r % 2 === 0 ? 8 : 7;
            for (let c = 0; c < cols; c++) {
              if (gs.grid[r][c] === null) {
                const cellCenter = getCellCenter(r, c, gs.ceilingOffset);
                const dx = pb.x - cellCenter.x;
                const dy = pb.y - cellCenter.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDist) {
                  minDist = distSq;
                  snapRow = r;
                  snapCol = c;
                }
              }
            }
          }

          if (snapRow !== -1 && snapCol !== -1) {
            const coords = getCellCenter(snapRow, snapCol, gs.ceilingOffset);
            gs.grid[snapRow][snapCol] = {
              x: coords.x,
              y: coords.y,
              colorIndex: pb.colorIndex,
              isShielded: pb.isShielded,
              isPopping: false,
              popProgress: 0,
            };

            // Remove projectile
            gs.firedBubble = null;

            // Resolve match chain pops
            resolveMatchAndFloating(snapRow, snapCol);

            // Level Complete / Descent checks
            checkEndTurnConditions();
          } else {
            // Failsafe: if grid was completely packed and couldn't find a spot, end game
            gs.firedBubble = null;
            endLevel(false);
          }
        }

        // Out of bounds safety
        if (pb.y < -50 || pb.y > CANVAS_HEIGHT + 50) {
          gs.firedBubble = null;
        }
      }

      // Update flying particles
      for (let i = gs.particles.length - 1; i >= 0; i--) {
        const p = gs.particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        if (p.gravity) p.vy += p.gravity;
        p.alpha = 1.0 - p.life / p.maxLife;

        if (p.life >= p.maxLife) {
          gs.particles.splice(i, 1);
        }
      }

      // Update dropped falling bubbles
      for (let i = gs.droppedBubbles.length - 1; i >= 0; i--) {
        const db = gs.droppedBubbles[i];
        db.x += db.vx;
        db.y += db.vy;
        db.vy += 0.3; // Gravity acceleration
        db.rotation += db.spin;
        db.alpha = Math.max(0, db.alpha - 0.02);

        // Remove if off screen or fully faded
        if (db.y > CANVAS_HEIGHT + 30 || db.alpha <= 0) {
          gs.droppedBubbles.splice(i, 1);
        }
      }

      // Check for danger line crossings continuously
      // If any active bubble center is below the danger line, visual warning triggers.
      // At the end of a turn, check if they remained below the line.
    };

    const checkEndTurnConditions = () => {
      const gs = gameStateRef.current;

      // Count remaining bubbles
      let remainingCount = 0;
      let hasCrossedDangerLine = false;

      for (let r = 0; r < gs.grid.length; r++) {
        const cols = r % 2 === 0 ? 8 : 7;
        for (let c = 0; c < cols; c++) {
          const b = gs.grid[r]?.[c];
          if (b) {
            remainingCount++;
            if (b.y >= DANGER_LINE_Y) {
              hasCrossedDangerLine = true;
            }
          }
        }
      }

      // 1. Check Win Threshold
      const clearedFraction = (gs.initialTotalBubbles - remainingCount) / gs.initialTotalBubbles;
      if (clearedFraction >= gs.activeLevel.winThreshold || remainingCount === 0) {
        endLevel(true);
        return;
      }

      // 2. Check Ceiling Descent triggering
      if (gs.activeLevel.descentRate > 0 && gs.shotsCount > 0 && gs.shotsCount % gs.activeLevel.descentRate === 0) {
        descendCeiling();
      }

      // 3. Check Lose condition: any bubble resting below danger line
      // Note: we re-verify after ceiling animations finish or immediately
      if (hasCrossedDangerLine) {
        endLevel(false);
        return;
      }

      // 4. Check Lose condition: out of shots in Level 3
      if (gs.activeLevel.shotLimit !== null && gs.shotsCount >= gs.activeLevel.shotLimit) {
        if (remainingCount > 0) {
          endLevel(false);
        }
      }
    };

    // --- PREMIUM ARTISTIC RENDERING LOOP ---
    const renderGame = (c: CanvasRenderingContext2D) => {
      const pb = gs.firedBubble;
      c.save();

      // Screen Shake effect
      if (gs.screenShakeIntensity > 0) {
        const shakeX = (Math.random() - 0.5) * gs.screenShakeIntensity;
        const shakeY = (Math.random() - 0.5) * gs.screenShakeIntensity;
        c.translate(shakeX, shakeY);
      }

      // Clean canvas background
      c.fillStyle = '#0f172a'; // Deep Navy Slate
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw subtle background neon horizontal grid line markings
      c.strokeStyle = 'rgba(51, 65, 85, 0.25)';
      c.lineWidth = 1;
      for (let y = 40; y < CANVAS_HEIGHT; y += 40) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(CANVAS_WIDTH, y);
        c.stroke();
      }

      // Draw Ceiling Wall Anchor area
      c.fillStyle = '#1e293b';
      c.fillRect(0, 0, CANVAS_WIDTH, gs.ceilingOffset);
      
      // Ceiling accent line
      c.strokeStyle = '#38bdf8'; // Cyan ceiling border
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, gs.ceilingOffset);
      c.lineTo(CANVAS_WIDTH, gs.ceilingOffset);
      c.stroke();

      // Wall bounce flashing VFX
      if (gs.bounceEffectX !== 0) {
        c.fillStyle = `rgba(56, 189, 248, ${Math.abs(gs.bounceEffectX) * 0.2})`;
        if (gs.bounceEffectX > 0) {
          // Flash left border
          c.fillRect(0, 0, 15, CANVAS_HEIGHT);
        } else {
          // Flash right border
          c.fillRect(CANVAS_WIDTH - 15, 0, 15, CANVAS_HEIGHT);
        }
      }

      // Draw Danger Line (Neonly blinking)
      const blinkAlpha = 0.4 + Math.sin(Date.now() / 150) * 0.25;
      c.strokeStyle = `rgba(239, 68, 68, ${blinkAlpha})`;
      c.lineWidth = 2;
      c.setLineDash([8, 6]);
      c.beginPath();
      c.moveTo(0, DANGER_LINE_Y);
      c.lineTo(CANVAS_WIDTH, DANGER_LINE_Y);
      c.stroke();
      c.setLineDash([]); // Reset line dash

      // "DANGER ZONE" Text Overlay in margin
      c.fillStyle = `rgba(239, 68, 68, ${blinkAlpha * 0.8})`;
      c.font = "bold 10px sans-serif";
      c.fillText("DANGER BORDER", 15, DANGER_LINE_Y - 8);

      // Draw Dotted Laser Trajectory Line
      drawTrajectory(c);

      // Draw Settled Bubbles in Grid
      for (let r = 0; r < gs.grid.length; r++) {
        const cols = r % 2 === 0 ? 8 : 7;
        for (let col = 0; col < cols; col++) {
          const b = gs.grid[r]?.[col];
          if (b && !b.isPopping) {
            drawBubbleGraphic(c, b.x, b.y, b.colorIndex, b.isShielded, 1.0, 1.0);
          }
        }
      }

      // Draw Projectile Bubble
      if (pb) {
        drawBubbleGraphic(c, pb.x, pb.y, pb.colorIndex, pb.isShielded, pb.squashX, pb.squashY);
      }

      // Draw Dropped falling bubbles
      for (const db of gs.droppedBubbles) {
        c.save();
        c.globalAlpha = db.alpha;
        c.translate(db.x, db.y);
        c.rotate(db.rotation);
        drawBubbleGraphic(c, 0, 0, db.colorIndex, db.isShielded, 1.0, 1.0);
        c.restore();
      }

      // Draw VFX Particles
      for (const p of gs.particles) {
        c.save();
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      // Draw Launcher Base Pod
      drawLauncherPod(c);

      c.restore();
    };

    // Draw the launcher machine at bottom-center
    const drawLauncherPod = (c: CanvasRenderingContext2D) => {
      const gs = gameStateRef.current;
      const lx = gs.launcherX;
      const ly = gs.launcherY;

      c.save();

      // Launch Arrow Indicator ring
      c.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      c.lineWidth = 1.5;
      c.setLineDash([4, 4]);
      c.beginPath();
      c.arc(lx, ly - 32, 54, Math.PI, 0);
      c.stroke();
      c.setLineDash([]);

      // Draw rotating launcher pointer arm
      c.save();
      c.translate(lx, ly - 32);
      c.rotate(-gs.aimAngle + Math.PI / 2); // Rotate to reflect aiming angle

      // Metallic nozzle arm
      const nozzleGrad = c.createLinearGradient(-14, -20, 14, -20);
      nozzleGrad.addColorStop(0, '#475569');
      nozzleGrad.addColorStop(0.5, '#94a3b8');
      nozzleGrad.addColorStop(1, '#334155');

      c.fillStyle = nozzleGrad;
      c.beginPath();
      c.roundRect(-14, -48, 28, 48, [6, 6, 0, 0]);
      c.fill();

      // Cyan scope strip
      c.fillStyle = '#06b6d4';
      c.fillRect(-2, -44, 4, 30);

      c.restore();

      // Launcher central dome / loader
      const domeGrad = c.createRadialGradient(lx, ly, 10, lx, ly, 45);
      domeGrad.addColorStop(0, '#1e293b');
      domeGrad.addColorStop(1, '#0f172a');

      c.fillStyle = domeGrad;
      c.strokeStyle = '#475569';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(lx, ly, 42, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Draw loaded bubble inside the loader dome
      if (!gs.firedBubble) {
        drawBubbleGraphic(c, lx, ly - 32, gs.loadedBubbleColorIndex, gs.loadedBubbleIsShielded, 1.0, 1.0);
      }

      // Draw swap indicator label or preview bubble nearby
      // We will draw next bubble on the left
      const nextX = lx - 75;
      const nextY = ly + 4;
      
      // Label "NEXT"
      c.fillStyle = '#94a3b8';
      c.font = '10px sans-serif';
      c.textAlign = 'center';
      c.fillText("NEXT", nextX, nextY - 24);

      // Next bubble preview circle frame
      c.fillStyle = 'rgba(30, 41, 59, 0.7)';
      c.strokeStyle = '#334155';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(nextX, nextY, 20, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Tiny version of the next bubble
      drawBubbleGraphic(c, nextX, nextY, gs.nextBubbleColorIndex, gs.nextBubbleIsShielded, 0.75, 0.75);

      // Quick swap arrow overlay design in-between
      c.fillStyle = '#64748b';
      c.font = 'bold 11px sans-serif';
      c.fillText("⇄", lx - 44, ly - 2);

      c.restore();
    };

    // Calculate bouncing dotted trajectory line
    const drawTrajectory = (c: CanvasRenderingContext2D) => {
      const gs = gameStateRef.current;
      if (gs.firedBubble) return; // Hide trajectory while bubble is in mid-air

      let tx = gs.launcherX;
      let ty = gs.launcherY - 32;
      let angle = gs.aimAngle;
      let tdx = Math.cos(angle);
      let tdy = -Math.sin(angle);

      c.save();
      c.fillStyle = 'rgba(255, 255, 255, 0.4)';
      
      // Custom trace sequence up to 3 bounces or ceiling hit
      let stepSize = 12;
      let bounceCount = 0;
      let maxDots = 30;
      let dotCounter = 0;

      while (dotCounter < maxDots && bounceCount < 3) {
        tx += tdx * stepSize;
        ty += tdy * stepSize;

        // Bounce off left/right walls
        if (tx - BUBBLE_RADIUS <= 0) {
          tx = BUBBLE_RADIUS;
          tdx = -tdx;
          bounceCount++;
        } else if (tx + BUBBLE_RADIUS >= CANVAS_WIDTH) {
          tx = CANVAS_WIDTH - BUBBLE_RADIUS;
          tdx = -tdx;
          bounceCount++;
        }

        // Draw dotted point
        // Size scales down along the trajectory length
        const dotR = Math.max(1.5, 3.5 - (dotCounter / maxDots) * 2);
        
        // Use matching color of loaded bubble with low opacity for gorgeous theme sync
        c.fillStyle = `${gs.activeLevel.colors[gs.loadedBubbleColorIndex]}bb`;

        c.beginPath();
        c.arc(tx, ty, dotR, 0, Math.PI * 2);
        c.fill();

        // Stop tracing if we hit settled bubbles or ceiling
        let hit = false;
        if (ty - BUBBLE_RADIUS <= BUBBLE_RADIUS + gs.ceilingOffset) {
          hit = true;
        } else {
          // Check collision with settle grid
          for (let r = 0; r < gs.grid.length; r++) {
            const cols = r % 2 === 0 ? 8 : 7;
            for (let c = 0; c < cols; c++) {
              const b = gs.grid[r]?.[c];
              if (b && !b.isPopping) {
                const dx = tx - b.x;
                const dy = ty - b.y;
                if (dx * dx + dy * dy < BUBBLE_DIAMETER * BUBBLE_DIAMETER) {
                  hit = true;
                  break;
                }
              }
            }
            if (hit) break;
          }
        }

        if (hit) break;
        dotCounter++;
      }

      c.restore();
    };

    // Helper: Draw 3D glossy gorgeous bubble circle
    const drawBubbleGraphic = (
      c: CanvasRenderingContext2D, 
      cx: number, 
      cy: number, 
      colorIndex: number, 
      isShielded: boolean,
      scaleX: number,
      scaleY: number
    ) => {
      const gs = gameStateRef.current;
      const baseColor = gs.activeLevel.colors[colorIndex] || '#94a3b8';
      const actualRadius = BUBBLE_RADIUS * (scaleX + scaleY) / 2;

      c.save();
      c.translate(cx, cy);
      c.scale(scaleX, scaleY);

      // Draw outer shiny halo glow
      c.shadowBlur = 4;
      c.shadowColor = baseColor;

      // Draw bubble glossy 3D body
      const grad = c.createRadialGradient(-6, -6, 2, 0, 0, BUBBLE_RADIUS);
      grad.addColorStop(0, '#ffffff'); // Center shine highlight
      grad.addColorStop(0.18, baseColor); // Actual bubble color
      grad.addColorStop(0.85, darkenColor(baseColor, 35)); // Deep shadows on outline
      grad.addColorStop(1, darkenColor(baseColor, 55));

      c.fillStyle = grad;
      c.beginPath();
      c.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
      c.fill();

      // Reset shadow
      c.shadowBlur = 0;

      // Top light glossy crescent reflection
      c.fillStyle = 'rgba(255, 255, 255, 0.45)';
      c.beginPath();
      c.ellipse(-5, -7, 6, 3, Math.PI / -6, 0, Math.PI * 2);
      c.fill();

      // Bottom rim translucent bounce highlight
      c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(3, 5, BUBBLE_RADIUS * 0.7, 0.1 * Math.PI, 0.8 * Math.PI);
      c.stroke();

      // LEVEL 2/3 STRETCH: Shield / Double Bubble outline
      if (isShielded) {
        c.strokeStyle = '#e2e8f0'; // Clean steel-metallic rim
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, BUBBLE_RADIUS - 1.5, 0, Math.PI * 2);
        c.stroke();

        // Outer bolt locks to make it look shielded
        c.fillStyle = '#94a3b8';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          const bx = Math.cos(a) * (BUBBLE_RADIUS - 1);
          const by = Math.sin(a) * (BUBBLE_RADIUS - 1);
          c.beginPath();
          c.arc(bx, by, 2.5, 0, Math.PI * 2);
          c.fill();
        }

        // Mini iron shield symbol inside
        c.fillStyle = '#cbd5e1';
        c.font = 'bold 9px sans-serif';
        c.textAlign = 'center';
        c.fillText("🛡", 0, 3);
      }

      c.restore();
    };

    // Utility: Darken colors for canvas 3D effect
    const darkenColor = (hex: string, percent: number) => {
      let num = parseInt(hex.replace("#",""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) - amt,
      G = (num >> 8 & 0x00FF) - amt,
      B = (num & 0x0000FF) - amt;
      return "#" + (0x1000000 + (R<0?0:R>255?255:R)*0x10000 + (G<0?0:G>255?255:G)*0x100 + (B<0?0:B>255?255:B)).toString(16).slice(1);
    };

    // Start running Loop
    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [screen, selectedLevel]);

  // ==========================================
  // INPUT & CONTROLS HANDLERS
  // ==========================================
  
  // Maps mouse movement or finger touch to launcher aiming angle
  const handleAim = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || screen !== 'playing' || gameStateRef.current.gameEnded) return;

    const rect = canvas.getBoundingClientRect();
    // Translate click position to logical coordinates (440 x 600 scale)
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;

    const gs = gameStateRef.current;
    const dx = clickX - gs.launcherX;
    const dy = (gs.launcherY - 32) - clickY; // Distance up from launcher center

    // Calculate angle in radians
    let angle = Math.atan2(dy, dx);

    // Limit angle to prevent shooting sideways or backwards (~12 deg to ~168 deg)
    const minAngle = 12 * Math.PI / 180;
    const maxAngle = 168 * Math.PI / 180;

    if (angle < minAngle) {
      // If pointer is below horizontal, keep inside limits based on quadrant
      if (dx > 0) angle = minAngle;
      else angle = maxAngle;
    } else if (angle > maxAngle) {
      angle = maxAngle;
    }

    gs.aimAngle = angle;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleAim(e.clientX, e.clientY);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleAim(e.clientX, e.clientY);
    fireProjectile();
  };

  // Touch screen listeners
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      if (e.cancelable) e.preventDefault();
      handleAim(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      if (e.cancelable) e.preventDefault();
      handleAim(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    fireProjectile();
  };

  // Keyboard navigation support: Left/Right arrows to aim, Space to shoot!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'playing') return;
      const gs = gameStateRef.current;
      if (gs.gameEnded) return;

      const angleStep = 0.05; // speed of arrow rotation
      const minAngle = 12 * Math.PI / 180;
      const maxAngle = 168 * Math.PI / 180;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        gs.aimAngle = Math.min(maxAngle, gs.aimAngle + angleStep);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        gs.aimAngle = Math.max(minAngle, gs.aimAngle - angleStep);
      } else if (e.key === ' ' || e.key === 'Enter') {
        fireProjectile();
        e.preventDefault(); // Prevent spacebar scrolling page
      } else if (e.key === 's' || e.key === 'S' || e.key === 'Shift') {
        swapBubbles();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen]);

  // ==========================================
  // VIEW RENDERS (MENUS, HUD, OVERLAYS)
  // ==========================================

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_center,#1e293b_0%,#0f172a_100%)] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden select-none">
      {/* Background Animated Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className={`w-full ${screen === 'playing' ? 'max-w-5xl xl:max-w-6xl' : 'max-w-md'} mx-auto flex flex-col flex-1 justify-center items-center py-4 px-4 relative z-10 transition-all duration-300`}>
        
        <AnimatePresence mode="wait">

          {/* SCREEN: START / MENU */}
          {screen === 'start' && (
            <motion.div 
              id="start-screen"
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center text-center justify-between py-8 h-[580px] bg-slate-900/65 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-md"
            >
              {/* Logo / Title Area */}
              <div className="flex flex-col items-center mt-6">
                <div className="flex space-x-1.5 mb-2.5 animate-bounce">
                  <div className="w-6 h-6 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                  <div className="w-6 h-6 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                  <div className="w-6 h-6 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
                  <div className="w-6 h-6 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                </div>
                
                <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-pink-400 to-indigo-400 font-sans mt-2 drop-shadow-sm">
                  BUBBLE SHOOTER
                </h1>
                <p className="text-lg font-mono tracking-widest text-cyan-300 font-semibold mt-1 uppercase">
                  Classic Pop
                </p>
              </div>

              {/* Central Art */}
              <div className="relative w-44 h-44 flex items-center justify-center my-4">
                <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-600 animate-spin opacity-30 blur-md duration-[6000ms]" />
                <div className="w-28 h-28 rounded-full bg-slate-800 flex flex-col items-center justify-center border-2 border-cyan-400 shadow-inner z-10 relative">
                  <Zap className="w-10 h-10 text-yellow-400 animate-pulse" />
                  <span className="text-xs text-slate-400 font-mono mt-1">Ready</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="w-full flex flex-col space-y-4 px-4">
                <button
                  id="btn-play-start"
                  onClick={() => {
                    synth.playWin();
                    setScreen('level_select');
                  }}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 text-lg active:scale-95 transition-all cursor-pointer border-b-4 border-blue-800"
                >
                  <Play className="fill-white w-5 h-5" />
                  <span>PLAY GAME</span>
                </button>

                <div className="flex justify-between items-center space-x-3">
                  {/* Sound control */}
                  <button
                    id="btn-toggle-sound"
                    onClick={handleMuteToggle}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl flex items-center justify-center space-x-1.5 text-sm transition-all active:scale-95 cursor-pointer border border-slate-700"
                  >
                    {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                    <span>{muted ? "Muted" : "Sound On"}</span>
                  </button>

                  {/* Manual/Instructions Pop */}
                  <button
                    id="btn-help-trigger"
                    onClick={() => {
                      synth.playBounce();
                      setShowHelpModal(true);
                    }}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all active:scale-95 cursor-pointer border border-slate-700 flex items-center justify-center"
                    title="How to play"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Developer credits */}
              <div className="text-[10px] text-slate-500 font-mono mt-2">
                BUBBLE SHOOTER © 2026 • RETRO DESIGN
              </div>
            </motion.div>
          )}

          {/* SCREEN: LEVEL SELECT */}
          {screen === 'level_select' && (
            <motion.div 
              id="level-select-screen"
              key="level_select"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full flex flex-col items-center py-6 h-[580px] bg-slate-900/65 border border-white/10 rounded-2xl shadow-2xl p-5 backdrop-blur-md"
            >
              {/* Header */}
              <div className="w-full flex justify-between items-center mb-6">
                <button
                  id="btn-back-menu"
                  onClick={() => {
                    synth.playBounce();
                    setScreen('start');
                  }}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-700 active:scale-95 text-slate-300"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-100 font-mono">SELECT MISSION</h2>
                <div className="w-10 h-10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-500 animate-pulse" />
                </div>
              </div>

              {/* Level List */}
              <div className="w-full flex-1 flex flex-col space-y-4 justify-center py-2 overflow-y-auto">
                {LEVEL_CONFIGS.map((lvl) => {
                  const isUnlocked = unlockedLevels.includes(lvl.id);
                  const stars = levelStars[lvl.id] || 0;
                  const highScore = highScores[lvl.id] || 0;

                  return (
                    <div
                      id={`level-card-${lvl.id}`}
                      key={lvl.id}
                      onClick={() => {
                        if (isUnlocked) {
                          synth.playWin();
                          initLevel(lvl);
                        } else {
                          synth.playBounce();
                        }
                      }}
                      className={`relative w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                        isUnlocked 
                          ? 'bg-slate-800/60 border-cyan-500/40 hover:border-cyan-400 hover:bg-slate-800 cursor-pointer active:scale-98' 
                          : 'bg-slate-950/40 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        {/* Circle level icon */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg border-2 ${
                          isUnlocked 
                            ? 'bg-gradient-to-tr from-cyan-600 to-indigo-600 border-cyan-400 text-white shadow-md' 
                            : 'bg-slate-900 border-slate-800 text-slate-600'
                        }`}>
                          {lvl.id}
                        </div>

                        {/* Title and stats */}
                        <div className="flex flex-col text-left">
                          <div className="flex items-center space-x-2">
                            <span className={`font-bold text-base ${isUnlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                              {lvl.name}
                            </span>
                            {lvl.id === 3 && (
                              <span className="px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-900/50 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                                Hard
                              </span>
                            )}
                          </div>
                          
                          {isUnlocked ? (
                            <span className="text-xs text-[#fbbf24] font-mono mt-0.5">
                              High Score: {highScore > 0 ? highScore : '---'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600 font-mono mt-0.5">
                              Locked
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right panel: Stars or Lock */}
                      <div className="flex flex-col items-end">
                        {isUnlocked ? (
                          <div className="flex space-x-0.5">
                            {[1, 2, 3].map((s) => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${
                                  s <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                        ) : (
                          <Lock className="w-5 h-5 text-slate-700" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Instructions summary */}
              <div className="w-full bg-slate-950/50 border border-slate-800 p-3.5 rounded-xl text-left mt-4 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">💡 Objective hints:</p>
                <p>• Match 3 same-colors using wall-reflection bounces.</p>
                <p>• Falling disconnected bubbles earn massive extra score multipliers!</p>
              </div>
            </motion.div>
          )}

          {/* SCREEN: GAMEPLAY ACTIVE CANVAS */}
          {screen === 'playing' && selectedLevel && (
            <motion.div 
              id="gameplay-screen"
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col md:flex-row gap-6 items-stretch justify-center relative z-20"
            >
              {/* LEFT COLUMN: Controls & Actions (Immersive UI theme) */}
              <div className="flex flex-row md:flex-col justify-between md:justify-start gap-4 order-2 md:order-1 md:w-56 shrink-0 bg-slate-900/65 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
                <div className="hidden md:block">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono font-bold mb-3">System Controls</div>
                </div>
                
                <div className="flex flex-row md:flex-col gap-2.5 w-full">
                  <button
                    id="btn-pause-game-left"
                    onClick={() => {
                      synth.playBounce();
                      setScreen('paused');
                    }}
                    className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 active:scale-95 text-white border border-white/10 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Pause className="w-4 h-4 fill-white" />
                    <span>Pause</span>
                  </button>

                  <button
                    id="btn-swap-bubbles-left"
                    onClick={swapBubbles}
                    className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 active:scale-95 text-white border border-white/10 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Swap</span>
                  </button>

                  <button
                    id="btn-toggle-sound-left"
                    onClick={handleMuteToggle}
                    className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 active:scale-95 text-white border border-white/10 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                    <span>{muted ? "Mute" : "Sound"}</span>
                  </button>
                </div>

                <div className="hidden md:block border-t border-white/10 pt-4 mt-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono mb-2">Controls Guide</div>
                  <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                    <p>• <span className="text-cyan-400">Mouse/Touch</span> to Aim</p>
                    <p>• <span className="text-cyan-400">Click/Tap</span> to Shoot</p>
                    <p>• <span className="text-cyan-400">A / D</span> keys to Rotate</p>
                    <p>• <span className="text-cyan-400">SPACE</span> to Shoot</p>
                    <p>• <span className="text-cyan-400">S / Shift</span> to Swap</p>
                  </div>
                </div>
              </div>

              {/* CENTER COLUMN: Play Area (Canvas wrapped in Arcade Case with Immersive HUD) */}
              <div className="flex-1 flex flex-col items-center order-1 md:order-2">
                <div className="w-full max-w-[440px] bg-slate-900/65 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  {/* TOP HUB METRICS HEADER (Immersive UI theme) */}
                  <div className="w-full flex justify-between items-center px-6 py-4 bg-white/[0.03] border-b border-white/10">
                    <div className="text-center">
                      <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-1">Score</div>
                      <div className="text-2xl font-black text-[#fbbf24] font-mono tracking-wide">{score.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-1">Target</div>
                      <div className="text-sm font-extrabold text-white uppercase font-mono">
                        {selectedLevel.winThreshold === 1.0 ? "Clear Board" : "Clear 80%"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-1">
                        {selectedLevel.shotLimit !== null ? "Shots Left" : "Combo"}
                      </div>
                      <div className={`text-2xl font-black font-mono tracking-wide ${
                        selectedLevel.shotLimit !== null && shotsLeft !== null && shotsLeft <= 8 ? 'text-red-500 animate-pulse' : 'text-slate-100'
                      }`}>
                        {selectedLevel.shotLimit !== null ? shotsLeft : `x${comboCount}`}
                      </div>
                    </div>
                  </div>

                  {/* GAMEPLAY CANVAS CONTAINER */}
                  <div 
                    ref={containerRef}
                    className="w-full aspect-[440/600] relative bg-slate-950/40"
                  >
                    <canvas
                      ref={canvasRef}
                      width={CANVAS_WIDTH}
                      height={CANVAS_HEIGHT}
                      onMouseMove={onMouseMove}
                      onMouseDown={onMouseDown}
                      onTouchMove={onTouchMove}
                      onTouchStart={onTouchStart}
                      onTouchEnd={onTouchEnd}
                      className="w-full h-full block cursor-crosshair touch-none"
                    />

                    {/* Mobile/Desktop Input Guide overlay */}
                    <div className="absolute bottom-2 right-4 left-4 pointer-events-none flex justify-between text-[10px] font-mono text-slate-500 opacity-50">
                      <span className="hidden sm:inline">← → / A D to Aim • SPACE to Fire</span>
                      <span className="sm:hidden">Drag to Aim • Release / Tap to Fire</span>
                      
                      <span className="hidden sm:inline">S / SHIFT to Swap</span>
                      <span className="sm:hidden">Tap Swap Below</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Level info & Previews (Immersive UI theme) */}
              <div className="flex flex-col gap-4 order-3 md:w-56 shrink-0 bg-slate-900/65 backdrop-blur-md border border-white/10 p-5 rounded-2xl">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono font-bold mb-3">Mission Details</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-1">Current Level</div>
                    <div className="text-3xl font-black text-[#fbbf24] font-mono tracking-tight">{String(selectedLevel.id).padStart(2, '0')}</div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-1">Title</div>
                    <div className="text-lg font-bold text-white leading-tight">{selectedLevel.name}</div>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-1">Instructions</div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedLevel.description}</p>
                  </div>

                  {selectedLevel.descentRate > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-1">Ceiling Speed</div>
                      <div className="text-xs text-amber-400 font-mono flex items-center gap-1.5 mt-0.5 font-bold">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Descends every {selectedLevel.descentRate} shots!</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN: PAUSED OVERLAY */}
          {screen === 'paused' && selectedLevel && (
            <motion.div 
              id="paused-screen"
              key="paused"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center justify-center py-10 h-[580px] bg-slate-900/65 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-md"
            >
              <h2 className="text-3xl font-extrabold text-cyan-400 font-mono tracking-widest mb-2 uppercase animate-pulse">
                PAUSED
              </h2>
              <p className="text-slate-400 text-sm text-center mb-8">
                Take a breath. Your bubble shooters are cooled down.
              </p>

              <div className="w-full max-w-xs flex flex-col space-y-4">
                <button
                  id="btn-resume-game"
                  onClick={() => {
                    synth.playWin();
                    setScreen('playing');
                  }}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-2 border-b-4 border-blue-800"
                >
                  <span>RESUME PLAY</span>
                </button>

                <button
                  id="btn-restart-game"
                  onClick={() => {
                    synth.playWin();
                    initLevel(selectedLevel);
                  }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-2 border border-slate-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>RESTART LEVEL</span>
                </button>

                <button
                  id="btn-quit-level"
                  onClick={() => {
                    synth.playBounce();
                    setScreen('level_select');
                  }}
                  className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-slate-400 font-medium rounded-xl transition-all active:scale-95 cursor-pointer border border-slate-800 flex items-center justify-center space-x-2"
                >
                  <Home className="w-4 h-4" />
                  <span>QUIT TO MENU</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* SCREEN: WIN MODAL */}
          {screen === 'win' && selectedLevel && (
            <motion.div 
              id="win-screen"
              key="win"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center justify-between py-10 h-[580px] bg-slate-900/65 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-md"
            >
              {/* Header Title */}
              <div className="flex flex-col items-center text-center mt-4">
                <span className="px-3 py-1 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-full text-xs font-mono font-bold uppercase tracking-widest animate-pulse">
                  Mission Cleared!
                </span>
                <h2 className="text-3xl font-black text-slate-100 font-sans tracking-tight mt-3">
                  STUNNING VICTORY
                </h2>
              </div>

              {/* Star Rating Display */}
              <div className="flex space-x-3.5 my-6">
                {[1, 2, 3].map((star) => (
                  <motion.div
                    key={star}
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15 * star, type: "spring", stiffness: 120 }}
                  >
                    <Star
                      className={`w-14 h-14 ${
                        star <= starsAwarded 
                          ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' 
                          : 'text-slate-700'
                      }`}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Final Score details */}
              <div className="w-full max-w-xs bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-center flex flex-col space-y-1 my-4">
                <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">Final Level Score</span>
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 font-mono">
                  {score}
                </span>
                
                {score > (highScores[selectedLevel.id] || 0) && (
                  <span className="text-emerald-400 text-xs font-mono font-bold flex items-center justify-center space-x-1 mt-1.5 animate-pulse">
                    <Award className="w-3.5 h-3.5" />
                    <span>NEW PERSONAL RECORD!</span>
                  </span>
                )}
              </div>

              {/* Navigation Options */}
              <div className="w-full max-w-xs flex flex-col space-y-3">
                {selectedLevel.id < LEVEL_CONFIGS.length ? (
                  <button
                    id="btn-next-level"
                    onClick={() => {
                      const nextLvl = LEVEL_CONFIGS.find(lvl => lvl.id === selectedLevel.id + 1);
                      if (nextLvl) {
                        synth.playWin();
                        initLevel(nextLvl);
                      }
                    }}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2 border-b-4 border-emerald-800"
                  >
                    <span>NEXT MISSION</span>
                  </button>
                ) : (
                  <button
                    id="btn-return-completed"
                    onClick={() => {
                      synth.playBounce();
                      setScreen('level_select');
                    }}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2 border-b-4 border-blue-800"
                  >
                    <span>ALL MISSIONS CLEARED!</span>
                  </button>
                )}

                <div className="flex space-x-3">
                  <button
                    id="btn-retry-win"
                    onClick={() => {
                      synth.playWin();
                      initLevel(selectedLevel);
                    }}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all active:scale-95 cursor-pointer border border-slate-700 flex items-center justify-center space-x-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>RETRY</span>
                  </button>

                  <button
                    id="btn-menu-win"
                    onClick={() => {
                      synth.playBounce();
                      setScreen('level_select');
                    }}
                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 text-slate-400 font-semibold rounded-xl transition-all active:scale-95 cursor-pointer border border-slate-800 flex items-center justify-center"
                  >
                    <span>MENU</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN: LOSE MODAL */}
          {screen === 'lose' && selectedLevel && (
            <motion.div 
              id="lose-screen"
              key="lose"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center justify-between py-10 h-[580px] bg-slate-900/65 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-md"
            >
              <div className="flex flex-col items-center text-center mt-4">
                <span className="px-3 py-1 bg-red-950 text-red-400 border border-red-900/50 rounded-full text-xs font-mono font-bold uppercase tracking-widest animate-pulse">
                  Mission Failed
                </span>
                <h2 className="text-3xl font-black text-slate-100 font-sans tracking-tight mt-3">
                  SYSTEM OVERRUN
                </h2>
              </div>

              {/* Unhappy bubble graphic */}
              <div className="relative w-36 h-36 flex items-center justify-center my-4 opacity-75">
                <div className="absolute w-28 h-28 rounded-full bg-red-500/10 border-2 border-dashed border-red-500 animate-spin duration-[8000ms]" />
                <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center border border-red-500/30">
                  <span className="text-4xl">💥</span>
                </div>
              </div>

              {/* Lose explanations */}
              <div className="w-full max-w-xs bg-slate-950/60 border border-slate-800/80 p-4.5 rounded-xl text-center flex flex-col space-y-1 my-4">
                <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">Score Achieved</span>
                <span className="text-3xl font-black text-slate-200 font-mono">
                  {score}
                </span>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  {selectedLevel.id === 3 && shotsLeft === 0 
                    ? "Out of active shooter shells. Try again and target bubbles higher up to cause massive collapse cascades!"
                    : "Grid bubbles breached the warning danger border. Clear them before they cross!"}
                </p>
              </div>

              {/* Actions */}
              <div className="w-full max-w-xs flex flex-col space-y-3">
                <button
                  id="btn-retry-lose"
                  onClick={() => {
                    synth.playWin();
                    initLevel(selectedLevel);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2 border-b-4 border-rose-800"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>TRY MISSION AGAIN</span>
                </button>

                <button
                  id="btn-menu-lose"
                  onClick={() => {
                    synth.playBounce();
                    setScreen('level_select');
                  }}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all active:scale-95 cursor-pointer border border-slate-700 flex items-center justify-center"
                >
                  <span>RETURN TO MENU</span>
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </div>

      {/* Styled Help Modal Overlay */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col relative"
          >
            <h2 className="text-2xl font-black text-[#fbbf24] font-mono tracking-widest mb-4 uppercase text-center flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 animate-pulse" />
              <span>Mission Briefing</span>
            </h2>

            <div className="space-y-4 my-2 text-slate-300 text-sm overflow-y-auto max-h-[380px] pr-2 scrollbar-thin">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <h3 className="font-bold text-cyan-400 uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5 font-mono">
                  <span>🎯</span> Aim & Shoot
                </h3>
                <p className="text-xs leading-relaxed">
                  <span className="text-white font-semibold">Desktop:</span> Move mouse pointer inside the play area to aim. Click to shoot.
                </p>
                <p className="text-xs leading-relaxed mt-1">
                  <span className="text-white font-semibold">Mobile/Touch:</span> Press, hold, and drag your finger anywhere on the board to aim. Release your finger to shoot! You can also tap directly to snap-fire.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <h3 className="font-bold text-cyan-400 uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5 font-mono">
                  <span>⚡</span> Rules & Mechanics
                </h3>
                <p className="text-xs leading-relaxed">
                  Match <span className="text-[#fbbf24] font-semibold">3 or more</span> bubbles of the same color to pop them.
                </p>
                <p className="text-xs leading-relaxed mt-1">
                  Bubbles left completely unanchored to the ceiling will tumble downwards for <span className="text-green-400 font-semibold">massive combo score multipliers</span>!
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <h3 className="font-bold text-cyan-400 uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5 font-mono">
                  <span>🛡️</span> Shielded Obstacles
                </h3>
                <p className="text-xs leading-relaxed">
                  Shielded bubbles (marked with a steel border and 🛡️ icon) do not pop easily. Pop adjacent normal bubbles or shoot them twice to break their outer defense locks!
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <h3 className="font-bold text-cyan-400 uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5 font-mono">
                  <span>⌨️</span> Keyboard Controls
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-slate-400">
                  <div><span className="text-white">A / D</span> or <span className="text-white">← / →</span></div>
                  <div>Rotate Aim</div>
                  <div><span className="text-white">SPACEBAR</span></div>
                  <div>Shoot Bubble</div>
                  <div><span className="text-white">S</span> or <span className="text-white">SHIFT</span></div>
                  <div>Swap Current & Next</div>
                </div>
              </div>
            </div>

            <button
              id="btn-close-help"
              onClick={() => {
                synth.playBounce();
                setShowHelpModal(false);
              }}
              className="mt-6 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer border-b-4 border-blue-800 uppercase tracking-wider text-sm font-mono"
            >
              System Online - Begin
            </button>
          </motion.div>
        </div>
      )}

    </main>
  );
}
