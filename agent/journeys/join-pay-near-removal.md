# Journey: join-pay-near-removal (reserved spot near the sweep boundary)

<!--config
persona: sophie_joiner
seedProfile: near-removal
model: sonnet
max_steps: 30
timeout_min: 15
-->

## Setup (driver-provided)
Requires a seeded in-app padel game with the **near-removal** profile (game date just OUTSIDE
remove_reserved_hours, ~5.5h today, about to cross into the `unreserveSpots` sweep window at T-5h).
Driver runs `seed_kinshasa_games.js --profile near-removal --live`, provides `SEED_GAME_ID` and `SEED_GAME_NAME` (the game has a [profile] suffix in its name to distinguish it from other test games — open THAT one).
Persona **sophie_joiner**.

## What this tests (V5 model — the reserved→removal edge)
A reserved-but-unauthorized spot is swept to `open` by `unreserveSpots` once the game enters the
[now, now + remove_reserved_hours] window, and the user gets a `players_auto_removed` push. This
game sits just outside that window, so Sophie can still reserve for free (Path 1) but is close to
the boundary. This journey verifies the **reserved state near the deadline** surfaces the right
countdown / "confirm your spot before you lose it" affordance.

IMPORTANT (today's config): the J-7/J-6 confirmation pushes are **PAUSED**. So a reserved user gets
NO proactive warning before the sweep — they must notice the banner/countdown themselves. This
journey checks whether the game sheet makes the impending removal at all visible.

## Goal
Log in, reserve the near-boundary game (Path 1, free reservation), and verify the game sheet shows a
**reserved state with some indication of the confirmation deadline** (a countdown timer or a
"confirme ta place" prompt), given the game is close to the removal window.

## Expected happy path
1. Login → Home → open the near-removal padel game (starts in ~5–6h).
2. Tap **"Rejoindre ce match" / "Book my spot"** → free reservation (NO PaymentSheet, spot reserved).
3. On the game sheet, look for a **reserved-spot countdown / "confirm your spot" affordance** (the
   `reserved_timer` appears when within 24h of the removal deadline).
4. `done` once you've characterized whether the impending-removal state is communicated.

## Success criteria (mark `done`)
- Sophie is reserved (Path 1, no charge), AND
- You can describe whether the game sheet shows a **removal countdown / confirm-deadline** cue.
  State in your `reason` whether it's clearly communicated or not.

## Red flags — severity `block`
- A Stripe PaymentSheet appears (this game is still outside the window → should be free reservation).
- Crash / error dialog on reserve.
- Non-localized string on the game sheet.

## Red flags — severity `warn`
- **No visible indication** that the spot must be confirmed / will be auto-removed soon — a user
  could silently lose the spot (this is the very gap the paused J-7 pushes create; flag it if the
  UI gives no cue either).
- Reserved-timer countdown missing, wrong, or confusing.
- Loading > 10s, spelling/grammar, or broken layout.

## Notes for the agent
- **Never enter a card** (LIVE keys). If a PaymentSheet appears, flag `block`, back out.
- This is partly EXPLORATORY: the valuable output is whether the app warns the user about impending
  auto-removal. Screens may be FR/EN/ES/IT.
