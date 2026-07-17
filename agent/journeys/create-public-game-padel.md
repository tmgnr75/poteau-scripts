# Journey: create-public-game-padel

<!--config
persona: marc_organizer
model: sonnet
max_steps: 60
timeout_min: 20
-->

## Persona
Log in as **marc_organizer** (`PERSONA_EMAIL` + `LOGIN_PASSWORD` in run context) — an EXISTING,
fully-onboarded player in Kinshasa. Do NOT create a new account. From the welcome screen tap
"Continue with email", then choose **"I already have a Poteau account" / the log-in option (NOT
create-account)**. Enter `PERSONA_EMAIL` and `LOGIN_PASSWORD`, then confirm — a correct login goes
straight to Home. If the email field doesn't seem to register your text, tap the field once to focus
it and re-type. (If a 4-digit PIN screen appears, type `LOGIN_CODE`.)

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


## Correct usage / known behaviour (do not misjudge)
- **If a tap doesn't register, TRUST THE SCREENSHOT, not the a11y coordinate.** The `describe-all`
  y-coordinate is sometimes offset/stale. When an element clearly visible in the screenshot doesn't
  respond after ONE tap at its a11y coord, retap at the point you visually estimate from the
  screenshot (screenshot is 1206×2622 px = 402×874 pt, so divide screenshot px by 3 for points).
  Do NOT declare a dead-end after repeated identical taps at the same (wrong) coordinate.
- **Location picker:** the **"Kinshasa – Test"** popular card is a big white button roughly centred
  at **x≈176, y≈261 in points**. Tap its centre. It advances to the date step.
- **"Field booked?" branch:** if the create flow asks whether you have a field/court booked, choose
  **"Yes, I've booked it"** (the interesting path). The no-field path is a dead-end; skip it.
- **Level selector ("What is the game's level?"):** a TAPPABLE segmented bar (5 segments:
  `1-2 | 3-4 | 5-6 | 7-8 | 9+`) spanning the screen width, just below the title (~y150 in points).
  On a new game the segments start DIMMED; tapping one brightens it (selects it) and reveals the
  mood section + a Confirm button below. Tap "5-6" (~x=152, y=150 in points; segments are centred
  at roughly x=60, 105, 152, 200, 250), confirm it brightened, then tap Confirm to proceed.
- **Price step ("What is the price per player?"):** the screen starts as just a `€` text field with
  NO Confirm button. You MUST tap the field to focus it and TYPE a numeric price (e.g. `5`). Once a
  price is entered, a **"There's a discount vs. the usual price" toggle appears, defaulted ON** — and
  while it's ON the Confirm button stays hidden until you ALSO fill a second "usual price" field.
  The simplest path: **type the price, then turn the discount toggle OFF** (tap the Switch on the
  right of the discount row); the Confirm button then appears with just the one price. Record a
  `warn` that the discount toggle defaulting ON is confusing friction, but DO turn it off and
  continue. (Typing `0` is NOT a valid free game here — use a small real price like `5`.)

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
