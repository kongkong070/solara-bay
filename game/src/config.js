// Every tuning number for Solara Bay in one place. The modules read these
// constants; changing the feel of the game means editing this file, not the
// physics or the missions.

export const WORLD_W = 3600;
export const WORLD_H = 2800;

// The bay is the west edge of the map. Water ends at SEA_EDGE, the sand
// runs to BEACH_EDGE, and the city grid starts after that.
export const SEA_EDGE = 460;
export const BEACH_EDGE = 600;

export const VIEW_W = 1280;
export const VIEW_H = 720;

// One in-game hour passes every GAME_HOUR_SECONDS of real play.
export const GAME_HOUR_SECONDS = 22;
export const NIGHT_START = 19;
export const NIGHT_END = 6;
export const GOLDEN_START = 17.5;

export const DIFFICULTY = {
  chill: {
    label: 'Chill',
    key: '1',
    heatGain: 0.7,
    coolOffSeconds: 4,
    timerScale: 1.25,
    payoutScale: 0.8,
    startCash: 300,
    copSpeed: 0.85,
    copCount: 0.7,
  },
  normal: {
    label: 'Normal',
    key: '2',
    heatGain: 1,
    coolOffSeconds: 8,
    timerScale: 1,
    payoutScale: 1,
    startCash: 150,
    copSpeed: 1,
    copCount: 1,
  },
  hardcore: {
    label: 'Hardcore',
    key: '3',
    heatGain: 1.4,
    coolOffSeconds: 14,
    timerScale: 0.8,
    payoutScale: 1.5,
    startCash: 100,
    copSpeed: 1.15,
    copCount: 1.3,
  },
};

export const DIFFICULTY_ORDER = ['chill', 'normal', 'hardcore'];

// Cars the player can steal. maxSpeed is px/s, accel px/s^2.
export const CAR_TYPES = {
  sedan: { label: 'Sedan', maxSpeed: 520, accel: 430, grip: 3.2, color: '#7d8aa0', w: 46, h: 22 },
  taxi: { label: 'Taxi', maxSpeed: 545, accel: 450, grip: 3.4, color: '#f2c14e', w: 46, h: 22 },
  sports: { label: 'Sports', maxSpeed: 690, accel: 620, grip: 4.4, color: '#d6455b', w: 48, h: 21 },
  truck: { label: 'Truck', maxSpeed: 420, accel: 330, grip: 2.6, color: '#8a7a5b', w: 56, h: 26 },
  van: { label: 'Van', maxSpeed: 460, accel: 360, grip: 2.8, color: '#9fb3c8', w: 52, h: 24 },
  coupe: { label: 'Coupe', maxSpeed: 610, accel: 540, grip: 4.0, color: '#5b8c5a', w: 46, h: 21 },
  muscle: { label: 'Bandit Muscle', maxSpeed: 650, accel: 560, grip: 3.6, color: '#2e2a4f', w: 50, h: 23 },
};

export const CAR_TYPE_KEYS = Object.keys(CAR_TYPES);

export const BOAT_TYPES = {
  speedboat: { label: 'Speedboat', maxSpeed: 490, accel: 320, turn: 2.1, color: '#e8e8e8', w: 54, h: 20 },
  dinghy: { label: 'Dinghy', maxSpeed: 300, accel: 240, turn: 2.6, color: '#f2a541', w: 44, h: 18 },
};

export const PLAYER = {
  walkSpeed: 210,
  sprintSpeed: 330,
  radius: 14,
  maxHp: 100,
  maxArmor: 100,
  maxAmmo: 120,
  startAmmo: 48,
  punchDamage: 12,
  gunDamage: 34,
  gunRange: 520,
};

export const WANTED = {
  maxStars: 5,
  stealCarHeat: 34,
  hitPedHeat: 40,
  shootHeat: 26,
  killCopHeat: 55,
  decayPerSecond: 9,
  bustPenalty: 100,
};

export const MISSION_REWARDS = [150, 250, 300, 400, 500, 700, 600, 1200];

export const PACKAGE_VALUE = 250;
export const PACKAGE_COUNT = 12;
export const CRATE_COUNT = 8;
export const CRATE_RESPAWN = 60;

export const RADIO_STATIONS = [
  { name: 'Bay FM', hue: 'sunny pop', bpm: 112, root: 57, scale: [0, 2, 4, 7, 9] },
  { name: 'Solaris', hue: 'late-night synth', bpm: 96, root: 45, scale: [0, 3, 5, 7, 10] },
  { name: 'Neon Nights', hue: 'drive-time electro', bpm: 128, root: 50, scale: [0, 2, 3, 7, 8] },
  { name: 'Wave 88', hue: 'coastal reggae', bpm: 84, root: 48, scale: [0, 4, 5, 7, 10] },
  { name: 'Cruz Control', hue: "Lena's picks", bpm: 104, root: 52, scale: [0, 2, 5, 7, 9] },
];

export const PALETTE = {
  seaDeep: '#0d5a74',
  seaShallow: '#1f8fa8',
  sand: '#e6cf96',
  sandWet: '#d3b878',
  grass: '#7fae62',
  parkDark: '#6a9a52',
  road: '#3b4048',
  roadLine: '#e8e3c8',
  sidewalk: '#b9b3a4',
  plaza: '#c9c2ae',
  pierWood: '#8a6f4d',
  pierEdge: '#6f5638',
  buildingRoof: '#2e2a26',
  stadiumGreen: '#5f9153',
  nightTint: 'rgba(8, 12, 40, 0.55)',
  duskTint: 'rgba(214, 110, 44, 0.20)',
};

export const BUILDING_COLORS = [
  '#f2c14e', '#e07856', '#7fb069', '#6a8caf', '#c77dff',
  '#e8b4b8', '#a3d2ca', '#f4a261', '#90be6d', '#f28482',
];

export const SAVE_KEY = 'solara-bay-save-v1';
