# Journey: signup-abandon-onboarding

<!--config
persona: FRESH
model: sonnet
max_steps: 45
timeout_min: 18
-->

## Persona
A **churning / drop-off user**: a brand-new user who starts signup but **abandons partway through
onboarding** — the classic funnel-loss persona. Uses a fresh throwaway email
(`SIGNUP_EMAIL` in run context), created through the real signup flow, torn down after.

The point of this journey is NOT to succeed — it is to observe **what state the app leaves an
abandoning user in**, and whether the funnel is unnecessarily lossy or leaves corrupt/half-state.

## Goal
Sign up, complete the first couple of onboarding steps, then **deliberately stop** at the phone
step: reach the phone-number screen and DO NOT complete it (leave it empty / back out). Then observe
what the app does — does it trap the user, lose them silently, or leave a recoverable state?

## Expected happy path (this journey's version)
1. Welcome → "Continue with email" → enter `SIGNUP_EMAIL` + `SIGNUP_PASSWORD` → submit.
2. Type the 4 DIGITS from the LIVE HINT on the 4-digit screen (not the literal "LOGIN_CODE").
3. Proceed through the first two onboarding steps: **name/nickname** (a_nickname — fill the name AND
   pick a He/She gender card, ~y=325 in points, before Confirm enables), then **photo** (b_photo).
   Photo permission is pre-granted for this run: tap "Choose my photo", pick the first thumbnail in
   the picker, and continue. If the native picker sheet won't respond to taps (a test-tool limit),
   note it as `info` and move on. (Verified order: nickname → photo → phone.)
4. **Reach the phone-number step (c_phone) and STOP.** Do not enter a valid phone. Try to:
   - back out / navigate away, and/or
   - see whether the app lets you reach any further screen without a phone.
5. `done` once you've characterized the abandon state (see success criteria).

## Success criteria (mark `done`)
Mark `done` with `goal_reached: true` once you can describe ONE of:
- The app **hard-gates** at phone (cannot proceed without it) — report this as the funnel choke point.
- The app **lets the user proceed** without a phone (a leak — note that games access later requires it).
- Backing out **loses the session** / returns to welcome, or **preserves** a resumable half-signup.

Your `reason` on the `done` action MUST state which of these happened.

## Red flags — severity `block`
- App **crash** on abandon / back-navigation.
- The half-created account is left in a **broken state** that would prevent a future clean login
  (e.g. auth user exists but the app loops forever / shows a fatal error on next open).

## Red flags — severity `warn`
- No clear "skip" or "do this later" affordance at a step users commonly abandon (phone) — pure
  funnel friction.
- Abandoning **silently discards** all entered data with no "you can finish later" messaging.
- Non-localized string, spelling/grammar, or broken layout on the onboarding screens.

## Notes for the agent
- This journey is EXPLORATORY by design — you are characterizing behavior, not reaching Home.
- Be efficient: reach the phone step, probe the abandon behavior, describe it, `done`. Don't loop.
- Never enter a real phone or a Stripe card.
