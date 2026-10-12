import Modal from './Modal'
import { CUP_NAME, CUP_AFTER, TARGET_BONUS } from '../game/career'
import { DIVISION_RATING, WINDOW_AFTER, windowDeadline, WEIGHTS, powerScale, accuracyWobble, massScale, money, priceOf } from '../game/squad'

const pct = (n) => { const v = Math.round((n - 1) * 100); return `${v > 0 ? '+' : ''}${v}%` }
const W = (pos) => Object.entries(WEIGHTS[pos]).sort((a, b) => b[1] - a[1]).map(([k, w]) => `${k.toUpperCase()} ${Math.round(w * 100)}%`).join(' · ')

/** How Career ratings work, in plain words (modelled on EA Sports FC and Football Manager). */
export default function RatingsGuide({ onClose }) {
  return (
    <Modal title="How ratings work" onClose={onClose}>
      <div className="ratings-guide">
        <h3>Attributes</h3>
        <p>Every player has four attributes from 1 to 99, and each one plays out on the pitch:</p>
        <ul>
          <li><b>PWR</b>: how hard he flicks. 50 is {pct(powerScale(50))}, 70 is {pct(powerScale(70))}, 90 is {pct(powerScale(90))}.</li>
          <li><b>SHT</b>: how straight a hard flick goes. A 50 can stray {accuracyWobble(50).toFixed(1)}°, a 70 {accuracyWobble(70).toFixed(1)}°, a 90 {accuracyWobble(90).toFixed(1)}°.</li>
          <li><b>PAS</b>: the same for a soft, short flick.</li>
          <li><b>PHY</b>: how heavy his cap is, so how hard he is to knock aside. 50 is {pct(massScale(50))}, 90 is {pct(massScale(90))}.</li>
        </ul>

        <h3>OVR</h3>
        <p>Like FIFA, a player’s overall is his attributes weighted by position:</p>
        <ul>
          <li>ATK: {W('ATK')}</li>
          <li>MID: {W('MID')}</li>
          <li>DEF: {W('DEF')}</li>
          <li>GK: {W('GK')}</li>
        </ul>
        <p>So a striker played at the back rates lower there. A typical side is about {DIVISION_RATING.join(', ')} OVR from the bottom division to the top. Gold cards are 75+, silver 65–74 and bronze below. The computer’s players work exactly the same way.</p>

        <h3>Potential</h3>
        <p>Each player has a ceiling he grows towards. Your scouts show it as a range, like POT 74–79. Young players have the most room. A great season can raise a young player’s potential, and a poor one lowers it.</p>

        <h3>Growth and age</h3>
        <ul>
          <li>Good games build experience. When he has enough, he goes up a point, as long as he’s under his potential. Young players need less, and a run of poor games can cost a point.</li>
          <li>Over the summer, players aged 20 and under grow fastest. They keep improving to about 26, peak from 27 to 30, and decline from 31, losing physique and power first.</li>
          <li>From 33 a player may retire, and every player retires by 37. A youth prospect takes his place.</li>
        </ul>

        <h3>Match rating (out of 10)</h3>
        <p>Everyone starts on 6. A win adds 0.5 and a loss takes off 0.4. A goal is worth 1.3 and a shot on target 0.3. Keepers get 0.7 a save, defenders 0.5 a block, and the keeper and defenders get 1 for a clean sheet.</p>

        <h3>The club budget</h3>
        <p>Your club’s money is in naira. A win pays {money(60)}, a draw {money(25)} and a loss {money(10)}, plus {money(5)} a goal, and every division up pays half as much again. Fees rise steeply with OVR, like real values: a 60 costs about {money(priceOf({ rating: 60, age: 26 }))}, a 70 about {money(priceOf({ rating: 70, age: 26 }))} and an 80 about {money(priceOf({ rating: 80, age: 26 }))}. Young players with potential cost more, and players over 30 less. Transfer windows have a time frame, like the summer and January windows: the pre-season window stays open until you play matchday {windowDeadline(0)}, and the mid-season one opens after league match {WINDOW_AFTER[1]} and shuts at matchday {windowDeadline(1)}. Free agents can sign any time.</p>

        <h3>The transfer market</h3>
        <p>Every club has a real squad: title favourites with stars, mid-table sides, strugglers. Search every player in every division, plus the free agents. A club’s star costs well above his value, a first-teamer a bit above, and a listed player less. Bid below the asking price and the club may accept, counter or say no; after three tries they stop talking until the next window. A player won’t drop two divisions to join you, and a first-teamer won’t drop one. Free agents sign any time for a signing-on fee.</p>

        <h3>Running the club</h3>
        <p>Players are paid every match: about a twentieth of their value, so stars cost more to keep. Home matches sell tickets. Cheap tickets fill more seats and premium ones earn more from each fan. Fans grow as you win and when you go up. Each summer you choose a sponsor: steady money, a bonus for each win, or a lump sum up front. Higher divisions pay TV money. Spend on a better venue (from a folding table on the street corner up to a pro table in the Cap Arena, with room for more people to watch), a training ground that makes players improve faster, or an academy that produces a graduate every summer. Your squad holds 15: six start, four sit on the bench and up to five are reserves. Once all 15 places are taken you can’t sign anyone until you sell, release (paying off five matches’ wages) or loan someone out. The youth team sits outside the 15: your academy sends up youngsters every summer and you promote them when they’re ready. If the balance goes below zero, the board freezes transfers and building until you are back in profit.</p>

        <h3>The season</h3>
        <p>Ten league matches, home and away. The {CUP_NAME} runs alongside: the quarter-final opens after league match {CUP_AFTER[0]}, the semi after {CUP_AFTER[1]} and the final after {CUP_AFTER[2]}. The board wants promotion every season until you reach the Premier Cap League, then the title. Meet it for a bonus of up to {money(Math.max(...Object.values(TARGET_BONUS)))}. Miss it and you get a final warning; miss it again before you meet one and you’re sacked, and the career starts again.</p>
      </div>
    </Modal>
  )
}
