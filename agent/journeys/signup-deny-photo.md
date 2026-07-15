# Journey: signup-deny-photo (photo-permission denial path)

<!--config
persona: FRESH
model: sonnet
max_steps: 30
timeout_min: 15
-->

## Setup (driver-provided)
Run the driver with `--deny-photo` so photo-library permission is left UNgranted:
`./run.sh signup-deny-photo --deny-photo`. FRESH persona (throwaway signup account), torn down after.

## Persona
A brand-new user signing up who, at the photo step, does NOT grant photo-library access — either by
declining the iOS permission dialog or because access is off. This journey exercises the
denied-permission branch of the onboarding photo step.

## Goal
Get through signup to the **photo step (b_photo)**, DENY photo access, and characterize what the app
does: does it give the user a clear way forward (a message / "Open Settings" affordance), or is it a
**silent dead-end** with no feedback?

## Expected happy path (this journey's version)
1. Welcome → "Continue with email" → enter `SIGNUP_EMAIL` + `SIGNUP_PASSWORD` → submit.
2. On the 4-digit "Verify your email" screen, the code auto-fills (test build) → advances.
3. Name/nickname step: enter a display name ≥ 4 chars, pick a pronoun, confirm.
4. **Photo step (b_photo):** tap "Choose my photo". When the iOS photo-permission dialog appears,
   tap **"Don't Allow"** (deny). If no dialog appears (permission already off), just observe the
   result of tapping "Choose my photo".
5. Observe the resulting state and characterize it (see success criteria).

## Success criteria (mark `done` with goal_reached: true)
Describe, in your `reason`, which of these the app does after the photo permission is denied:
- **GOOD:** shows a clear message / dialog / snackbar telling the user to allow access in Settings,
  and/or a prominent "Open Settings" button — a visible way forward.
- **BAD (known bug):** nothing visible happens — tapping "Choose my photo" gives no feedback and
  there's no obvious way to proceed (silent dead-end).

Mark `done` once you've determined which. (This is a characterization journey — either outcome is a
valid `done`; the point is to REPORT the behavior accurately.)

## Red flags — severity `block`
- App crash / fatal error on the permission denial.

## Red flags — severity `warn`
- **The denied-permission path is a silent dead-end** — no message, no visible recovery affordance
  after declining (this is the suspected bug: report it as `warn` with the screenshot).
- The "Open Settings" affordance (if any) is present but hard to find / unlabeled / easy to miss.
- Non-localized string, spelling/grammar, or broken layout on the photo screen.

## Notes for the agent
- Do NOT keep hammering "Choose my photo" more than 2-3 times. If nothing changes after denying,
  that IS the finding — report it and finish. Look carefully for ANY new element (a message, a
  Settings button) that appears after the denial before concluding it's a dead-end.
- The goal here is to CHARACTERIZE the denial behavior, not to complete onboarding.
