# Journey: join-pay-authorize-now (PaymentSheet opens, Path 2)

<!--config
persona: sophie_joiner
seedProfile: authorize-now
model: sonnet
max_steps: 28
timeout_min: 15
-->

## Setup (driver-provided)
Requires a seeded in-app padel game with the **authorize-now** profile (game date WITHIN
remove_reserved_hours — i.e. < 5h away today; driver runs `seed_kinshasa_games.js --profile
authorize-now --live` and provides `SEED_GAME_ID` and `SEED_GAME_NAME` (the game has a [profile] suffix in its name to distinguish it from other test games — open THAT one).. Persona **sophie_joiner**.

## What this tests (V5 model, Path 2)
When a game is WITHIN remove_reserved_hours of start, tapping "Rejoindre" opens the **Stripe
PaymentSheet directly** — `letsPay` creates a PaymentIntent with `capture_method: "manual"` (a HOLD,
not a charge). This journey verifies the PaymentSheet **appears with the correct amount and
currency** at the right time. It does NOT complete payment (LIVE keys — never enter a card).

## Goal
Log in, open the close-in padel game, tap join, and confirm the **Stripe PaymentSheet opens showing
the correct price (€5 / EUR)**. Then STOP — do not enter a card.

## Expected happy path
1. Email+password login → Home.
2. Navigate to the padel game near Kinshasa (it starts within ~5h).
3. Open the game sheet. Tap **"Rejoindre ce match" / "Book my spot"**.
4. A **Stripe PaymentSheet appears** prompting for card details, showing an amount in **€/EUR**
   (the €5 game price, possibly plus fees).
5. **STOP here.** Report the PaymentSheet's amount + currency as an `info` red flag with the
   screenshot, then `done`.

## Success criteria (mark `done`)
- The Stripe PaymentSheet **opened** on join, AND
- It shows a **EUR** amount consistent with the game price (≈ €5, plus any fees).
- You have NOT entered any card details.

## Red flags — severity `block`
- **Wrong currency** on the PaymentSheet (anything not €/EUR).
- **Wrong amount** (not ≈ €5 for the €5 game; a wildly different figure).
- No PaymentSheet appears at all on a within-window join (contradicts Path 2), OR the join silently
  charges/confirms without a sheet.
- App crash / error dialog.
- Non-localized string on the sheet or game sheet.

## Red flags — severity `info` (expected, report it)
- The PaymentSheet itself: record the exact amount + currency shown. This is the artifact this
  journey captures.

## Red flags — severity `warn`
- PaymentSheet slow to appear (> 10s).
- Broken layout / spelling on the game sheet.

## Notes for the agent
- **ABSOLUTELY NEVER enter a card number** — these are LIVE Stripe keys; any card = a real charge.
  Your job ends when the PaymentSheet is visible and you've recorded its amount/currency.
- Screens may be FR/EN/ES/IT.
