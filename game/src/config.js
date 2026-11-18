// Solara Bay — open-world crime game. Shared tuning and city constants.
// All original content: city, names, story and art are made for this game.
export const WORLD = {
  width: 3400,
  height: 2600,
  roadWidth: 110,
  // Road centre lines (a sun-soaked coastal grid).
  roadsX: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  roadsY: [200, 600, 1000, 1400, 1800, 2200],
  beachTop: 2360, // sand starts here; water below it
  waterTop: 2500,
  blockPad: 26, // sidewalk width around each block
};

export const PLAYER = {
  walkSpeed: 165,
  runSpeed: 265,
  radius: 13,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 170,
  turnRate: 2.55,
  grip: 6.5,
  drag: 0.55,
};

// Health crates (+40 HP), armour vests (+25) and ammo boxes (+24 reserve)
// scattered around the city. They respawn 60 s after being picked up.
export const PICKUPS = {
  health: 40,
  armor: 25,
  ammo: 24,
  respawnSeconds: 60,
};

// Day/night cycle, driven by the in-game clock in main.js.
export const LIGHTING = {
  sunsetStart: 17 * 60 + 30, // 17:30 golden hour begins
  nightStart: 19 * 60, // 19:00 the city goes dark
  nightEnd: 6 * 60, // 06:00 dawn breaks
};

// Wanted stars: 0 calm .. 5 army of police. Police response grows with the level.
// Revision: heat builds slower (26 per crime instead of 34) so one mistake
// does not snowball, but high wanted levels now send more foot cops.
export const WANTED = [
  { cops: 0, copSpeed: 0, label: 'Clean' },
  { cops: 1, copSpeed: 320, label: 'One star' },
  { cops: 2, copSpeed: 355, label: 'Two stars' },
  { cops: 3, copSpeed: 390, label: 'Three stars' },
  { cops: 4, copSpeed: 430, label: 'Four stars' },
  { cops: 5, copSpeed: 470, label: 'Five stars' },
];

export const POLICE_TUNING = {
  heatPerCrime: 26, // was 34: ~4 crimes to gain a star, not 3
  calmSeconds: 7, // was 9: hiding drops a star sooner
  footCopCap: [0, 0, 2, 2, 3, 3], // by wanted level; was capped at 2
  spawnInterval: 2.2, // was 2.5 s between interceptor spawns
};

export const ECONOMY = {
  startCash: 150,
  packageReward: 250,
  taxiBase: 45,
  taxiPerMetre: 0.35,
};

export const DAY = {
  startMinutes: 9 * 60 + 20, // 09:20, bright morning
  minutesPerSecond: 0.55, // a full game day in ~44 real minutes
};

export const COLORS = {
  asphalt: '#3a3f4a',
  asphaltLine: '#d8c56a',
  sidewalk: '#b9b3a4',
  grass: '#7fae5a',
  sand: '#e8d29a',
  water: '#2e7fa8',
  waterDeep: '#1d5f86',
  buildingRoof: ['#c96f4a', '#7d8aa0', '#b59a6a', '#8a6f9e', '#5f8a7a', '#a05a5a', '#6a7f9e'],
  buildingWall: ['#e8dcc8', '#d8c8b0', '#c8d0d8', '#e0c0a8', '#c8b8d0'],
};

export const VIEW = { width: 1280, height: 720 };
