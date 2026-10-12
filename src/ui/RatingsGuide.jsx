import Modal from './Modal'
import { CUP_NAME, CUP_AFTER, TARGET_BONUS } from '../game/career'
import { DIVISION_RATING, WINDOW_AFTER, aimWobble, flickScale } from '../game/squad'

const pct = (n) => `${Math.round((n - 1) * 100) > 0 ? '+' : ''}${Math.round((n - 1) * 100)}%`

/** How Career ratings work, in plain words. */
export default function RatingsGuide({ onClose }) {
  return (
    <Modal title="How ratings work" onClose={onClose}>
      <div className="ratings-guide">
        <h3>Player rating (1–99)</h3>
        <p>Every cap in your squad is a player with a rating. A better player <b>flicks harder</b> and <b>aims steadier</b>:</p>
        <ul>
          <li>Rated 40: {pct(flickScale(40))} power, aim can stray up to {aimWobble(40).toFixed(1)}°</li>
          <li>Rated 60: {pct(flickScale(60))} power, up to {aimWobble(60).toFixed(1)}°</li>
          <li>Rated 80: {pct(flickScale(80))} power, up to {aimWobble(80).toFixed(1)}°</li>
        </ul>
        <p>The computer’s players work the same way. A typical player is rated {DIVISION_RATING.join(', ')} from the bottom division to the top. Your team’s <b>OVR</b> is the average of your six.</p>

        <h3>Match rating (out of 10)</h3>
        <p>After each match every player gets a score. Everyone starts on 6. A win adds 0.5 and a loss takes off 0.4. A goal is worth 1.3 and a shot on target 0.3. Keepers get 0.7 a save, defenders 0.5 a block, and the keeper and defenders get 1 for a clean sheet.</p>

        <h3>Getting better</h3>
        <p>A great game (7.5 or more) can earn a player a point straight away; a poor one (under 4.8) can cost one. Over the summer, players move with their season and their <b>age</b>: under 21s improve fastest, players settle in their late twenties, and over 30s slow down. From 34 they may retire, and a youth player takes their place.</p>

        <h3>Coins and transfers</h3>
        <p>Wins pay 60 coins, draws 25 and losses 10, plus 5 a goal. The window opens before the season and after league match {WINDOW_AFTER[1]}. Each one has a cheap <b>youth prospect</b> at half price.</p>

        <h3>The season</h3>
        <p>Ten league matches, home and away. The {CUP_NAME} runs alongside: the quarter-final opens after league match {CUP_AFTER[0]}, the semi after {CUP_AFTER[1]}, the final after {CUP_AFTER[2]}. The board sets a target too; meet it for up to {Math.max(...Object.values(TARGET_BONUS))} bonus coins.</p>
      </div>
    </Modal>
  )
}
