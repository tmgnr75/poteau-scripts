#!/usr/bin/env node
/**
 * Poteau agent UI-testing — single-sim driver.
 *
 * Boots an iOS simulator, installs + launches poteau-app, then runs a
 * perceive → decide → act loop: screenshot + accessibility tree → Claude picks
 * the next action → idb executes it. Logs every step (screenshot + decision)
 * to runs/<timestamp>/ and writes a report.md at the end.
 *
 * Usage:
 *   node run.js <journey-name> [--udid <UDID>] [--keep-app] [--no-build]
 *   node run.js join-a-padel-game
 *
 * Requires: ANTHROPIC_API_KEY in env. idb installed at ~/.idb (see
 * reference_idb_sim_driver memory). Test accounts + seed game provisioned.
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync, spawnSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');
const cfg = require('./lib/kinshasa_test_config.js');
const otp = require('./lib/otp.js');

// Load ANTHROPIC_API_KEY from scripts/agent/.env if not already in the env.
// Format: a line `ANTHROPIC_API_KEY=sk-ant-...`. The file is gitignored.
(function loadDotEnv() {
  if (process.env.ANTHROPIC_API_KEY) return;
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

// ---------------------------------------------------------------------------
// Paths & constants
// ---------------------------------------------------------------------------
const HOME = process.env.HOME;
const IDB = `${HOME}/.idb/venv/bin/idb`;
const IDB_COMPANION_BIN = `${HOME}/.idb/bin/idb_companion`;
const APP_BUNDLE_ID = 'com.krank.club';
const APP_PATH = path.resolve(__dirname, '../../poteau-app/build/ios/iphonesimulator/Runner.app');
const DEFAULT_UDID = 'EB99DAC3-2756-4233-A12D-E4C99D496912'; // iPhone 16 Pro
const AGENT_DIR = __dirname;
const RUNS_DIR = path.join(AGENT_DIR, 'runs');

const MODEL_IDS = { sonnet: 'claude-sonnet-5', opus: 'claude-opus-4-8' };

// ---------------------------------------------------------------------------
// Small utils
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
function sh(cmd, opts = {}) { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }); }

// idb invocation: companion addressed via IDB_COMPANION env (see memory note).
// All idb calls carry a timeout so a wedged companion can't hang the loop.
let COMPANION_PORT = null;
function idb(args, opts = {}) {
  const env = { ...process.env };
  if (COMPANION_PORT) env.IDB_COMPANION = `localhost:${COMPANION_PORT}`;
  return execFileSync(IDB, args, { encoding: 'utf8', env, timeout: 25000, killSignal: 'SIGKILL', ...opts });
}
function idbSafe(args, opts = {}) {
  try { return { ok: true, out: idb(args, opts) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || e.message) }; }
}

// ---------------------------------------------------------------------------
// Sim / companion lifecycle
// ---------------------------------------------------------------------------
function bootSim(udid) {
  const booted = sh(`xcrun simctl list devices booted`);
  if (!booted.includes(udid)) {
    log(`Booting sim ${udid}...`);
    try { sh(`xcrun simctl boot ${udid}`); } catch (e) { /* may already be booting */ }
    sh(`xcrun simctl bootstatus ${udid} -b`);
  } else {
    log(`Sim ${udid} already booted.`);
  }
  // Sims auto-shutdown after inactivity; a run started against a slept sim hangs
  // with 0 steps. Verify the device is actually Booted and recover once if not.
  for (let i = 0; i < 2; i++) {
    const line = sh(`xcrun simctl list devices | grep ${udid} || true`);
    if (/\(Booted\)/.test(line)) return;
    log(`Sim not Booted (state check ${i + 1}) — (re)booting...`);
    try { sh(`xcrun simctl boot ${udid}`); } catch {}
    try { sh(`xcrun simctl bootstatus ${udid} -b`); } catch {}
  }
}

let companionProc = null;
const FIXED_COMPANION_PORT = '10882'; // pin the port so restarts are deterministic

// Kill ALL companions and wait until none remain (up to ~5s). Deterministic —
// no lsof/port-detection races. Returns when the port is free.
function killAllCompanions() {
  try { sh(`pkill -9 -f idb_companion`); } catch {}
  for (let i = 0; i < 25; i++) {
    let alive = '';
    try { alive = sh(`pgrep -f idb_companion || true`).trim(); } catch {}
    if (!alive) return;
    try { sh(`sleep 0.2`); } catch {}
  }
}

// Probe: does describe-all return a non-empty JSON array? Confirms the a11y
// bridge is actually alive (not just the port open).
function companionResponsive() {
  const r = idbSafe(['ui', 'describe-all']);
  if (!r.ok) return false;
  try { const d = JSON.parse(r.out); return Array.isArray(d) && d.length > 0; }
  catch { return false; }
}

// Start a companion on the FIXED port. Kills any existing one first so the port
// is free. CRITICAL: the companion logs verbosely; if its stdout/stderr go to a
// pipe that node doesn't drain, the pipe buffer fills and the companion BLOCKS
// (stops serving requests → a11y "wedge"). So we DETACH it and redirect output
// to a log FILE (never a node-held pipe), and poll the log file for readiness.
let companionLogPath = null;
function startCompanion(udid) {
  killAllCompanions();
  const { spawn } = require('child_process');
  companionLogPath = path.join(RUNS_DIR, `companion-${FIXED_COMPANION_PORT}.log`);
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const out = fs.openSync(companionLogPath, 'w');
  log(`Starting idb companion on port ${FIXED_COMPANION_PORT}...`);
  companionProc = spawn(IDB_COMPANION_BIN, ['--udid', udid, '--grpc-port', FIXED_COMPANION_PORT],
    { stdio: ['ignore', out, out], detached: true });
  companionProc.unref(); // let it run independently of node's event loop
  COMPANION_PORT = FIXED_COMPANION_PORT;
  return new Promise((resolve) => {
    const start = Date.now();
    const poll = () => {
      let logtxt = '';
      try { logtxt = fs.readFileSync(companionLogPath, 'utf8'); } catch {}
      if (/tcp port|grpc_port|Swift server started/i.test(logtxt)) { log(`Companion up on ${COMPANION_PORT}`); return resolve(); }
      if (Date.now() - start > 12000) { log('Companion start timed out (probing anyway)'); return resolve(); }
      setTimeout(poll, 400);
    };
    poll();
  });
}

