/**
 * How each mode works, shown the first time a player opens it (and any time
 * from its "?"). Short cards: a real screenshot, a title, one or two lines.
 * img: a file in public/intro/.
 */
export const MODE_INTROS = {
  career: {
    label: 'Career',
    cards: [
      { img: 'c-ladder', title: 'Your club', text: 'Name your club and design your caps. Start in the **Street League** and climb five divisions to the **Premier Cap League**. Top 2 go up, bottom 2 go down.' },
      { img: 'c-match', title: 'Matchday', text: '14 league matches a season, plus the **Cap Cup** on midweek nights. After each match, read the report and your players’ ratings. Beat your **derby** rival for double prize money.' },
      { img: 'c-squad', title: 'Your squad', text: 'Six start and four sit on the bench; make up to **3 subs** in a match. Players tire, grow with games and age, and their **contracts** run out. Bring youngsters up from your youth team.' },
      { img: 'c-market', title: 'The market', text: 'Sign players in the **transfer windows**; free agents sign any time. **“For you”** shows players who’d start for you. Offer Cheeky, Fair or Asking. Sell or loan the ones you don’t need.' },
      { img: 'c-club', title: 'The club and the board', text: 'Pick a sponsor, set ticket prices and **upgrade** your ground, training and academy. The board sets a goal each season: miss it twice and you’re **sacked**.' },
      { img: 'c-job', title: 'Bigger things', text: 'Win big and **bigger clubs offer you the job**. Finish in the top two of the Premier Cap League to play the **Canta Champions League**.' },
    ],
  },
  tournament: {
    label: 'Tournaments',
    cards: [
      { img: 't-home', title: 'Make your own', text: 'A **league** (everyone plays everyone; most points wins) or a **cup** (lose and you’re out; a draw goes to penalties). 3 to 8 teams.' },
      { img: 't-hub', title: 'Play your fixtures', text: 'Play friends on this phone or play the computer. **Computer v computer** matches play themselves. The table or bracket fills in as you go.' },
      { img: 'w-poster', title: 'The Weekly Cup', text: 'Short on time? A **ready-made cup** every Monday sits at the top. One tap to enter.' },
    ],
  },
  weekly: {
    label: 'Weekly Cup',
    cards: [
      { img: 'w-poster', title: 'A new cup every Monday', text: 'You and seven clubs. **Easy** in the quarter-final, **Medium** in the semi, **Hard** in the final.' },
      { img: 'w-draw', title: 'Win it', text: 'Lose and you’re out; a draw goes to penalties. Win the final for **₦1.5m** and that cup’s **cap**.' },
    ],
  },
  daily: {
    label: 'Daily challenge',
    cards: [
      { img: 'd-play', title: 'One puzzle a day', text: 'The same set-up for everyone today, and **a different one each day of the week**, harder towards the weekend. **Score in the flicks you’re given**: the count is at the top. Try as often as you like.' },
      { img: 'd-play', title: 'Keep your streak', text: 'Beat it **days in a row** to grow your streak. Seven in a row wins the **Seven Straight** cap. Beat the **Sunday Special** for ₦250k.' },
    ],
  },
  local: {
    label: 'Two players, one phone',
    cards: [
      { img: 'l-setup', title: 'First to 3', text: 'Pick your formations, then kick off. It’s **first to 3** goals; change it to on the clock or first to 5 before kick-off.' },
      { img: 'l-play', title: 'Pass the phone', text: 'Take turns flicking. A **banner shows whose turn** it is, and there’s **no shot clock**, so take your time.' },
    ],
  },
}
