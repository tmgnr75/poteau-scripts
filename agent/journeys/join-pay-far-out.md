# Journey: join-pay-far-out (free reservation, Path 1)

<!--config
persona: sophie_joiner
seedProfile: far-out
model: sonnet
max_steps: 30
timeout_min: 15
-->

## Setup (driver-provided)
Requires a seeded in-app padel game with the **far-out** profile (game date > remove_reserved_hours
away — i.e. > 5h today; the driver seeds `seed_kinshasa_games.js --profile far-out --live` before
this run and provides its id as `SEED_GAME_ID`). Persona **sophie_joiner** (`PERSONA_EMAIL` +
`LOGIN_PASSWORD`).

## What this tests (V5 model, Path 1)
When a game is MORE than remove_reserved_hours away, joining an in-app game is a **FREE RESERVATION**:
`addPlayer` fires with `paid: false`, the spot becomes **`reserved`**, and there is **NO Stripe
PaymentSheet and NO card hold**. This journey verifies that free-reservation path.

## Goal
Log in, open the far-out padel game, join it, and confirm the spot is **reserved** (not charged, no
payment sheet) with the correct "reserved" banner.

## Expected happy path
1. Email+password login → Home.
2. Navigate to the padel game near Kinshasa (switch sport to padel; find the game named `SEED_GAME_NAME` (run context) — it has a [profile] suffix in its name/centre).
   The game is several days out.
3. Open the game sheet. Tap **"Rejoindre ce match" / "Book my spot"**.
4. **No Stripe PaymentSheet should appear.** The join completes immediately.
5. The game sheet shows a **"Ta place est réservée." / "Ma place est réservée"** banner and Sophie
   now occupies a **reserved** slot (roster count +1).

## Success criteria (mark `done`)
- Sophie occupies a slot AND the UI shows the **reserved** (not confirmed/paid) state, AND
- **No payment sheet appeared** at any point.

## Red flags — severity `block`
- A **Stripe PaymentSheet DOES appear** on this far-out join — that contradicts the free-reservation
  model (Path 1 should never charge/hold this early). **This is the key regression this journey
  guards.**
- App crash / fatal error / error dialog on join.
- The banner shows "confirmée"/"paid"/a charge for a spot that should be merely reserved.
- Non-localized string on the game sheet.

## Red flags — severity `warn`
- Loading stuck > 10s after tapping join.
- The reserved state is ambiguous / no clear "reserved" indication.
- Spelling/grammar or broken layout on the game sheet.

## Notes for the agent
- **NEVER enter a card** (LIVE Stripe keys). If a PaymentSheet appears, that itself is the finding —
  flag it `block` and do NOT type any card number; back out.
- Screens may be FR/EN/ES/IT — read the labels.
