# Journey: signup-new-user

<!--config
persona: FRESH
model: sonnet
max_steps: 45
timeout_min: 20
-->

## Persona
A **brand-new user** signing up from scratch. This journey does NOT use a pre-provisioned account —
the driver generates a fresh throwaway email of the form `test_signup_<timestamp>@poteau-test.internal`
(provided as `SIGNUP_EMAIL` in the run context) and the account is created through the app's real
signup flow, then torn down after the run.

Because signup writes the 4-digit `email_code` to Firestore and the app verifies it CLIENT-SIDE,
the driver injects the ACTUAL 4-digit code as a "LIVE HINT" in each step message once the account is created. On the PIN screen, type the DIGITS from that live hint (never the literal text "LOGIN_CODE").

## Goal
Complete the entire new-user onboarding funnel end-to-end, from the welcome screen to landing on
Home as a fully set-up player.

## Expected happy path
1. Welcome screen → tap "Continue with email".
2. On the create-account screen, enter `SIGNUP_EMAIL`, choose/enter a password `SIGNUP_PASSWORD`,
   and submit.
3. A 4-digit code screen (EmailValidation) appears → type the 4 DIGITS given in the LIVE HINT (not the words "LOGIN_CODE").
4. Onboarding steps follow in THIS ORDER (verified against the app's routing chain) — complete
   each with plausible values, tapping the continue/next affordance each time:
   1. **Name / nickname** (a_nickname): enter a display name ≥ 4 chars.
   2. **Photo** (b_photo): tap "Choose my photo" → the native iOS photo picker opens → select the
      first available image (the sim library is pre-seeded with one) → confirm/use it. If a photo
      permission dialog appears, tap "Allow"/"Select Photos". There is NO skip button here; you must
      pick the seeded photo to advance.
   3. **Phone** (c_phone): country defaults to the locale; enter `SIGNUP_PHONE` (valid DRC number).
   4. **Sport** (d_sports): pick a sport (soccer or padel) and a role if asked.
   5. **Location / area** (e_area): set/confirm a location (Kinshasa).
   6. **Timeslots** (f_timeslots): pick some availability slots if asked, else continue.
   7. **Players / invite** (g_players): skip inviting anyone / continue.
   8. **Share** (h_share): skip / continue.
   9. **Games** (i_games): continue.
   (A level self-assessment or quiz may appear along the way — pick a mid value and continue.)
5. Land on the **Home** screen ("Hi <name>!").

## Success criteria (mark `done`)
- The app reaches the Home screen with the user's name shown, AND
- `last_onboarding_step` has advanced to `complete` (the app no longer forces onboarding).

## Red flags — severity `block`
- App crash or fatal error at any onboarding step.
- The correct 4-digit code is rejected.
- An onboarding step **hard-blocks with no way forward** given valid input (dead-end funnel).
- A **non-localized string** (raw i18n key, `[missing]`, wrong-language text) on a core signup screen.
- The account gets **auto-banned** during signup (the app bans after 3 signups from one device unless
  the email whitelists it — the driver handles the whitelist; if a ban screen appears anyway, flag it).

## Red flags — severity `warn`
- Any onboarding step's loading state stuck > 10s.
- Spelling/grammar mistake in the persona's language.
- Layout broken (overflow, off-screen, overlap).
- An onboarding step is confusing or the "continue"/"skip" affordance is unclear.

## Notes for the agent
- Reason from what's on screen; screens may be FR/EN/ES/IT.
- This is the FUNNEL test — note friction at each step (a `warn` per confusing step is valuable
  even if you get through it).
- Never invent a real phone; use `SIGNUP_PHONE` from context. Never enter a Stripe card.