// Restart on a wedged a11y bridge, then verify it's responsive (probe a few
// times). Returns true if the bridge is back.
async function restartCompanion(udid) {
  log('Restarting companion to recover a11y bridge...');
  killAllCompanions();
  companionProc = null;
  COMPANION_PORT = null;
  try { await startCompanion(udid); } catch (e) { log(`restart start failed: ${e.message}`); }
  // The companion needs several seconds to bring up its a11y bridge after the
  // port opens. Warm up, then probe up to 6× (≈18s) before giving up.
  await sleep(5000);
  for (let i = 0; i < 6; i++) {
    if (companionResponsive()) { log('a11y bridge recovered.'); return true; }
    await sleep(3000);
  }
  log('a11y bridge still unresponsive after restart.');
  return false;
}
function stopCompanion() { killAllCompanions(); }

function installApp(udid) {
  if (!fs.existsSync(APP_PATH)) {
    throw new Error(`App not built at ${APP_PATH}. Run: (cd poteau-app && flutter build ios --simulator --debug)`);
  }
  log('Installing app...');
  sh(`xcrun simctl install ${udid} "${APP_PATH}"`);
}
function launchApp(udid) {
  log('Launching app...');
  // A launch right after install can transiently fail ("No such process") while
  // the sim registers the app. Retry a few times with a short backoff.
  for (let i = 0; i < 5; i++) {
    try { sh(`xcrun simctl launch ${udid} ${APP_BUNDLE_ID}`); return; }
    catch (e) {
      if (i === 4) throw e;
      log(`launch attempt ${i + 1} failed, retrying...`);
      try { sh(`sleep 2`); } catch {}
      // make sure the sim is up before retrying
      try { sh(`xcrun simctl bootstatus ${udid} -b`); } catch {}
    }
  }
}
function terminateApp(udid) { try { sh(`xcrun simctl terminate ${udid} ${APP_BUNDLE_ID}`); } catch {} }

// ---------------------------------------------------------------------------
// Perceive: screenshot + a11y tree
// ---------------------------------------------------------------------------
function screenshot(outPath) {
  const r = idbSafe(['screenshot', outPath]);
  return r.ok && fs.existsSync(outPath);
}

