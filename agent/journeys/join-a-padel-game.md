# Journey: join-a-padel-game

<!--
Machine-readable config for the driver. Keep this HTML-comment block at the top.
model: sonnet | opus   (visual-reasoning tier for the decision agent)
persona: which test account to log in as (email local-part, without the domain)
max_steps: hard cap on perceive→decide→act iterations
timeout_min: wall-clock budget
-->
<!--config
persona: sophie_joiner
model: sonnet
max_steps: 40
timeout_min: 20
-->

## Persona
Log in as the test account **sophie_joiner** (`test_sophie_joiner@poteau-test.internal`), a
French-speaking padel player based in Kinshasa. This is an EXISTING account — do NOT create a new
one. From the welcome screen, tap "Continue with email", then choose the "I already have a Poteau
account" / log-in option (NOT create-account). Enter the email `PERSONA_EMAIL` and the password
`LOGIN_PASSWORD` (both provided in the run context), then confirm. A correct email+password login
goes straight to the Home screen. (If a 4-digit PIN screen ever appears instead, type `LOGIN_CODE`.)

## Goal
Find the upcoming **padel** game near Kinshasa and **join it**, going through the in-app payment
step, until Sophie is confirmed as a participant (occupying one of the open team slots).

## Expected happy path
1. App opens on a welcome screen. Tap "Continue with email", pick the log-in (not sign-up) option,
   enter `PERSONA_EMAIL` + `LOGIN_PASSWORD`, confirm → land on Home.
2. Land on the home / games discovery screen. The location is Kinshasa; a single upcoming padel
   game ("Kinshasa Padel Test") should be visible or reachable via the games/discovery feed.
   You may need to switch the sport filter to **padel** if it defaults to soccer.
3. Open that game's detail sheet. It shows 4 max players, 3 open spots, price €5.
4. Tap the join / "I'm in" / register action. Choose a team slot if prompted.
5. An in-app payment sheet (Stripe) appears showing **€5**. Complete it. (In the sim, the payment
   sheet may require a test card — if a card field appears, report it as `info` and describe what
   you see; do not invent card numbers unless the run context provides `TEST_CARD`.)
6. Return to the game showing Sophie as a confirmed participant / one fewer open spot.

## Success criteria (mark the goal `done`)
- Sophie appears as an attendee / occupies a team slot in the game she joined, OR
- The app shows an explicit post-join confirmation state for that game (e.g. "You're in",
  a confirmed spot, a receipt, or the join button turned into a leave/cancel action).

## Red flags — severity `block` (stop the run, fail it)
- The app **crashes** or shows a fatal error screen at any point on this happy path.
- An **error dialog / snackbar** appears on a normal happy-path action ("Something went wrong",
  a stack trace, a 500, "please try again").
- The Stripe / payment sheet shows the **wrong currency** (anything other than €/EUR) or a
  **wrong amount** (not €5 for the €5 game).
- A screen shows an obviously **non-localized string** in the persona's language — e.g. a raw i18n
  key like `r1en1q7b`, `[missing translation]`, or English text where French is expected on a
  core screen.
- Login rejects the correct 4-digit code, or the account appears **banned**.

## Red flags — severity `warn` (note it, keep going)
- A loading spinner / skeleton is stuck for **more than 10 seconds** on any screen.
- A visible **spelling or grammar** mistake in the persona's language.
- **Layout obviously broken**: text overflowing its container, cut-off buttons, content off-screen,
  overlapping elements, an unreadable contrast.
- The padel game is hard to find (e.g. discovery defaults to soccer with no obvious padel switch).

## Notes for the agent
- Reason from what's actually on screen. Screens may be in French, English, Spanish, or Italian —
  don't assume language; read the labels. The persona here is French.
- Prefer tapping elements identified in the accessibility tree (you'll get a list of labeled
  elements with tap coordinates). Fall back to coordinates from the screenshot only if the tree
  is empty.
- Beeline for the goal. Don't explore settings, profiles, or unrelated tabs.
- If you're stuck on the same screen for 3+ steps with no progress, try scrolling, then report a
  `warn` red flag describing what's blocking you.
- Be DECISIVE with forms: if a field already shows a plausible filled value (even if styled
  greyed/placeholder-like) and a Confirm/Save button is enabled, TAP CONFIRM rather than
  re-editing the field. Don't loop re-checking a field that already has a value.
- The test account's profile is already complete (photo, phone, name all set). You should NOT
  normally hit an onboarding / "complete your profile" gate — if you do and a field looks filled,
  just confirm through it.
