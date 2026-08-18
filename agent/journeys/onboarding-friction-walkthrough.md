# Journey: onboarding-friction-walkthrough

<!--config
persona: FRESH
model: opus
max_steps: 80
timeout_min: 30
-->

## What this is
This is NOT a pass/fail task. It is a **UX evaluation of the new-user onboarding flow**, done by
behaving like a real first-time user. The deliverable is a *friction report*: every point where a
real person would hesitate, get confused, get stuck, or drop off. Getting "stuck" is NOT a failure
of the test — it IS the finding. Do not look for shortcuts; behave like a genuine confused user and
REPORT what you experience.

## Persona
A brand-new user installing Poteau for the first time. Signing up with a fresh email
(`SIGNUP_EMAIL` in run context). You are NOT a power user — you don't know the app. React the way a
normal person would: if a button isn't obvious, that's friction. If a field rejects your input
without explaining why, that's friction. If you can't tell what to do next, that's friction.

## How to behave (IMPORTANT — this overrides the usual "beeline to the goal")
- Move through onboarding screen by screen like a real user, entering plausible real-person values.
- **At EVERY screen, before acting, assess it as a UX critic** and record friction via `red_flag`
  with the right severity (see rubric). Then take the most natural next action a real user would.
- When you enter data, use what a REAL user would: a normal name, a normal local phone number
  (e.g. `612345678` — a typical French mobile without country code, since the default country is
  usually pre-selected), a real-seeming choice. Do NOT engineer inputs to satisfy hidden validation
  (e.g. don't pad a phone number to a magic length) — if the app rejects a normal input silently,
  THAT is the top kind of finding.
- If you get stuck for 2-3 steps with no obvious way forward, STOP fighting it: record a `block`
  red flag describing exactly what a real user would experience ("I selected a slot but there's no
  visible Continue button; a real user would be stuck here"), then, ONLY to keep surveying later
  screens, try one reasonable recovery. If truly stuck, `done` and report how far a real user gets.
- Do NOT tap the same element more than ~3 times. Repetition ≠ progress; it's a finding.

## The OTP / email code (sim limitation — read this)
A real user receives the 4-digit code by EMAIL. The simulator has no email inbox, so the code is
provided to you as a LIVE HINT in each step (read from the backend). Treat this as: "the user read
the code from their email." Type it like a user would on the PIN screen. **If the PIN field does not
accept your typed input or no keyboard appears, REPORT THAT as a finding** — note it may be a test-
tool limitation OR a real keyboard/focus issue; say you couldn't confirm which.

## Correct usage of two screens (so you don't misjudge them as broken)
These behaviours are INTENTIONAL and known-good — do NOT flag them as blockers:
- **Availability grid ("When do you want to play?")** is a RANGE selector, not single-cell taps.
  To pick a time on a day, tap the START slot then the END slot in the SAME day-column, and it
  selects the whole range between them. Example: to be free Thursday 19:00–20:00, tap Thu 19:00 then
  Thu 20:00. To confirm just one 30-min spot, tap the SAME cell as both start and end (tap Thu 19:00,
  then Thu 19:00 again). You can select a whole column (a full day) or a row. After you've defined a
  range, the "Valider" / Continue button appears — select a range first, THEN look for it.
- **Invite step ("These players were waiting for you")**: in PRODUCTION this reveals a timed
  "Continuer"/skip button after ~10s (A/B-tested conversion design). In THIS test build, the
  suggested players are all TEST accounts (their names end in " T." — Marc T., Sophie T., Liam T.,
  Noah T., etc. — the isolation filter guarantees only test accounts appear here). Because they are
  test accounts (not real users), it is SAFE to tap "Add" on ONE of them to proceed. So: tap "Add"
  on the first suggested player (a "… T." test account), which reveals the "Continuer" button, then
  tap Continuer. (If a timed Continue/skip button appears first without adding anyone, use that
  instead — but do not wait forever; adding a test account is a safe way forward here.)

## Screens to walk (the real onboarding funnel, in order)
welcome → email → password → **email code (PIN)** → name/nickname → **photo** → phone → sport →
location → timeslots → invite players → share → games → Home.
Expect the photo step to open the native iOS photo picker (that IS the real experience — evaluate
it). Expect a permission dialog on photo and on location — respond as a normal user would (a real
user might Allow OR Deny; default to Allow, but if you Deny, evaluate what happens).

## Success criteria (mark `done`)
`done` when EITHER: you reach the Home screen ("Hi <name>!"), OR you hit a point where a real user
would genuinely be stuck / would abandon. In your final `reason`, state how far a real user gets and
the single biggest drop-off risk you observed.

## Red-flag rubric (this is the actual report — be generous and specific)
- `block` — a genuine dead-end: no visible way forward given a normal user's input; a crash; the
  app rejects valid-looking input with NO explanation and no recovery.
- `warn` — real friction that wouldn't stop everyone but would lose some: a Confirm button that
  stays disabled with no reason shown; a required step with no skip; a control that's hard to find
  (Continue button not obvious); a confusing label; a permission denial with no guidance; a slow/
  stuck loading state; layout broken (overflow, off-screen); spelling/grammar; non-localized text.
- `info` — worth noting but minor: a small copy nit, an extra tap, a slightly odd default.

For EVERY red flag, in `reason` describe it from the USER'S POV: what they see, why it's confusing,
and what they'd likely do (including "give up"). Be concrete. This text becomes the report.

## CRITICAL ISOLATION RULE — do NOT touch real users
This is a TEST account. It must NEVER interact with real (non-test) people or games. On any screen
that suggests OTHER PLAYERS to add/invite/friend (e.g. the "suggested players" / "invite players"
step) or lets you JOIN a game you did not create:
- Do NOT tap "Add" / "Invite" / "Follow" / "Join" on anyone whose name does NOT clearly mark them
  as a test account. In this build the onboarding "suggested players" are all TEST accounts (names
  end in " T.") — adding ONE of those is safe and is the intended way to proceed. But never add /
  invite / join anything that looks like a real user or a real game.
- Instead, WAIT for the screen's own "Continuer"/"Continue" button to appear (on the invite step it
  appears after ~10 seconds by design — be patient, use several `wait` actions), then tap THAT to
  move on WITHOUT adding anyone.
- Do NOT conclude "dead-end" just because a Continue button isn't visible yet — it may be timed. Give
  it multiple `wait` steps (~10s+) before judging. Only if, after genuinely waiting, there is still
  no way forward except adding someone, record it and move on.

## Notes
- Screens may be FR/EN/ES/IT — read the actual labels.
- Never enter a real Stripe card. Never invent a real person's data beyond plausible test values.
- Your job is to EXPERIENCE and REPORT the onboarding, not to force your way to Home.
