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

## Caps and bands (shop inside Lagos Life)

Counterball is about the caps you grew up flicking: "that's my cap, that's my
player". Everything for sale is looks only; paying never makes a player
stronger.

- **Starter caps**: familiar drink-cap looks under our own names (Cola, Green
  Lager, Red Lager, Stout, Malta, Orange Pop, Lemon Lime, Bitter Lemon, Ginger
  Ale, Tonic). No real brand names or logos until permission is secured.
- **Rare caps**: earned free, or bought inside Lagos Life.
- **Lagos Life exclusives**: bought only.
- **Rubber bands**: one per player, stretched round his cap. Some free, some
  earned, some bought.

After payment, `/api/lagos` checks the purchase with Lagos Life, records it in
`cb_lagos_owned` (so it follows the player to any phone), then marks it
delivered. If anything fails, the payment stays "paid but not delivered" and
the game claims it again the next time it opens.

Create these products in the Lagos Life dashboard (Products tab). The IDs must
match exactly; the names can be anything.

| Product ID | Item | Price |
|---|---|---|
| `cap_silver` | Ten Up (rare cap) | ₦100 |
| `cap_wall` | No Entry (rare cap) | ₦100 |
| `cap_lucky` | Seven Straight (rare cap) | ₦200 |
| `cap_boot` | Fifty Burner (rare cap) | ₦200 |
| `cap_cup` | Silverware (rare cap) | ₦300 |
| `cap_gold` | Moving Up (rare cap) | ₦300 |
| `cap_royal` | Champion of Champions (rare cap) | ₦500 |
| `cap_danfo` | Yellow Fever (exclusive cap) | ₦300 |
| `cap_jollof` | Party Jollof (exclusive cap) | ₦300 |
| `cap_ankara` | Owambe (exclusive cap) | ₦400 |
| `cap_eko` | Third Mainland (exclusive cap) | ₦400 |
| `cap_naija` | Oga at the Top (exclusive cap) | ₦500 |
| `band_blue` | Blue band | ₦100 |
| `band_green` | Green band | ₦100 |
| `band_white` | White band | ₦100 |
| `band_orange` | Orange band | ₦200 |
| `band_pink` | Hot Pink band (exclusive) | ₦100 |
| `band_glow` | Glow Green band (exclusive) | ₦100 |
| `band_purple` | Purple band (exclusive) | ₦100 |
| `band_gold` | Gold band (exclusive) | ₦200 |

**Webhook** (optional but recommended): in the Lagos Life dashboard, set the
webhook address to `https://www.counterball.fun/api/lagos-webhook`, and add
the webhook signing secret (`vtr_whsec_…`) to Vercel as `VATAR_WEBHOOK_SECRET`.
When a purchase is paid, the server checks it and unlocks it straight away,
even if the player closed the game right after paying.

**Progress follows the player**: each Lagos Life player's save (kits, career,
records, earned caps and bands) is kept on the server under their Lagos Life
ID, in `cb_lagos_saves`. It loads when they open the game on any phone and
saves after every match, every minute if something changed, and when the game
is put away.

Run `supabase/lagos.sql` once in the Supabase SQL editor. The server uses the
same `SUPABASE_SERVICE_ROLE_KEY` as play-anytime matches.

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
