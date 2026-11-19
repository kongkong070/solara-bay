# solara-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kongkong070/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kongkong070/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solara Bay** — an open-world crime game in the spirit of GTA 6, written from scratch in plain HTML5 Canvas and JavaScript. You are Rio Vega, a driver new to the sun-soaked coastal city of Solara Bay. Steal cars, take a speedboat out on the bay, outrun the SBPD, run eight story missions for Lena Cruz — including a buoy run on the water and a helicopter escape — drive taxi fares, and hunt 12 hidden cash packages, all offline, in your browser, with no build step and no network requests. The city runs a full day/night cycle: after 19:00 the streets go dark and your headlights cut the night.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static server. The game is only static files under `game/`.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive a car, sail a boat |
| E | Enter / exit a car, a boat, or the helicopter |
| F | Punch |
| Mouse | Aim and shoot (click), R reload |
| Space | Handbrake |
| Shift | Sprint |
| M | Start the next story mission |
| 1 / 2 / 3 | Pick a difficulty on the title screen (Chill / Normal / Hardcore) |
| C | Change radio station (while driving or sailing) |
| N / mouse wheel | Zoom the minimap |
| P / Esc | Pause — the pause screen reports the run's statistics |
| Q | Mute |

## Difficulty

Three modes, picked with **1 / 2 / 3** on the title screen and kept in your save:

| Mode | Police heat | Timers | Payouts | Starting cash |
| --- | --- | --- | --- | --- |
| **Chill** | Slow heat, cops cool off after 4 s hidden | 25% more time | 20% less | $300 |
| **Normal** | The intended experience | As designed | As designed | $150 |
| **Hardcore** | Fast heat, faster interceptors | 20% less time | 50% more | $100 |

The active mode is always visible in the HUD's top-centre pill, and the pause menu shows the run's time played, difficulty and total earnings alongside missions, fares, packages, boats ridden, helicopter rides and best wanted level.

## What's in the city

- **Open world**: a 3600×2800 coastal grid city — avenues, parks, a beach with a pier, a marina, docks, a stadium and a bay, with traffic and pedestrians living their own lives.
- **Driving**: arcade car physics with drift and handbrake; sedans, taxis, sports cars, trucks, vans, coupes and the Bandit Muscle to steal and drive.
- **Boats**: speedboats and a dinghy moored at the marina and the pier. Board with E, sail the bay with a wake behind you, and step back onto the pier or the beach. The SBPD waits at the shore — they cannot follow you onto the water, but the heat is still on when you come back.
- **Wanted system**: five stars. Steal a car, hit a pedestrian or open fire and the SBPD sends interceptors and foot cops; hide to cool the heat, or get busted. At four stars the interceptors answer faster and run hotter.
- **Story**: eight missions — *Welcome to Solara*, *Wheels Up*, *Special Delivery*, *The Getaway*, *Harbor Heist*, *King of Solara*, the boat run *Bay Runner* and the finale *Skyline Escape*, where you hold Bay Stadium at four stars and catch Lena's helicopter out — with timers, chases and a night holdout at the Marina Penthouse.
- **Side work**: taxi fares from waving pedestrians, 12 hidden cash packages worth $250 each, and 8 supply crates — health, armour and ammo — that respawn after a minute.
- **Day and night**: the in-game clock drives the lighting. Golden hour from 17:30, full night from 19:00 until 06:00, with headlights and a light cone while you drive or sail.
- **HUD**: wanted stars, cash, health and armour, ammo, clock, speedometer, radio, objective banner, a difficulty pill, and a live minimap with mission, police, fare, package, boat and helicopter blips, landmark labels at the closest zoom, a viewport rectangle and a north indicator, with three zoom levels (N or mouse wheel).
- **Feel**: synthesised WebAudio sound — engine hum, sirens that climb with your wanted level, a helicopter rotor, gunshots and five radio stations — plus particles, skid feedback and a save that continues your run.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game itself, staged deterministically with `?shot=chase|mission|start|night` (see `shots.json` and `game/src/shots.js`). A fifth scene, `?shot=boat`, stages the Bay Runner run for testing.

## Structure

- `game/index.html` — the page; `game/src/main.js` — boot and game loop
- `game/src/world.js` — city generation, the bay, docks and collision
- `game/src/player.js` — Rio on foot, behind the wheel and at the helm
- `game/src/vehicles.js` — car physics and traffic AI
- `game/src/boats.js` — boats, water physics and wakes
- `game/src/peds.js` — pedestrians
- `game/src/police.js` — wanted levels and the SBPD
- `game/src/missions.js` — story missions, taxi fares, packages, crates and the helicopter
- `game/src/render.js` — the city, the bay, the HUD, the minimap and the menus
- `game/src/audio.js` — synthesised sound and radio
- `game/src/input.js`, `game/src/save.js`, `game/src/shots.js`, `game/src/config.js`, `game/src/util.js`
- `main.ts` — hands `game/` and `screenshots/` to the grader's `/output` with a dossier

## Notes

Everything here is original: the city, the names, the story, the art and the sounds are made for this game. No Rockstar Games content, no borrowed assets, no copied code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hdtrjaj5&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
