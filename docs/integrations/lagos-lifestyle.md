# Lagos Lifestyle integration preparation

Status: discovery and implementation plan; no partner API calls or integration
features are enabled. Work lives on `integration/lagos-lifestyle`, based on
`ab2fb8a` (LAN interruption recovery). Keep this work on the integration branch
until the partner contract is available and the integration is verified.

## What is known

Lagos Lifestyle plans to expose an API for game integration. No official API
documentation, SDK, sandbox, launch mechanism, authentication scheme, or result
format has been supplied. The initial player experience is still to be selected:
launch CapBall within their game, link accounts/share results, or earn rewards.

These are possible integration capabilities, not claims about their API.
No endpoints, scopes, environment variables, or payloads are prescribed here.

## Existing CapBall integration points

| Area | Existing code | How it can support integration |
| --- | --- | --- |
| Launch and invitation routing | `src/screens/SplashScreen.jsx`, `src/screens/OnlineScreen.jsx` | Preserve room/tournament invitations when adding the documented partner launch flow. |
| App initialization | `src/main.jsx`, `src/App.jsx` | Initialize a partner adapter once, after verifying launch context. Standalone startup must continue working when it is absent. |
| Accounts and cloud saves | `src/state/accountStore.js`, `supabase/accounts.sql` | Link a verified external identity to an existing CapBall account if needed. Existing passwords, session tokens and entire saves are not partner payloads. |
| Match completion and local history | `src/state/MatchStore.js`, `src/state/savedMatch.js`, `src/state/persistence.js` | Observe a final match result once. Replays, individual goal events and restored screens must not generate another result. |
| Hosted competition results | `src/state/tournamentStore.js` | Keep a partner match identifier separate from competition and fixture identifiers. |
| Server-authoritative saved turns | `api/anytime.js`, `server/anytime.js`, `supabase/anytime.sql` | Existing server validation and versioned commits are a starting point for results that need independent verification. Production prerequisites still need verification. |
| Live multiplayer / LAN | `src/multiplayer/MultiplayerManager.js`, `src/multiplayer/lanRecovery.js` | Support partner lifecycle signals through the existing pause/recovery flow once specified. Browser-hosted physics are not independent proof of a reward-worthy result. |
| Offline application | `src/sw.js`, `vite.config.js` | Preserve standalone offline/LAN play. Partner identity responses, tokens and authenticated API responses must not enter the app-shell cache. |

## Details to request from Lagos Lifestyle

1. Official documentation, API/SDK versions, sandbox access and sample game.
2. The intended launch surface: external browser, iframe, or native webview;
   supported mobile platforms; approved game URLs/origins and return-to-host flow.
3. Identity verification: authentication mechanism, token validation, expiry,
   refresh, audience and issuer requirements, and account-link/unlink behavior.
4. Supported game lifecycle: ready, start, pause, background, resume, quit and
   completion. Confirm whether the host provides these events at all.
5. Whether results, leaderboards or rewards are in scope; accepted match modes,
   verification requirements, duplicate handling and correction/revocation rules.
6. Result delivery: request/response or webhooks, schemas, signatures, event IDs,
   retry policy, rate limits and out-of-order delivery behavior.
7. Webview capabilities: WebGL, WebRTC, camera permission for LAN QR pairing,
   audio unlock, local storage, service workers, fullscreen and external links.
8. Data consent/deletion requirements and the minimum permitted player data.

## Implementation order after the contract arrives

### 1. Confirm one player journey

Write the launch-to-exit flow for the selected initial capability. Document
which CapBall modes are included and what a player sees if Lagos Lifestyle
is unavailable. Avoid coupling every game mode to the partner service.

Acceptance: the flow maps to documented partner capabilities; unresolved
requirements are explicitly recorded.

### 2. Add an isolated adapter and sandbox harness

Keep partner SDK, launch parsing and lifecycle translation outside MatchStore,
physics and scoring rules. Use an explicit opt-in integration setting, disabled
by default. Put credentials and privileged API operations on the server when
the official contract requires them. Do not put server secrets in VITE variables.

Build fixtures from official examples and a harness matching the actual launch
surface. For an iframe/message bridge, validate both the exact origin and sender;
do not add a permissive message listener before origins and schema are known.
If the platform launches an external browser, do not build an unnecessary bridge.

Acceptance: launch, unsupported version, expired credentials, cancellation and
partner unavailability are tested; ordinary CapBall startup remains independent.

### 3. Add identity or result delivery only when in scope

Link accounts only after verifying both identities and obtaining the player's
choice. Display-name matching is not an identity link. Preserve the existing
account/save when linking, unlinking or cancelling.

For results/rewards, persist a stable event identifier and delivery status on the
server. Retries must reuse that identifier. Submit after a committed final result;
do not award from client score changes, replays or local storage. Define retry
limits and reconciliation using the partner's contract before enabling rewards.
Local, AI, LAN and browser-hosted live matches need an explicit trust policy;
the current clients alone cannot independently prove those outcomes.

Acceptance: duplicate delivery, retries after timeouts, abandoned matches,
shootouts, rematches and replay viewing cannot produce duplicate rewards.

### 4. Verify the real host, then enable

Test the sandbox integration on actual supported phones/webviews. Confirm
orientation, safe areas, touch aiming, audio, back/exit behavior, camera permission,
network loss and app backgrounding. Verify partner failure does not destroy a
CapBall save or prevent standalone/LAN play.

Run `npm run check` and partner contract tests. Recheck the saved-turn production
prerequisites if using that server for authoritative results. Merge/enable only
after sandbox validation; retain a way to disable the partner adapter without
disabling CapBall.

## Test matrix to implement with the official contract

| Scenario | Expected behavior |
| --- | --- |
| Ordinary standalone or offline launch | Existing menus, saves and LAN work without a partner dependency. |
| Valid partner launch / cancelled launch | Enter the agreed flow / return cleanly without changing accounts. |
| Invalid, expired or replayed launch credentials | No identity link, result submission or reward; clear recovery path. |
| New and existing CapBall accounts | Explicit linking behavior, no silent save overwrite. |
| Host pauses/backgrounds during play | Clock and input follow the agreed lifecycle; resume preserves state. |
| Normal finish / shootout / resignation | Exactly the documented final outcome is delivered. |
| Goal replay / rematch / restored result screen | No duplicate final event or reward. |
| API timeout / rate limit / repeated delivery | Bounded retries with stable identity and visible delivery state. |
| Forged client result or host message | Rejected by the appropriate server/bridge validation. |
| Partner unavailable or integration disabled | Standalone play remains available; pending delivery handled as specified. |

## Current readiness boundary

This branch prepares the integration plan and maps it to the codebase. It does
not implement SSO, an embedded launch, partner result delivery, or rewards, and
does not claim sandbox or real-device verification. Those require the official
contract and the selected player journey.
