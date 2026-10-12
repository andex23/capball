/**
 * Small hooks a host platform can fill in (Lagos Life sets them; the plain
 * game leaves them empty), so shared screens don't import platform code.
 */
export const platformHooks = {
  /** The player chose to leave an online match before the end. */
  onOnlineQuit: null,
  /** A line shown above "Leave match", e.g. that leaving loses a stake. */
  leaveWarning: null,
}
