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

## Season, Cap Cup, board target
Ten league matches (home and away). Cap Cup: 8 clubs (3 from your division, 4 from the ones next door); QF after league match 2, SF after 5, final after 8 (all open once the league ends). Prizes 250 / 100 / 50.
Board target from your OVR vs the division (win the league / top 2 / top half / stay up), worth 200 / 150 / 80 / 60.

## Match rating (out of 10)
Start 6; win +0.5, draw +0.1, loss −0.4; goal +1.3, own goal −1.2; shot on target +0.3; save +0.7; block +0.5; keeper/defenders +1 clean sheet (−0.25 per goal after the first). Range 3–10.
