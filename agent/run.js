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
  sh(`xcrun simctl launch ${udid} ${APP_BUNDLE_ID}`);
}
function terminateApp(udid) { try { sh(`xcrun simctl terminate ${udid} ${APP_BUNDLE_ID}`); } catch {} }

// ---------------------------------------------------------------------------
// Perceive: screenshot + a11y tree
// ---------------------------------------------------------------------------
function screenshot(outPath) {
  const r = idbSafe(['screenshot', outPath]);
  return r.ok && fs.existsSync(outPath);
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
    case 'tap':
      if (!coordinates) throw new Error('tap without coordinates');
      idbSafe(['ui', 'tap', String(coordinates[0]), String(coordinates[1])]);
      await sleep(1500);
      return;
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
      await sleep(3000);
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
pixels) — do NOT read pixel coordinates off the screenshot. ALWAYS use the (x,y) point
coordinates from the accessibility element list. If you must estimate from the screenshot,
convert: point_x = pixel_x / 3, point_y = pixel_y / 3.

Decide the SINGLE next action via the decide_next_action tool. STRONGLY prefer tapping elements
from the accessibility list using THEIR coordinates. Many icon/nav buttons are UNLABELED images
(shown as "(unlabeled Image)") — the bottom navigation bar is a row of these near y≈780; use their
listed coordinates. If tapping the same target twice produces no change, pick a DIFFERENT element
from the list rather than repeating.

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
  return { email, password, phone: cfg.phoneForIndex(0) };
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
  let md = `# UI Test Report — ${meta.journey}\n\n`;
  md += `- **Run:** ${meta.timestamp}\n`;
  md += `- **Persona:** ${meta.persona}\n`;
  md += `- **Model:** ${meta.model}\n`;
  md += `- **Outcome:** ${outcome.status === 'pass' ? '✅ PASS' : outcome.status === 'fail' ? '❌ FAIL' : '⚠️ INCONCLUSIVE'} — ${outcome.reason}\n`;
  md += `- **Steps:** ${steps.length}\n`;
  md += `- **Tokens:** ${tokens.input} in / ${tokens.output} out\n\n`;

  if (redFlags.length) {
    md += `## 🚩 Red flags (${redFlags.length})\n\n`;
    for (const rf of redFlags) {
      md += `### [${rf.severity.toUpperCase()}] step ${rf.step}: ${rf.reason}\n\n`;
      if (rf.screenshot) md += `![step ${rf.step}](${rel(rf.screenshot)})\n\n`;
    }
  } else {
    md += `## 🚩 Red flags\n\nNone.\n\n`;
  }

  md += `## Step-by-step trace\n\n`;
  for (const s of steps) {
    md += `**${s.step}. ${s.action}**${s.text ? ` \`${s.text}\`` : ''}${s.coordinates ? ` @${JSON.stringify(s.coordinates)}` : ''} — ${s.reason}\n\n`;
    if (s.screenshot) md += `![step ${s.step}](${rel(s.screenshot)})\n\n`;
  }
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
  if (!args.includes('--fast-launch')) installApp(udid);
  // Signup journeys hit a "Choose my photo" step that opens the native picker.
  // Seed the library with an image AND (unless --deny-photo) pre-grant photo
  // permission so the picker works and the funnel completes. The --deny-photo
  // flag leaves permission ungranted so the journey can exercise the
  // denied-permission path (see bug_onboarding_photo_silent_denial).
  if (isFresh) {
    const avatar = path.join(APP_PATH, 'AppIcon60x60@2x.png');
    if (fs.existsSync(avatar)) { try { sh(`xcrun simctl addmedia ${udid} "${avatar}"`); log('Seeded sim photo library.'); } catch {} }
    if (args.includes('--deny-photo')) {
      try { sh(`xcrun simctl privacy ${udid} revoke photos ${APP_BUNDLE_ID}`); log('Photo permission REVOKED (deny-photo journey).'); } catch {}
    } else {
      try { sh(`xcrun simctl privacy ${udid} grant photos ${APP_BUNDLE_ID}`); log('Photo permission granted.'); } catch {}
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
        let code = await otp.readCode(freshUid, { waitMs: 0 }).catch(() => null);
        if (!code) { code = await otp.setKnownCode(freshUid, otp.DEFAULT_CODE).catch(() => null); }
        if (code) liveHint = `THE ACTUAL 4-digit email verification code is ${code}. On a PIN/code screen, type the digits ${code} (NOT the words "LOGIN_CODE").`;
      }
    }

    let decision, usage;
    try {
      ({ decision, usage } = await decide(client, model, sys, imgB64, elements, steps, liveHint));
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
      redFlags.push({ step, severity: decision.red_flag_severity || 'warn', reason: decision.reason, screenshot: shotPath });
      if (decision.red_flag_severity === 'block') { outcome = { status: 'fail', reason: `blocking red flag: ${decision.reason}` }; break; }
      continue; // warn/info: keep going
    }
    if (decision.action === 'done') {
      outcome = decision.goal_reached
        ? { status: 'pass', reason: decision.reason }
        : { status: 'inconclusive', reason: `agent stopped: ${decision.reason}` };
      break;
    }
    try { await act(decision); } catch (e) { log(`act error: ${e.message}`); }
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
