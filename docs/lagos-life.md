# Counterball in Lagos Life

Counterball runs in the Lagos Life Games app from the same code as the
website. Lagos Life loads `https://www.counterball.fun/lagos.html` in its game
frame. The game, its physics and its rules are unchanged; only the menus are
fitted to the frame.

## What's different inside Lagos Life

- **Player**: whoever is signed in to Lagos Life. Career, the daily challenge
  and rewards are open to them. Progress is saved on their phone; there is no
  Counterball account inside Lagos Life.
- **Leaderboard**: total wins against the computer and in friend matches.
  Matches with two players on one phone don't count. The count goes to the
  Lagos Life leaderboard (at most one update every 20 seconds).
- **Friend matches**: "Play a Friend" uses Lagos Life matchmaking (find a
  player, make a code, or join with a code). Stake is always 0. Once both
  players are in, the phones connect the same way the website's online
  matches do. When the match ends, both phones send the result to
  `/api/lagos`, which checks it and posts it to Lagos Life, signed.
- **Hidden**: Add to Home Screen, Counterball sign-in, sharing, LAN, voice chat,
  full screen, play-anytime matches, online tournaments. The frame doesn't
  allow these.
- **Pause**: when Lagos Life goes to the background, a match against the
  computer pauses and all sound stops. Sound comes back on return; the player
  taps Resume.

## Setting it up

1. Get test keys at <https://lagoslife.app/developers/keys>. For the game
   address, use `https://www.counterball.fun/lagos.html`.
2. In Vercel → Project → Settings → Environment Variables, add:
   - `VATAR_SECRET`: the `vtr_test_…` secret
   - `VATAR_RESULTS_SECRET`: the results signing secret

   Then redeploy. Without these, the game still works; only friend-match
   results aren't posted.
3. Ask Lagos Life to switch on multiplayer for the game. Friend matches need
   their approval for each game version.
4. Play it in the sandbox (`/developers/sandbox/<draft>`) and go through the
   checklist: SDK start-up, a friend match with a posted result.
5. When approved, swap in the `vtr_live_…` secret.

The frame header (`Content-Security-Policy: frame-ancestors …` for
`/lagos.html`) is set in `vercel.json`.

## Trying it locally

`npm run dev`, then open `/lagos.html?mock&name=Ada`. `?mock` uses a
stand-in for the Lagos Life SDK; it only works in development. Two tabs can
pair for a friend match.

## Files

- `lagos.html`, `src/lagos/`: entry page, SDK loading, player, leaderboard,
  friend-match lobby
- `src/platform.js`: `isLagos()`, which the menus check
- `server/lagos.js`, `api/lagos.js`: result posting
