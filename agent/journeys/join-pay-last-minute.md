# Journey: join-pay-last-minute (< T-1h, capture window)

<!--config
persona: sophie_joiner
seedProfile: last-minute
model: sonnet
max_steps: 26
timeout_min: 12
-->

## Setup (driver-provided)
Requires a seeded in-app padel game with the **last-minute** profile (game date ~45 min out, i.e.
inside the T-1h capture window `handlePaymentAuth` acts on). Driver runs `seed_kinshasa_games.js
--profile last-minute --live`, provides `SEED_GAME_ID` and `SEED_GAME_NAME` (the game has a [profile] suffix in its name to distinguish it from other test games — open THAT one). Persona **sophie_joiner**.

## What this tests (V5 model — the T-1h edge)
Inside T-1h, `handlePaymentAuth` captures (game full) or cancels (not full) authorized holds. Joining
this close should still open the Stripe PaymentSheet (Path 2), but the capture/cancel decision is
imminent. This journey verifies the app behaves sanely at the very-close-to-kickoff edge: either the
PaymentSheet opens with the right amount, OR the app clearly communicates it's too late to join.

## Goal
Log in, open the last-minute padel game, tap join, and characterize the behavior:
- Does the PaymentSheet still open (with correct €/EUR amount)? OR
- Does the app show a "too late to join / game starting soon" state?
Either can be correct — the journey verifies it's coherent and correctly labeled, not broken.

## Expected happy path
1. Login → Home → open the last-minute padel game (starts in < 1h).
2. Tap **"Rejoindre ce match" / "Book my spot"**.
3. Observe: PaymentSheet opens (record amount/currency, then STOP — no card) OR a clear
   too-late/closed state.
4. `done` describing which happened.

## Success criteria (mark `done`)
- You characterized the last-minute join behavior, AND
- If a PaymentSheet appeared, it showed a **EUR** amount ≈ €5 and you did NOT enter a card.

## Red flags — severity `block`
- Wrong currency / wrong amount on the PaymentSheet.
- App crash / error dialog.
- The app lets you "join" but leaves an **inconsistent state** (e.g. shows confirmed with no sheet
  and no hold), or charges without a sheet.
- Non-localized string.

## Red flags — severity `info`
- The PaymentSheet amount/currency (record it), OR the exact "too late" messaging shown.

## Red flags — severity `warn`
- Ambiguous state at the deadline (unclear whether the join worked).
- Loading > 10s, spelling/grammar, or broken layout.

## Notes for the agent
- **Never enter a card** (LIVE keys). PaymentSheet visible + amount recorded = your job is done.
- Screens may be FR/EN/ES/IT.
