# Career mode

Modelled on EA Sports FC (FIFA) career mode and Football Manager.

## Attributes (1–99), each doing something on the pitch
- **PWR** — flick power: 0.88× at 45, 1.0× at 70, 1.12× at 95 (`powerScale`)
- **SHT** — how straight a hard flick goes: up to 4.5° off at 45, 1.7° at 70, 0 from 95 (`accuracyWobble`)
- **PAS** — the same for a soft flick; in between, the two blend by flick power (`flickWobble`)
- **PHY** — cap weight 0.9×–1.1× (`massScale`): harder to knock aside. Ball is ~6× lighter, so shot speed barely changes.
Never applied to penalties. Ordinary (non-career) matches are untouched.

## OVR — attributes weighted by position (like FIFA's position formulas)
| Pos | Weights |
|---|---|
| ATK | SHT 40 · PWR 35 · PAS 15 · PHY 10 |
| MID | PAS 40 · SHT 20 · PWR 20 · PHY 20 |
| DEF | PHY 40 · PAS 25 · PWR 20 · SHT 15 |
| GK  | PHY 45 · PAS 25 · PWR 20 · SHT 10 |
A player out of position rates at that position's weights. Typical division OVR: 52 / 60 / 68 / 78.
Card colours: gold 75+, silver 65–74, bronze below.

## Potential (hidden, shown as a scout's range)
Room to grow by age: ≤19 +8–21, ≤22 +4–13, ≤25 +1–6, ≤28 +0–2, older 0. Youth prospects +12–23.
Dynamic: an average match rating ≥7.5 in a season raises a ≤26-year-old's potential by 1–2; under 6.0 lowers it.

## Growth
- In season: experience += (match rating − 6.3). At 2 (≤21), 3 (≤25) or 4.5 (older) a player under his potential and ≤30 gains 1 OVR; at −3 he loses 1.
- Summer: age (≤20 +4, ≤23 +3, ≤26 +2, ≤28 +1, ≤30 0, ≤32 −2, older −3) + form (avg ≥7.5 +2, ≥7 +1, ≥6.3 0, else −1) ± 1, capped at potential. Growth goes into the position's key attributes; decline takes PHY and PWR first.
- Retirement from 33 (20% at 33, 40% at 34, …), certain at 37. A youth prospect replaces him.

## Club budget (naira)
Shown in naira: 1 unit = ₦10,000 (`money()`), so a win ≈ ₦600k, a 64 ≈ ₦1.5m, an 88 ≈ ₦20m. It's in-game club money, separate from Lagos Life money.
Results: win 60, draw 25, loss 10, +5/goal; ×1.5 per division up. Season bonus: champions 600, promoted 250, stayed 80, relegated 40.
Fee = 30 × 1.115^(OVR−50) × age factor (≤21 1.25, ≤25 1.1, ≤29 1, ≤31 0.75, older 0.5) × (1 + 2.5% per point of potential room). Sell for 60%.
Windows: pre-season and after league match 5; each has a youth prospect.

## Club business (src/game/club.js)
Football Manager-style finances. All money in units (₦10k); every flow is booked in `biz.ledger` (gate, prize, sponsor, tv, sales / wages, transfers, facilities), reset each summer and kept in `past[].finance`.
- Wages: `priceOf(p)/20` per player per match, starters and bench (`wageBill`). Paid on every league and cup match.
- Match day (`matchDay`): home gate = attendance × ticket price; attendance = fans × ticket demand × form, capped at the venue's room. Tickets: cheap ×0.7 price / 1.15 demand, standard ×1 / 0.9, premium ×1.5 / 0.6; base ₦2,000/2,800/4,000/6,000 by division.
- Fans: start 75; wins add 6% of the room left to the division's fan base (500/1.5k/3.75k/10k), draws 2%, losses −2%. Summer: promoted ×1.25, champions ×1.1, cup win ×1.1, relegated ×0.85; capped at 1.2× the new division's base.
- Sponsor: three offers each summer (steady per match, per win ×2.2, up front ×9) from (8 + 1.2√fans) × (1 + 0.6 × division).
- TV money at the start of each season: 0 / 150 / 500 / 1,500 by division.
- Venue (key `stadium`, levels 0–4), a real table venue used for home matches: Street corner (street, 150 watching) → Garden (gravel, 400) → Viewing centre (bar, 750) → Game room (arena, 1,500) → Cap Arena (capArena, 3,000; career-only venue with stands). Costs 300/1k/3k/8k. Away matches use the opponent's venue (`matchVenue`: their division, +0/1 by name).
- Facilities (levels 0–4): training xp ×1→×1.6 on match growth; academy sends 1/2/2/3/3 youngsters a summer to the youth team with −4/0/+3/+6/+9 potential (200/600/1.5k/4k each).
- Squad rules: see “Squad and transfers” below.
- In the red (coins < 0): transfers and building frozen (`spendingFrozen`).
- `clubEconomy.test.js` simulates ten seasons: strong clubs end around ₦100–400m, weak ones stay solvent.

