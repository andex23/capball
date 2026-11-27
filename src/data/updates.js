/**
 * What's new in the game, newest first. Each entry shows once in the bell's
 * "What's new" and counts as unread until the player opens the bell.
 * Only for important updates (a new mode, a new way to play, a big change):
 * small touches (a crown on the leaderboard, a new icon) are left for players
 * to find. Add a new entry at the top; keep its id forever.
 * icon: an Icon name. date: YYYY-MM-DD.
 */
export const UPDATES = [
  { id: 'weekend-league-live', date: '2026-11-27', icon: 'trophy', title: 'The Weekend League is live', text: 'Your matches are waiting: five a day, Friday to Sunday, and you can catch up on any you missed before Sunday midnight. Top the table to wear the Kingmaker for a week. Not in yet? Win 10 matches and sign up from the top of the menu.' },
  { id: 'league-10-wins', date: '2026-11-26', icon: 'trophy', title: 'Weekend League: now 10 wins to enter', text: 'You only need 10 wins to sign up for the Weekend League now, not 15. It opens this Friday at 4:30pm: sign up from the top of the menu.' },
  { id: 'wallet-band-studio', date: '2026-11-26', icon: 'trophy', title: 'Your wallet, the shop and Band Studio', text: 'Every match you finish now pays into your wallet: more for a win, goals and harder opponents. Spend it in the shop (your profile) on rare caps and band extras. Design one band for your whole team in Edit team › Band: pick a pattern, two colours, a width and a finish.' },
  { id: 'weekend-league', date: '2026-11-25', icon: 'trophy', title: 'The Weekend League is coming', text: 'Fifteen matches over one weekend, one club, one table, and only one champion. The champion wears the Kingmaker cap for a week, and the top ten win caps, cups for the trophy cabinet and club money. It opens this Friday at 4:30pm. You need 10 wins to enter: sign up now from the top of the menu.' },
  { id: 'training-ground', date: '2026-11-23', icon: 'help', title: 'Psst… there’s a training ground', text: 'Open your profile and look for the little cone. Practise chips, free kicks and one-on-ones, or set up anything you like. Nothing counts.' },
  { id: 'chip-shot', date: '2026-11-23', icon: 'ball', title: 'Chip shots', text: 'Double-tap a cap next to the ball, then flick: the ball flies over the wall. Keepers back up for chips, so float one and it’s caught, overdo it and it’s over the bar. Three a half, in the half you’re attacking.' },
  { id: 'daily-week', date: '2026-11-21', icon: 'check', title: 'A daily challenge for every day of the week', text: 'Each day has its own set-up, getting harder towards the weekend, so no two days in a row are the same. Sunday is the Sunday Special: an extra defender and one flick fewer, worth ₦250k.' },
  { id: 'career-ladder', date: '2026-11-20', icon: 'trophy', title: 'Career: a bigger ladder', text: 'New careers start in the Street League. Five divisions, eight clubs each, a 14-match season, and four clubs fighting for the title in every league. Top two go up, bottom two go down.' },
  { id: 'canta-champions-league', date: '2026-11-20', icon: 'trophy', title: 'The Canta Champions League', text: 'Finish in the top two of the Premier Cap League to face the best clubs from abroad: two groups, semi-finals and a final on midweek nights. ₦25m to the winners.' },
  { id: 'derbies-jobs', date: '2026-11-20', icon: 'ball', title: 'Derby days and job offers', text: 'Every league has your rival: beat them for double prize money. Win big and bigger clubs will offer you the job. After each season, a summer review shows who’s new, who left and what your rivals signed.' },
  { id: 'transfer-market', date: '2026-11-20', icon: 'users', title: 'A new transfer market', text: 'The Market tab now shows players first. “For you” finds players who’d start for you and fit your budget. Each player has one total price and three offers: Cheeky, Fair or Asking.' },
  { id: 'weekly-cup', date: '2026-11-20', icon: 'trophy', title: 'The Weekly Cup', text: 'A new cup every Monday under Tournament: eight clubs, harder every round. Win it for ₦1.5m and that cup’s cap.' },
  { id: 'two-players-one-phone', date: '2026-11-20', icon: 'users', title: 'Two players, one phone', text: 'No shot clock when you pass the phone, the pitch stays still, and a big banner shows whose turn it is. Matches are first to 3.' },
  { id: 'career-matchday-report', date: '2026-11-18', icon: 'ball', title: 'Inside your matchday', text: 'Read who scored, see when pressure swung and back a player in the post-match interview. Find the season’s two legend caps in the transfer market.' },
  { id: 'weekly-cap-rewards', date: '2026-11-18', icon: 'trophy', title: 'Play for this week’s cap', text: 'Your profile has three weekly goals. Open the daily reward for club money, a scout report and cap designs.' },
  { id: 'easy-computer', date: '2026-11-18', icon: 'cpu', title: 'A smarter easy computer', text: 'On easy the computer still makes mistakes, but it always plays the ball and never towards its own goal.' },
  { id: 'wall-rule', date: '2026-11-10', icon: 'help', title: 'No goals off the wall', text: 'If your cap bounces off the wall before it hits the ball, that flick can’t score.' },
  { id: 'long-shots', date: '2026-11-10', icon: 'ball', title: 'Long shots and saves', text: 'Hard shots from far out can drift, and keepers slide across to save them. Work the ball closer to score.' },
  { id: 'new-screens', date: '2026-11-05', icon: 'trophy', title: 'New tournament and team screens', text: 'A new tournament home, an easier way to play a friend, and a big cap to design before each match.' },
  { id: 'season-road', date: '2026-11-05', icon: 'next', title: 'Career: the season road', text: 'Your career season is now a road: past results below, the next match in the middle, what’s coming above.' },
]
