/**
 * What's new in the game, newest first. Each entry shows once in the bell's
 * "What's new" and counts as unread until the player opens the bell.
 * Add a new entry at the top whenever a feature ships; keep its id forever.
 * icon: an Icon name. date: YYYY-MM-DD.
 */
export const UPDATES = [
  { id: 'easy-computer', date: '2026-11-18', icon: 'cpu', title: 'A smarter easy computer', text: 'On easy the computer still makes mistakes, but it always plays the ball and never towards its own goal.' },
  { id: 'wall-rule', date: '2026-11-10', icon: 'help', title: 'No goals off the wall', text: 'If your cap bounces off the wall before it hits the ball, that flick can’t score.' },
  { id: 'long-shots', date: '2026-11-10', icon: 'ball', title: 'Long shots and saves', text: 'Hard shots from far out can drift, and keepers slide across to save them. Work the ball closer to score.' },
  { id: 'new-screens', date: '2026-11-05', icon: 'trophy', title: 'New tournament and team screens', text: 'A new tournament home, an easier way to play a friend, and a big cap to design before each match.' },
  { id: 'season-road', date: '2026-11-05', icon: 'next', title: 'Career: the season road', text: 'Your career season is now a road: past results below, the next match in the middle, what’s coming above.' },
]
