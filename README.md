# CAPBALL

A browser game inspired by tabletop bottle-cap football. Players take turns flicking caps to move the ball and score, with a 3D pitch and arcade presentation.

[Play CAPBALL](https://capball.vercel.app/)

![CAPBALL title screen with a tabletop football pitch](docs/images/preview.jpg)

## Features

- Local matches, computer opponents, and an online match mode.
- Team, formation, and stadium selection.
- Drag-and-release flick controls.
- Match timing, scoring, fouls, and goal detection.
- Sound, music, and difficulty settings.

## Built with

React 19 and Vite 8; Three.js and React Three Fiber for rendering; Matter.js for physics; Zustand for state; PeerJS for online connections.

## Run locally

```bash
git clone https://github.com/andex23/capball.git
cd capball
npm install
npm run dev
```

Use the local URL printed by Vite.

```bash
npm run build
npm run preview
```

## Code map

| Path | Purpose |
| --- | --- |
| `src/scene/` | Pitch, ball, and cap rendering |
| `src/physics/` | Physics simulation and goal detection |
| `src/input/` | Flick controls |
| `src/ai/` | Computer opponent |
| `src/multiplayer/` | Peer connection logic |
| `src/state/` | Match state |
| `src/screens/` | Menus and match setup |

