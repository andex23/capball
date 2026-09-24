# CAPBALL

A browser game inspired by tabletop bottle-cap football. Players take turns flicking caps to move the ball and score, on a 3D pitch with a broadcast-style presentation.

[Play CAPBALL](https://capball.vercel.app/)

![CAPBALL main menu over a tabletop football pitch](docs/images/preview.jpg)

## Features

- Local two-player matches, a computer opponent (easy / medium / hard), and online matches with a room code or invite link.
- Team builder (name, colours, badge, pattern, finish), four venues, and four formations that set the kick-off layout.
- Drag-and-release flick controls with an aim arrow and ball-contact preview.
- Two halves with a change of ends, fouls, free kicks with a wall, penalties, and a penalty shootout with sudden death.
- Works on phones: the pitch turns upright in portrait and the layout adapts.

## Built with

React 19 and Vite 8; Three.js and React Three Fiber for rendering; Matter.js for physics; Zustand for state; PeerJS for online play; Vitest and ESLint for checks.

## Run locally

```bash
git clone https://github.com/andex23/capball.git
cd capball
npm install
npm run dev
```

Use the local URL printed by Vite.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit tests once (`npm run test:watch` to keep watching) |
| `npm run lint` | Lint the code |
| `npm run check` | Lint, test and build — the same as CI |
| `npm run build` / `npm run preview` | Build for production and serve the build |

### Online play

Online matches use the free public PeerJS server by default. To use your own [PeerJS server](https://github.com/peers/peerjs-server), set these before building:

```bash
VITE_PEER_HOST=peer.example.com VITE_PEER_PORT=443 VITE_PEER_PATH=/ VITE_PEER_SECURE=true npm run build
```

The host runs the physics and rules; the guest sends requests (edit its own team, ready up, flick its own caps on its own turn), and the host validates every one before applying it. At full time both players pick Rematch (or Penalty shootout after a draw) and it starts once they agree.

#### Relay (TURN) servers

Players connect directly using public STUN servers (`stun:stun.l.google.com:19302`). Some networks — lots of mobile data, office and school Wi-Fi — block direct connections, and then the traffic has to go through a relay (TURN) server. None is built in, because relays cost money to run; without one, those players see *"Couldn’t connect directly — one of you may be on a strict network…"* (PeerJS's own best-effort public relay is still tried when you don't configure one).

To add a relay, set either or both of these before building:

| Variable | Example |
| --- | --- |
| `VITE_ICE_SERVERS` | JSON array of [RTCIceServer](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer) objects: `[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]` |
| `VITE_TURN_URL` | `turn:turn.example.com:3478` (comma-separate several, e.g. add `turns:turn.example.com:5349?transport=tcp`) |
| `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | the relay's username and password |

```bash
VITE_TURN_URL=turn:turn.example.com:3478 VITE_TURN_USERNAME=capball VITE_TURN_CREDENTIAL=secret npm run build
```

They're added to the STUN defaults; malformed entries (bad JSON, TURN urls without a username and credential) are ignored. Any TURN service works — for example [Metered](https://www.metered.ca/stun-turn) or [Twilio Network Traversal](https://www.twilio.com/docs/stun-turn) (both have free tiers and give you the urls and credentials to paste in), or your own [coturn](https://github.com/coturn/coturn) server. These values end up in the public JavaScript bundle, so use credentials meant for browsers (Metered and Twilio can issue restricted or short-lived ones) rather than an account password.

#### Dropped connections

If the link drops during setup or a match, the host keeps the room open and pauses the match for up to a minute while the guest reconnects automatically (retrying after 1 s, 2 s, 4 s … ). The host sends the full match state again when the guest is back and play resumes after a short "back" notice. When the host first accepts a guest it gives it a random session token; only a guest presenting that token can rejoin a room, so nobody else can take over a match in progress. Pressing Leave (or closing the tab) tells the other player straight away.

## Rules at a glance

- Teams alternate turns; a turn ends when everything stops moving.
- No goal straight from a kick-off flick. Goalkeepers can't score, but an own goal off a keeper counts.
- Hitting an opponent's cap before the ball is a foul (a cushion bounce first is fine): free kick, or a penalty if it's in the offender's own area.
- A drawn match can go to a shootout: best of three each, then sudden death.

## Code map

| Path | Purpose |
| --- | --- |
| `src/game/` | Pure match rules (goals, fouls, shootout) and flick validation |
| `src/state/` | Match state and flow (Zustand store) |
| `src/physics/` | Physics world, set-piece layouts, goal detection |
| `src/scene/` | Pitch, ball and cap rendering; camera presets |
| `src/input/` | Flick controls |
| `src/ai/` | Computer opponent |
| `src/multiplayer/` | PeerJS connection and the validated online protocol |
| `src/screens/`, `src/ui/` | Menus, setup flow, HUD and shared UI |
| `src/styles/theme.css` | Design tokens and component styles |
| `src/__tests__/` | Unit and physics simulation tests |
| `src/sw.js`, `src/pwa/` | Offline service worker (production builds only), install prompt, update toast |
| `scripts/generate-icons.js` | Renders the app icons in `public/icons/` (`node scripts/generate-icons.js`) |
