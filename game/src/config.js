// Solara Bay tuning: world size, difficulty modes, car roster and the
// colours the city is painted with. Every other module reads these.

export const WORLD = {
  width: 3600,
  height: 2800,
  // The beach band and the sea beyond it, along the south edge.
  beachTop: 2380,
  seaTop: 2560,
  roadWidth: 92,
  sidewalk: 26,
};

// Avenue / street centre lines across the city grid.
export const ROADS_X = [280, 640, 1000, 1360, 1720, 2080, 2440, 2800, 3160];
export const ROADS_Y = [240, 560, 880, 1200, 1520, 1840, 2160];

export const DIFFICULTIES = {
  chill: {
    label: 'Chill',
    heatPerCrime: 16,
    calmSeconds: 5,
    missionTime: 1.25,
    payout: 0.8,
    startCash: 300,
    taxiSeconds: 90,
    traffic: 0.85,
    blurb: 'Slow cops, generous timers, easy money.',
  },
  normal: {
    label: 'Normal',
    heatPerCrime: 26,
    calmSeconds: 7,
    missionTime: 1.0,
    payout: 1.0,
    startCash: 150,
    taxiSeconds: 75,
    traffic: 1.0,
    blurb: 'The intended Solara Bay experience.',
  },
  hardcore: {
    label: 'Hardcore',
    heatPerCrime: 38,
    calmSeconds: 10,
    missionTime: 0.8,
    payout: 1.5,
    startCash: 100,
    taxiSeconds: 60,
    traffic: 1.1,
    blurb: 'Fast heat, tight timers, big payouts.',
  },
};

export const CAR_TYPES = {
  sedan: { name: 'Solara Sedan', w: 46, h: 22, accel: 1.0, top: 1.0, color: '#c94f4f' },
  taxi: { name: 'Bay Taxi', w: 46, h: 22, accel: 0.95, top: 0.95, color: '#e8b93a' },
  sport: { name: 'Cometa GT', w: 48, h: 21, accel: 1.35, top: 1.28, name2: 'Cometa GT' },
  muscle: { name: 'Bandit Muscle', w: 50, h: 23, accel: 1.2, top: 1.15, color: '#e07a3a' },
  truck: { name: 'Hauler', w: 58, h: 26, accel: 0.7, top: 0.8, color: '#7a7a72' },
  van: { name: 'Courier Van', w: 52, h: 24, accel: 0.85, top: 0.9, color: '#4f8a6a' },
  coupe: { name: 'Vela Coupe', w: 46, h: 21, accel: 1.15, top: 1.1, color: '#8a4fa8' },
  police: { name: 'SBPD Interceptor', w: 48, h: 22, accel: 1.3, top: 1.22, color: '#20242c' },
};

export const PAINTS = [
  '#c94f4f', '#3a6fd8', '#e8b93a', '#4f8a6a',
  '#8a4fa8', '#d8d8d0', '#e07a3a', '#5ab8c9',
];

// The city clock: minutes of game time per real second, and the light.
export const CLOCK = {
  startMinutes: 9 * 60,
  minutesPerSecond: 2,
  sunsetAt: 17 * 60 + 30,
  nightAt: 19 * 60,
  dawnAt: 6 * 60,
};

export const TUNING = {
  walkSpeed: 250,
  sprintSpeed: 350,
  carMaxSpeed: 430,
  carAccel: 320,
  carBrake: 520,
  carDrag: 0.55,
  carTurn: 2.6,
  playerHealth: 100,
  playerArmor: 50,
  startAmmo: 48,
  packageValue: 250,
  bustFine: 120,
  wantedMax: 5,
  heatPerStar: 34,
};

export const LANDMARKS = [
  { name: 'Marina Penthouse', x: 3160, y: 240 },
  { name: 'Neon Palms', x: 640, y: 560 },
  { name: 'Sunset Pier', x: 1720, y: 2520 },
  { name: 'Bay Stadium', x: 2800, y: 1520 },
  { name: 'The Docks', x: 3160, y: 2160 },
  { name: 'City Hall', x: 1360, y: 880 },
  { name: 'Solara General', x: 1000, y: 1840 },
  { name: 'North Gate', x: 1720, y: 240 },
];

export const RADIO = [
  { name: 'SUNSET FM 88.4', hue: '#e8b93a' },
  { name: 'BAY WAVE 94.1', hue: '#5ab8c9' },
  { name: 'PALM TREE 101.7', hue: '#4f8a6a' },
  { name: 'NIGHT DRIVE 106.9', hue: '#8a4fa8' },
];
