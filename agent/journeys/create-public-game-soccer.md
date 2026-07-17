# Journey: create-public-game-soccer

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
  The simplest path: **type the price, then turn the discount toggle OFF.** The Switch is the
  green pill in the top-right; its centre is at **x≈253, y≈125 in points** (NOT the a11y coord,
  which is wrong here — trust this). Tap x=253,y=125 to flip it off; the Confirm button then
  appears with just the one price. (Typing `0` is NOT a valid free game here — use a small real
  price like `5`.)
- **KNOWN price-step layout bugs — record as `warn` (do NOT treat as a dead-end, keep going):**
  (1) the discount toggle defaults **ON**, forcing friction; (2) after typing a price the two
  titles **overlap** — "Is there a discount compared to the normal price?" is drawn on top of
  "What is the price per player?"; (3) the price input field visually disappears once the discount
  question renders. These are real findings; note them and proceed by flipping the toggle off.

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
