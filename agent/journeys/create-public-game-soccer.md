# Journey: create-public-game-soccer

<!--config
persona: marc_organizer
model: sonnet
max_steps: 40
timeout_min: 18
-->

## Persona
Log in as **marc_organizer** (`PERSONA_EMAIL` + `LOGIN_PASSWORD` in run context) — an existing,
fully-onboarded player in Kinshasa. Use the email+password login (goes straight to Home).

## Goal
Create and publish a **public soccer game** through the app's create-game wizard, and confirm it
was published (appears back on the organizer's games / is publicly discoverable).

## Expected happy path
The create flow is a multi-step wizard reached via the **`+`** button on the Home "Games" section.
Steps (order may vary slightly by sport):
1. Home → tap the **`+`** to start a new game.
2. **Sport**: choose **Soccer** (football).
3. **Location**: pick / confirm a Kinshasa venue or address.
4. **Date & time**: choose a date a few days out and a start time.
5. **Type & visibility**: set visibility to **Public** (visible to everyone in discovery). Pick a
   field/game type if asked (e.g. 5-a-side).
6. **Level & mood**: pick a level band and a mood (e.g. "chill").
7. **Price / payment**: choose a payment type. Prefer **on-site** (free/no in-app payment) to avoid
   any Stripe involvement in a creation test. If only in-app is available, set a small price but do
   NOT proceed into any card entry.
8. **Summary**: review, then tap **"Publier mon match" / "Publish"**.
9. Land back on the game sheet or Home with the new game shown as published.

## Success criteria (mark `done`)
- The wizard completes and the game is **published** — the app shows the created game (game sheet
  with the organizer as captain, or it appears in the organizer's games list), OR a clear
  "published/created" confirmation.

## Red flags — severity `block`
- App crash or fatal error during the wizard.
- A wizard step **rejects valid input** with no way forward (dead-end).
- Publish **fails** with an error dialog on otherwise-valid inputs.
- Wrong currency shown on the price step (anything other than €/EUR for a EUR game).
- Non-localized string (raw i18n key / wrong language) on a wizard screen.

## Red flags — severity `warn`
- A wizard step's loading/spinner stuck > 10s.
- Spelling/grammar mistake in the persona's language.
- Layout broken (overflow, off-screen, overlapping) on any wizard screen.
- The public/private choice is unclear or mislabeled.

## Notes for the agent
- Reason from what's on screen; screens may be FR/EN/ES/IT.
- Keep it a CREATION test: choose on-site payment if possible so no Stripe sheet appears. If a
  Stripe PaymentSheet ever appears, STOP and flag `info` — never enter a card (LIVE keys).
- Beeline through the wizard with sensible defaults; don't over-explore each option.