## The world (src/game/world.js)
Every computer club has a real squad, kept in `career.world` ({ clubs, free, nextId, news }); players compact ({ id, name, pos, age, attrs, pot, listed? }), filled out with `hydrate`.
- Club strength = `DIVISION_RATING[level]` + tier offset by its place in `DIVISIONS` (favourites +6, contenders +3, mid-table 0, battling −2, strugglers −5).
- Squad of 12: 2 GK, 3 DEF, 2 MID, 3 ATK, 2 youth. Bands: star S+6..10 (ages 24–30; the top two clubs get a second star in midfield), first team S+0..4, squad S−6..−2, youth S−12..−8 with potential +4..15.
- A club plays its `bestSix` (keeper, then best fit per role). Its OVR (`clubOvr`) goes on league/cup teams as `ovr`; CPU-v-CPU results lean ~7% more goals per OVR point (`simulateResult`). Your opponents' caps carry their real players' names and attributes.
- Each summer (`worldSummer`): development (ageGrowth ±1, capped by potential, +1 max above 85), retirements 33–37, a youth graduate per club, clubs that need it buying from weaker clubs or free agents (big clubs first, within budget = 3× a S+2 player's fee), squads settled to 10–13 with position minimums, older non-starters and surplus listed, free-agent pool refilled (16–30). News of the biggest moves shows on the career screen.
- 20-season simulation: club OVRs drift up about 3–5 points; stars top out around 90–94.

## Squad and transfers (src/game/transfers.js)
- Squad of 15 (`MAX_SQUAD`): starting six + bench of four (the matchday ten) + up to five reserves. Full = no signings until someone leaves. Returning loans can push you over; signings stay blocked until you're back to 15.
- Youth team (`youthTeam`, max 8) is outside the 15 and unpaid: academy intake each summer (ages 15–16, ~13 below the division, potential +14..27 + academy bonus), grows by age (+1 with training ≥ Training centre), must leave at 19 (becomes a free agent). Promote to the reserves when there's room.
- Market (`searchMarket`): every club player and free agent; filter position, division/free, OVR, age, price, name or club, listed; sort OVR / potential / price / age.
- Asking price (`askingPrice`) = value × star 1.6 / first team 1.3 / prospect 1.25 / squad 1 / listed 0.75; free agent = 15% signing-on fee.
- Dropping down costs money (`willingness`): a player from a higher division wants a premium of ×1.6 / ×2.6 / ×4 for dropping 1 / 2 / 3 divisions (×1.4 more for a club's star, ×1.2 for a first-teamer). He takes a signing bonus of value × (premium − 1) × 0.5 on top of the fee, and his wages with you are × premium for as long as he stays (`wageX`). Free agents and players from your division or below come at the normal rate.
- Bids (`makeBid`): each club's bottom line is 85–100% of asking (seeded per window); ≥70% gets a counter at asking; three tries a window then talks end. Club players only in a window; free agents any time. Blocked when full, in the red, or short of money. Signings join the reserves.
- Selling (`offersFor` / `sellTo`, window only): up to three clubs where he'd be within 2 of their weakest starter and who can afford ~70% of his value; fee 75–115% of value. Leaving the ten pulls in the best reserve who can play there (keeper for keeper); with no cover the move is refused.
- Release (`releasePlayer`, any time): pay five matches' wages; he becomes a free agent.
- Loan out (`loanOut`, window only): to the best club no higher than your division where he'd be within 5 of their weakest starter. No wages, no squad place; back in the summer, developed as a 7.0-average season.

## Season, Cap Cup, board target
Board target, shown as a card before matchday 1 with the bonus and your OVR rank, comes from your rank by OVR among the six clubs: strongest → promotion (title at the top); 2nd → promotion (top half at the top); 3rd–4th → top half; else stay up (don't finish bottom in the Sunday League).
Ten league matches (home and away). Cap Cup: 8 clubs (3 from your division, 4 from the ones next door); QF after league match 2, SF after 5, final after 8 (all open once the league ends). Prizes 250 / 100 / 50.
Board target from your OVR vs the division (win the league / top 2 / top half / stay up), worth 200 / 150 / 80 / 60.

## Match rating (out of 10)
Start 6; win +0.5, draw +0.1, loss −0.4; goal +1.3, own goal −1.2; shot on target +0.3; save +0.7; block +0.5; keeper/defenders +1 clean sheet (−0.25 per goal after the first). Range 3–10.

## Squad of ten and substitutes
- Six starters (GK, 2 DEF, MID, 2 ATK) and a bench of four (GK, DEF, MID, ATK).
- Before a match: Start a bench player in place of a starter (keepers only for keepers; outfield players anywhere outfield, at that position's OVR).
- In a match: up to 3 substitutions (pause menu, or the Subs button). The cap takes the new player's name, OVR, attributes and weight at once. A player taken off can't return.
- Ratings: each player is rated for his own time on the pitch; goals count for whoever was on. Subs who come on get an appearance and experience. Players with no games all season slide a little (−1 form) over the summer.
- Transfers can replace a starter or a bench player. Computer clubs play their six.
