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
let COMPANION_PORT = null;
function idb(args, opts = {}) {
  const env = { ...process.env };
  if (COMPANION_PORT) env.IDB_COMPANION = `localhost:${COMPANION_PORT}`;
  return execFileSync(IDB, args, { encoding: 'utf8', env, ...opts });
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
// Detect a companion already listening (e.g. from a prior run / manual start).
// Returns its port or null. idb_companion prints one line per LISTEN socket.
function existingCompanionPort() {
  try {
    const pids = sh(`pgrep -f idb_companion`).trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      const out = sh(`lsof -a -p ${pid} -iTCP -sTCP:LISTEN -P -n 2>/dev/null || true`);
      const m = out.match(/:(\d+)\s+\(LISTEN\)/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}
function startCompanion(udid) {
  const existing = existingCompanionPort();
  if (existing) { COMPANION_PORT = existing; log(`Reusing companion on port ${existing}`); return Promise.resolve(); }
  const { spawn } = require('child_process');
  log('Starting idb companion...');
  companionProc = spawn(IDB_COMPANION_BIN, ['--udid', udid], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(/"grpc_port":\s*(\d+)/) || buf.match(/swift server on tcp port (\d+)/i);
      if (m && !COMPANION_PORT) { COMPANION_PORT = m[1]; log(`Companion on port ${COMPANION_PORT}`); resolve(); }
    };
    companionProc.stdout.on('data', onData);
    companionProc.stderr.on('data', onData);
    companionProc.on('exit', (c) => { if (!COMPANION_PORT) reject(new Error(`companion exited ${c}`)); });
    setTimeout(() => { if (!COMPANION_PORT) reject(new Error('companion port timeout')); }, 15000);
  });
}
// Only kill a companion WE started; leave a reused one alone.
function stopCompanion() { if (companionProc) try { companionProc.kill(); } catch {} }

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
    case 'type':
      if (text == null) throw new Error('type without text');
      idbSafe(['ui', 'text', String(text)]);
      await sleep(1200);
      return;
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

async function decide(client, model, sys, imgB64, elements, history) {
  const elemText = elements.length
    ? elements.map((e, i) => `${i}. [${e.type}] ${e.label ? `"${e.label}"` : '(unlabeled ' + e.type + ')'} @(${e.x},${e.y})${e.enabled ? '' : ' (disabled)'}`).join('\n')
    : '(accessibility tree empty — reason from the screenshot, converting pixels→points by /3)';
  const histText = history.length
    ? history.slice(-8).map((h, i) => `${history.length - Math.min(8, history.length) + i + 1}. ${h.action}${h.text ? ` "${h.text}"` : ''}${h.coordinates ? ` @${JSON.stringify(h.coordinates)}` : ''} — ${h.reason}`).join('\n')
    : '(none yet)';

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
        { type: 'text', text: `Accessibility elements:\n${elemText}\n\nAction history (recent):\n${histText}\n\nDecide the next action.` },
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

  // Resolve persona. Poteau email login is email+password → Home. Also pre-set a
  // known email_code in case a 4-digit code screen appears in some flow variant.
  const personaEmail = cfg.emailFor(persona);
  const personaUid = await otp.uidForEmail(personaEmail);
  if (!personaUid) throw new Error(`Persona ${personaEmail} has no account.`);
  const loginCode = await otp.setKnownCode(personaUid, otp.DEFAULT_CODE);
  log(`Persona ${personaEmail} (${personaUid}) — password login, code fallback ${loginCode}`);

  const runCtx = {
    PERSONA_EMAIL: personaEmail,
    LOGIN_PASSWORD: cfg.TEST_PASSWORD,
    LOGIN_CODE: loginCode,
    SEED_GAME_ID: 'Rx7D9yhKIHYg8ldxddo7',
    KINSHASA: `${cfg.KINSHASA.lat},${cfg.KINSHASA.lng}`,
  };

  const client = new Anthropic();
  const sys = systemPrompt(journeyText, runCtx);

  // --- boot / install / launch ---
  bootSim(udid);
  await startCompanion(udid);
  // Put the sim in Kinshasa so location-based discovery matches.
  idbSafe(['set-location', '--', String(cfg.KINSHASA.lat), String(cfg.KINSHASA.lng)]);
  if (!noBuild) installApp(udid);
  terminateApp(udid);
  launchApp(udid);
  await sleep(6000); // splash

  // --- loop ---
  const steps = [];
  const redFlags = [];
  const tokens = { input: 0, output: 0 };
  let outcome = { status: 'inconclusive', reason: 'hit step/time budget' };
  const startedAt = Date.now();

  for (let step = 1; step <= maxSteps; step++) {
    if (Date.now() - startedAt > timeoutMs) { outcome = { status: 'inconclusive', reason: 'timeout' }; break; }

    const shotPath = path.join(runDir, `step-${String(step).padStart(2, '0')}.png`);
    if (!screenshot(shotPath)) { log(`screenshot failed at step ${step}`); await sleep(1500); continue; }
    const imgB64 = fs.readFileSync(shotPath).toString('base64');
    const elements = a11yElements();

    let decision, usage;
    try {
      ({ decision, usage } = await decide(client, model, sys, imgB64, elements, steps));
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
  writeReport(runDir, { journey: journeyName, timestamp: ts, persona: personaEmail, model: conf.model || 'sonnet' }, steps, redFlags, outcome, tokens);

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
