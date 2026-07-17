# Journey: signup-new-user

<!--config
persona: FRESH
model: sonnet
max_steps: 75
timeout_min: 25
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
   1. **Name / nickname** (a_nickname, "Let's go 👊"): enter a display name ≥ 4 chars in "Your name
      on the field", THEN pick a gender under "When we talk about you, we say…" — two cards **He**
      and **She**. These cards sit HIGH on the screen (around **y≈325 in points**, NOT down near the
      Confirm button); tap the CENTRE of the "He" card (~x=82, y=325) or "She" (~x=224, y=325).
      Confirm stays GREYED/disabled until BOTH the name is filled AND a gender is picked — once both
      are set it enables (bottom bar ~y=780). Don't tap Confirm before picking a gender.
   2. **Photo** (b_photo): the app shows a "Choose my photo" step. Photo permission is PRE-GRANTED
      for this run (no dialog should appear). Tap "Choose my photo" — the native iOS photo picker
      opens showing the seeded image. Tap the first thumbnail to select it; the app should then set
      the avatar and advance to phone. **KNOWN TEST LIMITATION:** the native iOS picker is Apple's
      own UI and often can't be driven by the automation tool. If after tapping "Choose my photo"
      the picker sheet won't respond to taps (thumbnails are dead targets), this is a TEST-TOOL
      limit, NOT app friction — record it as `info` (label it a test-harness limitation) and mark
      the journey `done` describing that the funnel reached the photo-picker step and would continue
      normally on a real device. Do NOT deny the permission and do NOT report a blocking dead-end
      for the native picker.
   3. **Phone** (c_phone): a country code is pre-selected (may default to +1 US — that is FINE, do
      NOT fight the country picker). Tap the phone number text field and type **`0812345670123`**
      (the field is validated on ≥11 typed digits, so use these 13 digits). Then tap Confirm/Valider.
      IMPORTANT: type the digits exactly ONCE. If the field shows duplicated/extra text from a prior
      attempt, tap the field, use "Select All" then re-type once. Do NOT touch the country selector.
   4. **Sport** (d_sports): pick a sport (soccer or padel) and a role if asked.
   5. **Location / area** (e_area): set/confirm a location (Kinshasa).
   6. **Timeslots** (f_timeslots): pick some availability slots if asked, else continue.
   7. **Players / invite** (g_players, "These players were waiting for you"): the **"Continuer"/
      "Continue" button ONLY appears once you have Added at least one player** — there is NO pure
      skip/"maybe later" affordance. All suggested players are TEST accounts (names end in " T.");
      it is SAFE to **tap "Add" on exactly ONE of them** (e.g. the first, "… T.") to reveal the
      Continue button, then tap Continue. Never tap "Add" on anyone whose name does NOT end in "T.".
      **KNOWN FINDING to record as `warn`:** if the suggested list comes back EMPTY (no compatible
      players — happens for a new user with narrow availability or a low-density area), the screen
      dead-ends: only a back chevron exists, no Continue. If you see the empty state, record the
      dead-end `warn` and (since you can't go forward) mark the journey `done` describing it — that
      empty-state dead-end IS the finding.
   8. **Share** (h_share): skip / tap **"Continuer" / "Continue"** (bottom of screen).
   9. **Games** (i_games): tap **"Continuer" / "Continue"** to finish.
   (A level self-assessment or quiz may appear along the way — pick a mid value and continue.)
5. Land on the **Home** screen ("Hi <name>!").

## Success criteria (mark `done`)
- EITHER the app reaches the Home screen with the user's name shown (ideal — the full funnel worked),
- OR the funnel progresses normally up to the native photo picker and stops ONLY because the native
  iOS picker can't be driven by the automation tool (a labeled test-tool limitation, not app
  friction) — in that case still mark `done` and describe how far a real user gets.
  (When Home is reached, also confirm `last_onboarding_step` advanced to `complete`.)

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
- **FINDING THE CONTINUE BUTTON (important):** most onboarding screens have a Continue/Confirm/
  "Continuer"/"Valider" button. It is almost always in the ACCESSIBILITY ELEMENT LIST — look there
  FIRST for a Button whose label is Continue/Continuer/Valider/Suivant/Confirm and tap its listed
  coordinates. Its y is usually ~760–790 in points (a fixed bottom bar). Do NOT scroll repeatedly
  hoping it appears — if it's in the element list, tap it; if a grid (timeslots) fills the screen,
  the Continue button is a SEPARATE fixed element below/over the grid, still in the a11y list.
- On the **timeslots** grid: selecting ONE slot is enough; then find and tap the Continue button
  from the element list (don't keep scrolling the grid).
- If after 2 scrolls you can't find a Continue button, tap the a11y element that looks most like a
  primary bottom button rather than continuing to scroll.
