# Journey: create-public-game-padel

<!--config
persona: marc_organizer
model: sonnet
max_steps: 40
timeout_min: 18
-->

## Persona
Log in as **marc_organizer** (`PERSONA_EMAIL` + `LOGIN_PASSWORD` in run context) — an existing,
fully-onboarded player in Kinshasa. Email+password login → straight to Home.

## Goal
Create and publish a **public padel game** through the create-game wizard, and confirm it published.
Padel differs from soccer in the wizard (fixed 4-player format, padel-specific level bands / field
type), so this exercises the padel branch of the flow.

## Expected happy path
1. Home → tap the **`+`** to start a new game.
2. **Sport**: choose **Padel**.
3. **Location**: pick / confirm a Kinshasa venue.
4. **Date & time**: a few days out, a start time. Padel duration commonly defaults to ~90–120 min.
5. **Type & visibility**: set **Public**. Padel is typically 4 players / 2v2 — accept the default
   format.
6. **Level & mood**: pick a padel level band and a mood.
7. **Price / payment**: prefer **on-site** to avoid Stripe. If in-app only, set a small price but
   never enter a card.
8. **Summary** → **"Publier mon match" / "Publish"**.
9. Back to game sheet / Home with the padel game published.

## Success criteria (mark `done`)
- The wizard completes and the padel game is **published** and shown (game sheet as captain, or in
  the organizer's games), or a clear published confirmation.

## Red flags — severity `block`
- Crash / fatal error during the wizard.
- A step rejects valid input with no way forward.
- Publish fails with an error on valid inputs.
- Wrong currency on the price step.
- Non-localized string on a wizard screen.
- **Padel-specific breakage**: padel format/fields don't render or force an invalid config (e.g.
  can't set 4 players, padel level bands missing).

## Red flags — severity `warn`
- Loading stuck > 10s on a step.
- Spelling/grammar mistake in the persona's language.
- Broken layout on any wizard screen.
- Padel options confusingly presented vs soccer.

## Notes for the agent
- Reason from screen contents; languages vary (FR/EN/ES/IT).
- Creation test — pick on-site payment so no Stripe sheet appears; if one does, STOP + flag `info`,
  never enter a card (LIVE keys).
- Beeline through with sensible defaults.
