# Career mode

## The ladder
Four divisions of six clubs: Sunday League → District League → National League → Premier Cap League.
Each season is ten league matches (home and away). Top two go up, bottom one goes down, winning the
Premier Cap League makes you champions.

## Player rating (1–99)
Six players, one per cap. A better player flicks harder and aims steadier (`src/game/squad.js`):
- Power: 0.84× at 1, 1.0× at 50, 1.16× at 99 (`flickScale`)
- Aim: a flick can stray up to ~2.6° at 40, ~1.4° at 60, ~0.4° at 80, 0° at 99 (`aimWobble`), never on a penalty.
Computer clubs use the same rules; a typical player is 40 / 52 / 64 / 76 by division. OVR = average of the six.
In a match, picking up a cap shows the player's name and rating.

## Match rating (out of 10)
Start at 6; win +0.5, draw +0.1, loss −0.4; goal +1.3, own goal −1.2; shot on target +0.3;
keeper save +0.7, block +0.5; keeper and defenders +1 for a clean sheet (and −0.25 per goal after the first).
Kept between 3 and 10. Best player is Man of the Match.

## Growth, age and retirement
- After a match: 8.5+ → 75% chance of +1; 7.5+ → 45%; 4.8 or less → 35% chance of −1.
- Over the summer: season form (−1 to +2) + age (≤20 +3, ≤23 +2, ≤27 +1, ≤30 0, ≤32 −1, older −2) ± 1.
- From 34 a player may retire (30% at 34, more each year); a youth player (17–18) takes his place.

## Money and transfers
Wins 60, draws 25, losses 10, plus 5 per goal. Windows open pre-season and after league match 5.
Fees grow with rating²; you get 60% back for the player replaced. Every window has a youth prospect at half price.

## Cap Cup
Eight-club knockout each season: you, three from your division, four from the divisions either side.
Quarter-final opens after league match 2, semi after 5, final after 8 (all open once the league ends).
Draws go to penalties. Prizes: 250 (win), 100 (final), 50 (semi).

## Board target
Set each season from your OVR against the division: Win the league / Finish top 2 / Top half / Stay up.
Meeting it pays 200 / 150 / 80 / 60 coins.