// Cheap perceptual signature of a screenshot for change-detection. We can't
// pull in an image lib, so we sample the PNG bytes at regular offsets and sum
// them. A tap that changes the screen shifts many pixels → the compressed PNG
// bytes shift substantially; a no-op tap leaves a near-identical PNG. The clock
// digit ticking over changes only a handful of bytes, well under the threshold.
function shotSignature(buf) {
  if (!buf || !buf.length) return { len: 0, sum: 0 };
  let sum = 0;
  const stride = Math.max(1, Math.floor(buf.length / 4096));
  for (let i = 0; i < buf.length; i += stride) sum = (sum + buf[i]) >>> 0;
  return { len: buf.length, sum };
}
// True if two signatures are "the same screen" (byte length within 0.5% AND
// sampled-sum within 0.5%). Tuned so a real navigation always trips it while a
// missed tap / clock tick does not.
function sigSame(a, b) {
  if (!a || !b) return false;
  const lenDelta = Math.abs(a.len - b.len) / Math.max(1, a.len);
  const sumDelta = Math.abs(a.sum - b.sum) / Math.max(1, a.sum);
  return lenDelta < 0.005 && sumDelta < 0.005;
}
// Take a throwaway screenshot to a temp path and return its signature.
const _probeShot = path.join(require('os').tmpdir(), `poteau-probe-${process.pid}.png`);
function currentSignature() {
  if (!screenshot(_probeShot)) return null;
  try { return shotSignature(fs.readFileSync(_probeShot)); } catch { return null; }
}
function a11yElements() {
  const r = idbSafe(['ui', 'describe-all']);
  if (!r.ok) return [];
  let data;
  try { data = JSON.parse(r.out); } catch { return []; }
  const els = Array.isArray(data) ? data : [data];
  // Keep every positioned element with center coords in POINTS. Flutter often
  // renders nav/icon buttons as UNLABELED Images (e.g. the bottom sport tabs),
  // so we must NOT drop unlabeled elements — we surface them as "(unlabeled X)"
  // with their coords so the agent can still target them.
  return els
    .map((e) => {
      const f = e.frame || {};
      if (!f.width || !f.height) return null;
      const label = e.AXLabel || e.AXValue || e.title || '';
      const type = e.type || e.role || '?';
      // Skip the giant container/scroll wrappers (full-screen, no label).
      const isWrapper = ['Application', 'ScrollArea'].includes(type) || (f.width > 380 && f.height > 800 && !label);
      if (isWrapper) return null;
      return {
        type,
        label: String(label).replace(/\n/g, ' ').slice(0, 80),
        x: Math.round(f.x + f.width / 2),
        y: Math.round(f.y + f.height / 2),
        enabled: e.enabled !== false,
      };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Act: execute a decision
// ---------------------------------------------------------------------------
async function act(decision) {
  const { action, coordinates, text } = decision;
  switch (action) {
    case 'tap': {
      if (!coordinates) throw new Error('tap without coordinates');
      const [x, y] = coordinates;
      // Tap-verify-retry: idb taps intermittently drop, and the a11y frame
      // centre is sometimes a few points off the real hit target. Rather than
      // let a single missed tap look like an app dead-end, tap, check whether
      // the screen changed, and if not retry — first the same point, then small
      // nudges around it. Returns {changed} so the loop can tell the agent a tap
      // genuinely did nothing (a real no-op) vs. it just kept missing.
      const before = currentSignature();
      // Nudge pattern: same point twice, a small ring, then two larger VERTICAL
      // offsets. idb's a11y frame centres drift most on the Y axis (labels report
      // a few dozen points above the real button), so ±28pt vertical rescues a
      // moderately-off tap without straying onto a neighbouring control.
      const nudges = [[0, 0], [0, 0], [0, -8], [0, 8], [-8, 0], [8, 0], [0, -28], [0, 28]];
      let changed = false;
      for (let i = 0; i < nudges.length; i++) {
        const [dx, dy] = nudges[i];
        idbSafe(['ui', 'tap', String(x + dx), String(y + dy)]);
        await sleep(1200);
        const after = currentSignature();
        if (!before || !after || !sigSame(before, after)) { changed = true; break; }
        // else: screen unchanged — retry with the next nudge
      }
      if (!changed) log(`  tap @[${x},${y}] produced NO screen change after ${nudges.length} attempts`);
      await sleep(300);
      return { changed };
    }
    case 'type': {
      if (text == null) throw new Error('type without text');
      const s = String(text);
      // Flutter PinCodeTextField (the 4-digit email-verification screen) does
      // NOT accept `idb ui text` — the digits never register. Pure-digit input
      // must be sent as HID key events instead. USB HID keycodes: 1=30…9=38, 0=39.
      if (/^\d+$/.test(s)) {
        const codes = s.split('').map((d) => (d === '0' ? 39 : 29 + Number(d)));
        idbSafe(['ui', 'key-sequence', ...codes.map(String)]);
      } else {
        // `idb ui text` APPENDS to the focused field. If the agent re-types
        // (common when a slow render makes it think the first attempt failed),
        // text duplicates and validation breaks. So CLEAR first: send backspace
        // (HID 42) enough times to empty any existing content, then type.
        const bk = Array(48).fill('42');
        idbSafe(['ui', 'key-sequence', ...bk]);
        idbSafe(['ui', 'text', s]);
      }
      await sleep(1200);
      return;
    }
    case 'swipe': {
      // coordinates = [x1,y1,x2,y2]; default a downward scroll if not given
      const c = coordinates && coordinates.length === 4 ? coordinates : [200, 600, 200, 300];
      idbSafe(['ui', 'swipe', ...c.map(String)]);
      await sleep(1200);
      return;
    }
    case 'wait':
      await sleep(5000); // 5s per wait — a few waits cover timer-gated reveals (~10s invite button)
      return;
    case 'done':
    case 'red_flag':
      return; // handled by the loop
    default:
      throw new Error(`unknown action ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Decide: ask Claude for the next action (structured tool use)
// ---------------------------------------------------------------------------
const DECISION_TOOL = {
  name: 'decide_next_action',
  description: 'Decide the single next UI action to progress the journey, or finish/flag.',
  input_schema: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Brief why for this action, referencing what is on screen.' },
      action: { type: 'string', enum: ['tap', 'type', 'swipe', 'wait', 'done', 'red_flag'] },
      coordinates: {
        type: 'array', items: { type: 'number' },
        description: 'For tap: [x,y] in points. For swipe: [x1,y1,x2,y2]. Null otherwise.',
      },
      text: { type: 'string', description: 'For type: the exact text to enter. Null otherwise.' },
      red_flag_severity: { type: 'string', enum: ['info', 'warn', 'block'], description: 'Set only when action=red_flag.' },
      screen: { type: 'string', description: 'Short name of the current screen (e.g. "Welcome", "Email code", "Photo", "Phone", "Timeslots"). Set on red_flag so findings can be grouped by screen.' },
      goal_reached: { type: 'boolean', description: 'Set true only when action=done and success criteria are met.' },
    },
    required: ['reason', 'action'],
  },
};

function systemPrompt(journeyText, runCtx) {
  return `You are an autonomous QA agent driving the Poteau iOS app in a simulator to test one user journey.

You are given, each step: a screenshot of the current screen, a list of accessibility elements
(label + type + tap coordinates in POINTS), and the action history so far.

CRITICAL — COORDINATE SYSTEM: All taps use POINTS, not screenshot pixels. The screen is about
402 points WIDE and 874 points TALL. The screenshot image is higher-resolution (3x: ~1206x2622
pixels): point_x = pixel_x / 3, point_y = pixel_y / 3. The accessibility list gives point
coordinates directly — prefer them as a first guess, BUT they are not always accurate on this app:
a frame's reported centre can be several points off the real tap target (especially for segmented
bars, switches, and cards). When the a11y coordinate and the screenshot disagree about where an
element is, TRUST THE SCREENSHOT — estimate the visible element's centre in pixels and divide by 3.

TAP RELIABILITY (important): the driver AUTO-RETRIES every tap — if your tap changes nothing it is
re-sent up to 6× with small position nudges before you even see the result. So:
- You do NOT need to re-tap a target yourself just because "nothing seemed to happen" once.
- If a LIVE HINT tells you your previous tap "changed NOTHING after auto-retry", that spot is a
  confirmed dead target — do NOT tap the same coordinate again. Pick a DIFFERENT element, or
  re-estimate the element's position FROM THE SCREENSHOT (pixels÷3).
- Only escalate to a "dead-end" red flag after you've tried at least TWO genuinely DIFFERENT
  coordinates/elements for the thing you're trying to hit — never after repeating one coordinate.

Decide the SINGLE next action via the decide_next_action tool. Many icon/nav buttons are UNLABELED
images (shown as "(unlabeled Image)") — the bottom navigation bar is a row of these near y≈780; use
their listed coordinates.

APP NAVIGATION NOTES (Poteau):
- The screen title like "Soccer near Kinshasa" / "Padel near Kinshasa" has a small pencil ✏️ next
  to it — that pencil edits the LOCATION, NOT the sport. Do NOT tap the pencil to switch sports.
- To switch between Soccer and Padel discovery, tap the SPORT ICONS in the BOTTOM nav bar (the row
  of unlabeled images near y≈780): a soccer-ball icon and a tennis/padel-ball icon. Tap the
  padel/tennis-ball one to see padel games.
- The bottom nav (left→right) is roughly: Home (house), Soccer, Padel, Profile. Use the a11y
  element coordinates (~y 780), not pixel guesses.
- If the screen is completely BLANK (only a background color, no elements) for 2+ steps, you likely
  hit a dead-end/unrendered screen — do NOT keep waiting. Report it as a warn red flag and the
  driver will relaunch the app to recover.

Run context (values you may need):
${Object.entries(runCtx).map(([k, v]) => `- ${k} = ${v}`).join('\n')}

Rules:
- Beeline for the goal. One concrete action per step.
- action="done" ONLY when the journey's success criteria are met; set goal_reached=true.
- action="red_flag" when you see something matching the journey's red-flag rubric; set
  red_flag_severity. Use "block" for crashes/errors/wrong-currency/non-localized-core-strings
  (these stop the run). Use "warn"/"info" for lesser issues but KEEP GOING afterwards (return a
  normal action on the next step).
- If a 4-digit PIN entry screen appears, type LOGIN_CODE.
- Never invent Stripe card numbers unless TEST_CARD is provided in the run context.
- TEXT ENTRY: a "type" action AUTOMATICALLY clears the field first, so type the full value ONCE and
  do NOT re-type into the same field. PASSWORD fields render as dots/blank — after you type a
  password, TRUST that it registered; do NOT re-type it just because you cannot see the characters.
  If a Confirm button still looks disabled right after typing, tap it anyway (or wait one step) —
  the enabled state can lag the input by a moment. Only re-enter a field if you have clear evidence
  it holds the WRONG value (e.g. visibly wrong email text), and even then type the correct value
  once (it will replace, not append).

=== JOURNEY DEFINITION ===
${journeyText}`;
}

async function decide(client, model, sys, imgB64, elements, history, liveHint) {
  const elemText = elements.length
    ? elements.map((e, i) => `${i}. [${e.type}] ${e.label ? `"${e.label}"` : '(unlabeled ' + e.type + ')'} @(${e.x},${e.y})${e.enabled ? '' : ' (disabled)'}`).join('\n')
    : '(accessibility tree empty — reason from the screenshot, converting pixels→points by /3)';
  const histText = history.length
    ? history.slice(-8).map((h, i) => `${history.length - Math.min(8, history.length) + i + 1}. ${h.action}${h.text ? ` "${h.text}"` : ''}${h.coordinates ? ` @${JSON.stringify(h.coordinates)}` : ''} — ${h.reason}`).join('\n')
    : '(none yet)';
  const hintText = liveHint ? `\n\nLIVE HINT (current, use if relevant): ${liveHint}` : '';

  const resp = await client.messages.create({
    model,
    max_tokens: 1024,
    tools: [DECISION_TOOL],
    tool_choice: { type: 'tool', name: 'decide_next_action' },
    system: sys,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgB64 } },
        { type: 'text', text: `Accessibility elements:\n${elemText}\n\nAction history (recent):\n${histText}${hintText}\n\nDecide the next action.` },
      ],
    }],
  });
  const toolUse = resp.content.find((c) => c.type === 'tool_use');
  const usage = resp.usage || {};
  if (!toolUse) throw new Error('model returned no tool_use');
  return { decision: toolUse.input, usage };
}

// ---------------------------------------------------------------------------
// Journey parsing
// ---------------------------------------------------------------------------
function loadJourney(name) {
  const p = path.join(AGENT_DIR, 'journeys', `${name}.md`);
  if (!fs.existsSync(p)) throw new Error(`Journey not found: ${p}`);
  const text = fs.readFileSync(p, 'utf8');
  const cfgBlock = (text.match(/<!--config([\s\S]*?)-->/) || [])[1] || '';
  const conf = {};
  cfgBlock.split('\n').forEach((line) => {
    const m = line.match(/^\s*(\w+):\s*(.+?)\s*$/);
    if (m) conf[m[1]] = m[2];
  });
  return { text, conf };
}

// ---------------------------------------------------------------------------
// FRESH persona (signup journeys) + profile seeding (payment journeys).
// These shell out to the sibling scripts so all Firestore/Auth logic stays in
// one place (create_test_accounts.js / seed_kinshasa_games.js / otp.js).
// ---------------------------------------------------------------------------
const SCRIPTS_DIR = path.resolve(__dirname, '..');

// Create a throwaway signup account (Auth user, emailVerified so the app treats
// the code as already-known, but the SIGNUP flow will still write a fresh
// email_code we read). Returns { email, uid, password, phone }.
async function createFreshAccount(ts) {
  const admin = require('firebase-admin');
  const serviceAccount = require(path.join(SCRIPTS_DIR, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
  const email = `test_signup_${ts.replace(/[^0-9]/g, '').slice(0, 14)}@${cfg.TEST_EMAIL_DOMAIN}`;
  const password = cfg.TEST_PASSWORD;
  // Do NOT pre-create the Firestore doc — the signup flow builds it. We only
  // pre-create the Auth user so the app's createAccountWithEmail either signs in
  // or the flow proceeds; but signup journeys exercise the real create path, so
  // we leave Auth creation to the app and just reserve the email string here.
  // A NORMAL local phone number a real user would type. We deliberately do NOT
  // engineer it to satisfy the app's hidden >=11-digit validation — if a normal
  // number is silently rejected, that's a finding the friction report must catch.
  return { email, password, phone: '612345678' };
}

// Flag an account as a test account so the CF isolation filters treat it as one.
async function markAccountAsTest(uid) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) return;
  await admin.firestore().collection('users').doc(uid).set({ is_test_account: true }, { merge: true });
}

// Set an account's app language (fr/en/es/it) so the app renders in it.
async function setAccountLanguage(uid, lang) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) return;
  await admin.firestore().collection('users').doc(uid).set({ language: lang }, { merge: true });
}

// Delete a fresh signup account after the run (Auth + Firestore doc if created).
async function deleteFreshAccount(email) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) return;
  const u = await admin.auth().getUserByEmail(email).catch(() => null);
  if (!u) return;
  if (!cfg.isTestEmail(u.email)) return; // safety
  await admin.firestore().collection('users').doc(u.uid).delete().catch(() => {});
  await admin.auth().deleteUser(u.uid).catch(() => {});
  log(`Cleaned up fresh account ${email}`);
}

// Before a payment run: remove the joiner persona from every test game and
// delete any OTHER-profile test games, so only the target profile's game exists
// and the persona starts un-joined. Prevents cross-run confounding (identical
// game names + stale membership).
async function resetTestGamesFor(profile, personaKey) {
  const admin = require('firebase-admin');
  const serviceAccount = require(path.join(SCRIPTS_DIR, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
  const db2 = admin.firestore();
  const personaUid = await otp.uidForEmail(cfg.emailFor(personaKey)).catch(() => null);
  const snap = await db2.collection('games').where('is_test_game', '==', true).get();
  for (const g of snap.docs) {
    const d = g.data();
    const p = d.test_profile || 'default';
    if (p !== profile) {
      // Delete other-profile test games so they don't pollute discovery.
      await g.ref.delete().catch(() => {});
      log(`Cleared stale test game games/${g.id} (profile ${p})`);
      continue;
    }
    // Same profile: strip the persona out so they start un-joined.
    if (personaUid) {
      const teams = (d.teams || []).map((t) => (t.user_id === personaUid ? { team_side: t.team_side, status: 'open' } : t));
      const attendees = (d.attendees || []).filter((r) => (r.id || r.path?.split('/').pop()) !== personaUid);
      await g.ref.update({ teams, attendees }).catch(() => {});
    }
  }
}

// Seed a game for the given timeline profile, return its id. Idempotent per
// profile (seed script skips if one exists), so we query it back either way.
function seedProfileGame(profile) {
  log(`Seeding game for profile "${profile}"...`);
  try {
    sh(`node "${path.join(SCRIPTS_DIR, 'seed_kinshasa_games.js')}" --profile ${profile} --live`);
  } catch (e) {
    // A skip (already exists) exits 0; a real error would throw. Log stderr.
    log(`seed note: ${(e.stdout || '') + (e.stderr || e.message)}`.slice(0, 300));
  }
  // Query the game id back (organizer + profile).
  const admin = require('firebase-admin');
  const serviceAccount = require(path.join(SCRIPTS_DIR, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
  return admin.auth().getUserByEmail(cfg.emailFor('marc_organizer'))
    .then((org) => admin.firestore().collection('games')
      .where('organizer', '==', org.uid)
      .where('is_test_game', '==', true)
      .where('status', '==', 'published')
      .get())
    .then((snap) => {
      const match = snap.docs.find((d) => (d.data().test_profile || 'default') === profile);
      return match ? match.id : null;
    });
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------
function writeReport(runDir, meta, steps, redFlags, outcome, tokens) {
  const rel = (p) => path.basename(p);
  const SEV = { block: '🔴 BLOCK', warn: '🟠 WARN', info: '🔵 INFO' };
  const order = { block: 0, warn: 1, info: 2 };
  const sorted = redFlags.slice().sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || a.step - b.step);
  const counts = { block: 0, warn: 0, info: 0 };
  redFlags.forEach((r) => { counts[r.severity] = (counts[r.severity] || 0) + 1; });

  let md = `# Onboarding Friction Report — Poteau\n\n`;
  md += `*A first-time-user walkthrough of the sign-up / onboarding flow, run by an agent behaving like a real confused user. Each finding is what a REAL user would experience. "Blockers" are points a real user would likely be stuck or abandon.*\n\n`;
  md += `**Run:** ${meta.timestamp} · **Persona:** first-time user (${meta.persona}) · **Model:** ${meta.model}\n\n`;
  md += `**How far a real user gets:** ${outcome.reason}\n\n`;
  md += `**Findings:** 🔴 ${counts.block || 0} blockers · 🟠 ${counts.warn || 0} friction · 🔵 ${counts.info || 0} minor  (${steps.length} steps observed)\n\n`;
  md += `> Note on test limitations: the OTP email code is read from the backend (a simulator has no email inbox — a real user reads it from their email). The native iOS photo picker is Apple's own UI and can't be fully automated; where a finding is a test-tool limit rather than app friction, it says so.\n\n`;
  md += `---\n\n`;

  // FINDINGS, grouped by severity, each with screen + user-POV description + screenshot.
  md += `## Findings\n\n`;
  if (!sorted.length) {
    md += `_No friction recorded — the agent moved through onboarding without flagging issues._\n\n`;
  }
  for (const rf of sorted) {
    md += `### ${SEV[rf.severity] || rf.severity} · ${rf.screen}  <sub>(step ${rf.step})</sub>\n\n`;
    md += `${rf.reason}\n\n`;
    if (rf.screenshot) md += `![${rf.screen} step ${rf.step}](${rel(rf.screenshot)})\n\n`;
  }

  // APPENDIX: the full step trace so you can see exactly what the user did.
  md += `---\n\n## Appendix — full walkthrough trace\n\n`;
  for (const s of steps) {
    const flag = s.action === 'red_flag' ? ` ${SEV[s.red_flag_severity] || '🚩'}` : '';
    md += `**${s.step}.${flag} ${s.action}**${s.text ? ` \`${s.text}\`` : ''}${s.coordinates ? ` @${JSON.stringify(s.coordinates)}` : ''} — ${s.reason}\n\n`;
    if (s.screenshot) md += `![step ${s.step}](${rel(s.screenshot)})\n\n`;
  }
  md += `\n_Tokens: ${tokens.input} in / ${tokens.output} out._\n`;
  fs.writeFileSync(path.join(runDir, 'report.md'), md);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const args = process.argv.slice(2);
  const journeyName = args[0];
  if (!journeyName) { console.error('Usage: node run.js <journey-name> [--udid UDID] [--no-build] [--keep-app]'); process.exit(2); }
  const udid = (args.includes('--udid') ? args[args.indexOf('--udid') + 1] : null) || DEFAULT_UDID;
  const noBuild = args.includes('--no-build');
  const keepApp = args.includes('--keep-app');
  // --lang es|it|en|fr : render the app in that language. Sets the sim locale
  // AND the persona/fresh account's `language` field. Default: fr (Kinshasa
  // accounts are fr). Used for ES/IT localization coverage.
  const langArg = (args.includes('--lang') ? args[args.indexOf('--lang') + 1] : '') ||
    ((args.find((a) => a.startsWith('--lang=')) || '').split('=')[1] || '');
  const LANG = ['en', 'fr', 'es', 'it'].includes(langArg) ? langArg : null;
  const LOCALE = { en: 'en_US', fr: 'fr_FR', es: 'es_ES', it: 'it_IT' };

  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set.'); process.exit(2); }

  const { text: journeyText, conf } = loadJourney(journeyName);
  const persona = conf.persona || 'sophie_joiner';
  const model = MODEL_IDS[conf.model] || MODEL_IDS.sonnet;
  const maxSteps = parseInt(conf.max_steps || '40', 10);
  const timeoutMs = (parseInt(conf.timeout_min || '20', 10)) * 60 * 1000;

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(RUNS_DIR, ts);
  fs.mkdirSync(runDir, { recursive: true });
  log(`Run dir: ${runDir}`);

  // --- Resolve persona / run context ---
  const isFresh = persona === 'FRESH';
  const runCtx = { KINSHASA: `${cfg.KINSHASA.lat},${cfg.KINSHASA.lng}` };
  let freshEmail = null; // set for FRESH personas so we can tear down after

  if (isFresh) {
    // Signup journeys: no pre-provisioned account. Generate a throwaway email;
    // the app's signup flow creates the account. The 4-digit email_code will be
    // read live once the account doc exists (poll during the run).
    const fresh = await createFreshAccount(ts);
    freshEmail = fresh.email;
    runCtx.SIGNUP_EMAIL = fresh.email;
    runCtx.SIGNUP_PASSWORD = fresh.password;
    runCtx.SIGNUP_PHONE = fresh.phone;
    runCtx.LOGIN_CODE = '(will be read from Firestore after signup — the driver injects it)';
    log(`FRESH signup persona: ${fresh.email}`);
  } else {
    // Pre-provisioned persona: email+password login → Home.
    const personaEmail = cfg.emailFor(persona);
    const personaUid = await otp.uidForEmail(personaEmail);
    if (!personaUid) throw new Error(`Persona ${personaEmail} has no account.`);
    const loginCode = await otp.setKnownCode(personaUid, otp.DEFAULT_CODE);
    log(`Persona ${personaEmail} (${personaUid}) — password login, code fallback ${loginCode}`);
    // --lang: set the account's language so the app renders in it after login.
    if (LANG) { try { await setAccountLanguage(personaUid, LANG); log(`Set persona language → ${LANG}`); } catch {} }
    runCtx.PERSONA_EMAIL = personaEmail;
    runCtx.LOGIN_PASSWORD = cfg.TEST_PASSWORD;
    runCtx.LOGIN_CODE = loginCode;
  }

  // --- Seed the timeline game for payment journeys ---
  if (conf.seedProfile) {
    // Clear other-profile test games + un-join the persona so only this
    // profile's game exists and the persona starts fresh (no stale membership).
    await resetTestGamesFor(conf.seedProfile, persona).catch((e) => log(`reset note: ${e.message}`));
    const gid = await seedProfileGame(conf.seedProfile);
    runCtx.SEED_GAME_ID = gid || '(seed failed — check logs)';
    runCtx.SEED_GAME_NAME = `Kinshasa Padel Test [${conf.seedProfile}]`;
    log(`Seeded ${conf.seedProfile} game: ${runCtx.SEED_GAME_ID}`);
  } else if (!isFresh) {
    // Look up the current default standing test game (id is not hardcoded — it
    // changes when re-seeded). Seed one if none exists.
    const gid = await seedProfileGame('default').catch(() => null);
    runCtx.SEED_GAME_ID = gid || '(no default game — check seed)';
  }

  const client = new Anthropic();
  const sys = systemPrompt(journeyText, runCtx);

  // --- boot / install / launch ---
  // Order: boot → terminate old app → reinstall (clean state, fixes stale
  // calendar cache) → THEN start a FRESH companion → set location → launch.
  // Installing before the companion avoids wedging the companion's UI bridge.
  bootSim(udid);
  terminateApp(udid);
  // --lang: set the sim's locale + language so the app renders in ES/IT/etc.
  // Writes the global preferences plist and restarts SpringBoard so the change
  // takes effect. Done before install/launch. Kept best-effort (never fatal).
  if (LANG) {
    try {
      const loc = LOCALE[LANG];
      const plist = `${process.env.HOME}/Library/Developer/CoreSimulator/Devices/${udid}/data/Library/Preferences/.GlobalPreferences.plist`;
      sh(`/usr/libexec/PlistBuddy -c "Set :AppleLocale ${loc}" "${plist}" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :AppleLocale string ${loc}" "${plist}"`);
      sh(`/usr/libexec/PlistBuddy -c "Delete :AppleLanguages" "${plist}" 2>/dev/null; /usr/libexec/PlistBuddy -c "Add :AppleLanguages array" "${plist}"; /usr/libexec/PlistBuddy -c "Add :AppleLanguages:0 string ${LANG}" "${plist}"`);
      sh(`xcrun simctl spawn ${udid} launchctl stop com.apple.SpringBoard 2>/dev/null || true`);
      await sleep(3000);
      log(`Set sim language → ${LANG} (${loc}).`);
    } catch (e) { log(`lang set note: ${e.message}`); }
  }
  // Clear the keychain so the app starts LOGGED OUT. Firebase persists the auth
  // session in the iOS keychain, which survives app reinstall — without this,
  // the app reopens as whoever logged in last (breaks signup journeys and makes
  // login journeys silently reuse a stale session). Do it while the app is
  // terminated, before install. Skip with --keep-session (e.g. to speed a
  // login-journey rerun when you know the right account is already logged in).
  if (!args.includes('--keep-session')) {
    try { sh(`xcrun simctl keychain ${udid} reset`); log('Cleared keychain (logged-out start).'); }
    catch (e) { log(`keychain reset note: ${e.message}`); }
  }
  if (!args.includes('--fast-launch')) { installApp(udid); await sleep(2500); /* let the install register before launch */ }
  // Signup journeys hit a "Choose my photo" step that opens the native picker.
  // Seed the library with an image AND (unless --deny-photo) pre-grant photo
  // permission so the picker works and the funnel completes. The --deny-photo
  // flag leaves permission ungranted so the journey can exercise the
  // denied-permission path (see bug_onboarding_photo_silent_denial).
  if (isFresh) {
    // Seed a photo so the library isn't empty (a real phone has photos) — the
    // picker experience is then realistic. Photo/location PERMISSION is left at
    // its natural state so the real iOS permission DIALOG appears and the agent
    // responds like a user. Flags: --grant-photo pre-grants (skip the dialog);
    // --deny-photo pre-revokes (test the denied path deterministically).
    const avatar = path.join(APP_PATH, 'AppIcon60x60@2x.png');
    if (fs.existsSync(avatar)) { try { sh(`xcrun simctl addmedia ${udid} "${avatar}"`); log('Seeded sim photo library.'); } catch {} }
    if (args.includes('--deny-photo')) {
      try { sh(`xcrun simctl privacy ${udid} revoke photos ${APP_BUNDLE_ID}`); log('Photo permission REVOKED (deny-photo journey).'); } catch {}
    } else if (args.includes('--grant-photo')) {
      try { sh(`xcrun simctl privacy ${udid} grant photos ${APP_BUNDLE_ID}`); log('Photo permission pre-granted.'); } catch {}
    } else {
      try { sh(`xcrun simctl privacy ${udid} reset photos ${APP_BUNDLE_ID}`); log('Photo permission reset → real dialog will appear.'); } catch {}
    }
  }
  await startCompanion(udid);
  await sleep(4000); // let the companion's a11y bridge come up
  idbSafe(['set-location', '--', String(cfg.KINSHASA.lat), String(cfg.KINSHASA.lng)]);
  launchApp(udid);
  await sleep(7000); // splash + first render

  // Confirm the a11y bridge is live before the loop; restart (with warm-up) if
  // not. Probe a few times first — the bridge can lag the app launch.
  let bridgeOk = false;
  for (let i = 0; i < 4; i++) { if (companionResponsive()) { bridgeOk = true; break; } await sleep(2500); }
  if (!bridgeOk) {
    log('a11y bridge not responsive at launch — restarting companion.');
    await restartCompanion(udid);
  }

  // --- loop ---
  const steps = [];
  const redFlags = [];
  const tokens = { input: 0, output: 0 };
  let outcome = { status: 'inconclusive', reason: 'hit step/time budget' };
  const startedAt = Date.now();
  let emptyA11yStreak = 0; // consecutive steps with an empty a11y tree
  let flaggedFreshTest = false; // set once we've stamped the fresh signup acct as a test account
  let noOpTapHint = null; // set when the last tap produced no on-screen change (fed to next decision)

  for (let step = 1; step <= maxSteps; step++) {
    if (Date.now() - startedAt > timeoutMs) { outcome = { status: 'inconclusive', reason: 'timeout' }; break; }

    const shotPath = path.join(runDir, `step-${String(step).padStart(2, '0')}.png`);
    if (!screenshot(shotPath)) { log(`screenshot failed at step ${step}`); await sleep(1500); continue; }
    const imgB64 = fs.readFileSync(shotPath).toString('base64');
    let elements = a11yElements();

    // Empty a11y has two causes: (a) a WEDGED companion bridge — restart fixes
    // it; or (b) a genuinely BLANK app screen (dead-end / unrendered) — only an
    // app relaunch escapes it. Try companion restart first; if a11y is STILL
    // empty afterwards, the screen is truly blank → relaunch the app.
    if (elements.length === 0) {
      emptyA11yStreak++;
      if (emptyA11yStreak === 2) {
        log(`a11y empty ×2 — restarting companion (bridge-wedge recovery)`);
        await restartCompanion(udid);
        elements = a11yElements();
        if (elements.length > 0) emptyA11yStreak = 0;
      } else if (emptyA11yStreak >= 4) {
        log(`a11y STILL empty ×${emptyA11yStreak} after companion restart — relaunching app to escape a blank dead-end`);
        terminateApp(udid);
        await sleep(1500);
        launchApp(udid);
        await sleep(6000);
        elements = a11yElements();
        emptyA11yStreak = 0;
      }
    } else {
      emptyA11yStreak = 0;
    }

    // FRESH signup: once the app has created the account (Auth user appears),
    // FORCE a known 4-digit code on its doc and surface it so the agent types
    // the real digits (not the literal "LOGIN_CODE"). The app verifies the PIN
    // client-side against users/<uid>.email_code, so overwriting it is fine.
    let liveHint = null;
    if (isFresh && freshEmail) {
      const freshUid = await otp.uidForEmail(freshEmail).catch(() => null);
      if (freshUid) {
        // Flag the app-created signup account as a test account the FIRST time we
        // see it, so the CF isolation filters (findCompatiblePlayers/Games) treat
        // it as a test account and only ever show it OTHER test entities. Without
        // this, the app creates the account WITHOUT is_test_account, and the
        // "suggested players" step surfaces REAL users.
        if (!flaggedFreshTest) {
          await markAccountAsTest(freshUid).then(() => { flaggedFreshTest = true; log('Flagged fresh signup account is_test_account:true'); }).catch(() => {});
          if (LANG) { await setAccountLanguage(freshUid, LANG).catch(() => {}); }
        }
        // Read the code the APP generated for itself (it writes email_code
        // during signup). Do NOT overwrite it: the app caches its own code in
        // currentUserDocument, and the PIN sim-shim types THAT cached value — so
        // if we force a different code here, the shim's typed digits and the
        // backend's expected code diverge and verification fails. Poll briefly
        // for the app's code; only if it never appears (not a real signup) fall
        // back to writing a deterministic one.
        let code = await otp.readCode(freshUid, { waitMs: 8000, intervalMs: 800 }).catch(() => null);
        if (!code) { code = await otp.setKnownCode(freshUid, otp.DEFAULT_CODE).catch(() => null); }
        if (code) liveHint = `THE ACTUAL 4-digit email verification code is ${code}. On a PIN/code screen, type the digits ${code} (NOT the words "LOGIN_CODE").`;
      }
    }

    let decision, usage;
    // Combine any live account hint with a no-op-tap hint from the previous step.
    const combinedHint = [liveHint, noOpTapHint].filter(Boolean).join('\n\n') || null;
    try {
      ({ decision, usage } = await decide(client, model, sys, imgB64, elements, steps, combinedHint));
    } catch (e) {
      log(`decide error step ${step}: ${e.message}`);
      await sleep(2000); continue;
    }
    tokens.input += usage.input_tokens || 0;
    tokens.output += usage.output_tokens || 0;

    const rec = { step, ...decision, screenshot: shotPath };
    steps.push(rec);
    log(`step ${step}: ${decision.action}${decision.text ? ` "${decision.text}"` : ''}${decision.coordinates ? ` @${JSON.stringify(decision.coordinates)}` : ''} — ${decision.reason}`);

    if (decision.action === 'red_flag') {
      redFlags.push({ step, severity: decision.red_flag_severity || 'warn', reason: decision.reason, screen: decision.screen || '(unlabeled screen)', screenshot: shotPath });
      if (decision.red_flag_severity === 'block') { outcome = { status: 'fail', reason: `blocking red flag: ${decision.reason}` }; break; }
      continue; // warn/info: keep going
    }
    if (decision.action === 'done') {
      outcome = decision.goal_reached
        ? { status: 'pass', reason: decision.reason }
        : { status: 'inconclusive', reason: `agent stopped: ${decision.reason}` };
      break;
    }
    try {
      const res = await act(decision);
      // If a tap changed nothing even after the driver's retry+nudge, tell the
      // NEXT decision so the agent treats it as a genuine no-op (pick a different
      // target / element) instead of hammering the same spot and crying dead-end.
      noOpTapHint = (decision.action === 'tap' && res && res.changed === false)
        ? `Your previous tap at [${decision.coordinates}] changed NOTHING on screen — the driver already auto-retried it 6× with small nudges, so that exact spot is a dead target. Do NOT tap there again. Either pick a DIFFERENT element/coordinate, or (if you believe the element is elsewhere) estimate its position from the screenshot (pixels÷3 = points).`
        : null;
    } catch (e) { log(`act error: ${e.message}`); }
  }

  // --- teardown + report ---
  if (!keepApp) terminateApp(udid);
  stopCompanion();
  // Clean up a fresh signup account (Auth + doc) so runs don't accumulate them.
  if (isFresh && freshEmail) { await deleteFreshAccount(freshEmail).catch((e) => log(`fresh cleanup failed: ${e.message}`)); }
  const personaLabel = isFresh ? (freshEmail || 'FRESH') : cfg.emailFor(persona);
  writeReport(runDir, { journey: journeyName, timestamp: ts, persona: personaLabel, model: conf.model || 'sonnet' }, steps, redFlags, outcome, tokens);

  // --- stdout summary ---
  console.log('\n' + '='.repeat(60));
  console.log(`JOURNEY: ${journeyName}`);
  console.log(`OUTCOME: ${outcome.status.toUpperCase()} — ${outcome.reason}`);
  console.log(`Steps: ${steps.length} | Red flags: ${redFlags.length} (${redFlags.filter(r => r.severity === 'block').length} blocking)`);
  console.log(`Tokens: ${tokens.input} in / ${tokens.output} out`);
  console.log(`Report: ${path.join(runDir, 'report.md')}`);
  console.log('='.repeat(60));

  process.exit(outcome.status === 'fail' ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); stopCompanion(); process.exit(1); });
