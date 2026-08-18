#!/usr/bin/env node
/**
 * The Poteau daily chat brief — an editorial read of yesterday's game chat.
 *
 * WHY THIS IS NOT A DASHBOARD. Counting messages tells you nothing: 1,015
 * messages is the same number whether players spent the day thanking each
 * other or threatening to quit. The value is in what was SAID, and that only
 * becomes visible when someone reads all of it. So this script does the
 * reading (extraction, threading, name resolution) and hands the corpus to an
 * LLM to write the actual brief.
 *
 * PIPELINE
 *   1. pull every `messages` doc from the target day
 *   2. drop `log` lines from the narrative, but COUNT them — they are the
 *      roster facts (joined / left / cancelled) that explain the chat
 *   3. group the human messages into per-game threads, in time order
 *   4. resolve author_id -> display_name (human messages carry NO author_name;
 *      that field is only ever populated on log lines)
 *   5. attach game context: centre, kickoff, sport, status, roster size
 *   6. classify the routine mechanically, so the LLM's attention — and the
 *      quotes — go to what is actually novel
 *   7. `claude -p` writes the brief; this script posts it to Slack
 *
 * Usage:
 *   node chat_brief.js                    # yesterday, print only
 *   node chat_brief.js --slack            # post to #newspaper
 *   node chat_brief.js --date=2026-08-17  # a specific day
 *   node chat_brief.js --corpus           # dump the LLM input, call nothing
 *   node chat_brief.js --raw              # print the brief the LLM returned
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');

function dep(name) {
    try { return require(name); }
    catch (e) { return require(`/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/${name}`); }
}
const admin = dep('firebase-admin');
const { DateTime } = dep('luxon');

const SA_PATH = '/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json';
const PROJECT = 'krank-club';
const TZ = 'Europe/Paris';
// The brief goes to #newspaper, NOT #health-reports. A Slack incoming webhook
// is bound to one channel when it is created, so this needs its own URL and
// cannot reuse slack_webhook.env — adding the Claude app to the channel grants
// read access, not a posting route. Falls back to the health webhook only if
// explicitly pointed there, so a missing file fails loudly instead of
// publishing an editorial into the infrastructure channel.
const WEBHOOK_ENV = process.env.NEWSPAPER_WEBHOOK_ENV
    || `${process.env.HOME}/.poteau/newspaper_webhook.env`;

const arg = (k) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const SLACK = process.argv.includes('--slack');
const CORPUS_ONLY = process.argv.includes('--corpus');
const RAW = process.argv.includes('--raw');
const DATE_ARG = arg('date');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)), projectId: PROJECT });
}
const db = admin.firestore();

// The day boundary is Europe/Paris, not UTC. In August that is UTC+2, so a
// UTC-midnight window would put two hours of the previous evening's chat — the
// busiest slot of the day, when games actually kick off — into the wrong brief.
const day = DATE_ARG
    ? DateTime.fromISO(DATE_ARG, { zone: TZ }).startOf('day')
    : DateTime.now().setZone(TZ).minus({ days: 1 }).startOf('day');
const START = day.toJSDate();
const END = day.plus({ days: 1 }).toJSDate();

// ------------------------------------------------------------ routine buckets

/**
 * Messages that are pure coordination. Matching one of these does NOT hide the
 * message from the LLM, it only marks it as routine so the model knows not to
 * spend a quote on it — a "je confirme" is never the story.
 *
 * Deliberately French-first with light accent tolerance: the corpus is
 * overwhelmingly French and normalising accents away would break real words.
 */
const ROUTINE = [
    [/^(je )?(confirme|confirmé)\b|^(oui|ok|yes|d'?acc(ord)?|c'?est bon|nickel|parfait|ça marche|ca marche)\b/i, 'confirmation'],
    [/d[ié]sistement|si (quelqu'un|qqn|qq)|dispo si|je suis dispo|en cas de/i, 'standby for a spot'],
    [/quel nom|au nom de|r[eé]servation est|nom de la r[eé]serv/i, 'asking the booking name'],
    [/^(on arrive|j'arrive|on est l[àa]|je suis l[àa]|on vient|j'y serai|présent|present)\b/i, 'arrival'],
    [/terrain \d|on est terrain|quel terrain/i, 'finding the pitch'],
    [/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s‍️]+$/u, 'emoji only'],
    [/^(merci|thanks|mrc)\b/i, 'thanks'],
    [/^(salut|slt|bonjour|bonsoir|salam|salem|yo|hello|coucou)\b[\s!.?]*$/i, 'greeting only'],
];

/**
 * A message is routine only if that is ALL it is.
 *
 * Length is the guard that matters. "Ok" is routine; "Ok c'est pour ça que je
 * demande si c'est possible de faire 1h30 avant de m'inscrire, parce qu'il
 * suffit qu'un joueur soit en retard et on joue 40 minutes" opens with the same
 * word and is the most substantive message in its thread. Matching on the
 * prefix alone silently demoted exactly the messages worth quoting, so anything
 * long enough to carry an argument is never tagged.
 */
const ROUTINE_MAX_CHARS = 60;

function routineTag(text) {
    if (text.length > ROUTINE_MAX_CHARS) return null;
    for (const [re, tag] of ROUTINE) if (re.test(text)) return tag;
    return null;
}

// -------------------------------------------------------------------- fetch

async function fetchDay() {
    const snap = await db.collection('messages')
        .where('created', '>=', START).where('created', '<', END).get();

    const human = [];
    const logs = {};          // roster events, counted
    let teamMessages = 0;
    const gameIds = new Set();
    const authorIds = new Set();

    snap.forEach(d => {
        const m = d.data();
        const type = m.type || '—';
        const text = (m.text || '').trim();

        if (type === 'log') {
            // Log text is "<name> a rejoint le match." — strip the name so the
            // kinds collapse into countable buckets.
            const kind = text.replace(/^\S+(\s\S+)?\s+(?=a\s)/, '').slice(0, 48) || '(empty)';
            logs[kind] = (logs[kind] || 0) + 1;
            return;
        }
        if (type === 'poteau_team_message') { teamMessages++; return; }
        if (!text) return;

        const gid = m.game_id && m.game_id.id;
        const aid = m.author_id && m.author_id.id;
        if (gid) gameIds.add(gid);
        if (aid) authorIds.add(aid);

        human.push({
            gid, aid, text,
            at: m.created ? m.created.toDate() : null,
            fromCentre: m.source === 'poteau_max',
            reactions: (m.reactions || []).length,
        });
    });

    return { human, logs, teamMessages, gameIds, authorIds, total: snap.size };
}

/** Batch-resolve refs. getAll takes a few hundred at a time comfortably. */
async function resolveAll(collection, ids, pick) {
    const out = {};
    const list = [...ids];
    for (let i = 0; i < list.length; i += 250) {
        const chunk = list.slice(i, i + 250);
        const docs = await db.getAll(...chunk.map(id => db.doc(`${collection}/${id}`)));
        docs.forEach(d => { if (d.exists) out[d.id] = pick(d.data()); });
    }
    return out;
}

// ------------------------------------------------------------------- corpus

/**
 * Assemble the text handed to the model.
 *
 * Threads are ordered by message count, because a 40-message argument is more
 * likely to matter than a lone "ok". Single-message games are collapsed into a
 * tail section: they cannot form a story, but a complaint can still hide in
 * one, so they are included rather than dropped.
 */
function buildCorpus(data, names, games) {
    const byGame = {};
    for (const m of data.human) {
        if (!m.gid) continue;
        (byGame[m.gid] = byGame[m.gid] || []).push(m);
    }

    const threads = Object.entries(byGame)
        .map(([gid, msgs]) => ({ gid, msgs: msgs.sort((a, b) => a.at - b.at) }))
        .sort((a, b) => b.msgs.length - a.msgs.length);

    const routineCounts = {};
    let routineTotal = 0;
    for (const m of data.human) {
        const tag = routineTag(m.text);
        if (tag) { routineCounts[tag] = (routineCounts[tag] || 0) + 1; routineTotal++; }
    }

    const L = [];
    L.push(`DATE: ${day.toFormat('cccc d LLLL yyyy')}`);
    L.push(`${data.human.length} messages written by real people across ${threads.length} games.`);
    L.push('');
    L.push('ROSTER EVENTS (system log lines, for context — these are facts, not chat):');
    Object.entries(data.logs).sort((a, b) => b[1] - a[1]).slice(0, 14)
        .forEach(([k, n]) => L.push(`  ${n} x ${k}`));
    L.push('');
    L.push('ROUTINE COORDINATION already counted mechanically — do NOT quote these,');
    L.push('just report the totals if useful:');
    Object.entries(routineCounts).sort((a, b) => b[1] - a[1])
        .forEach(([k, n]) => L.push(`  ${n} x ${k}`));
    L.push(`  (${routineTotal} of ${data.human.length} messages are routine)`);
    L.push('');
    L.push('='.repeat(70));
    L.push('THE CONVERSATIONS');
    L.push('='.repeat(70));

    const multi = threads.filter(t => t.msgs.length > 1);
    const singles = threads.filter(t => t.msgs.length === 1);

    for (const t of multi) {
        const g = games[t.gid] || {};
        const when = g.date ? DateTime.fromJSDate(g.date).setZone(TZ).toFormat('HH:mm') : '?';
        L.push('');
        L.push(`--- ${g.centre || 'unknown venue'} · kickoff ${when} · ${g.sport || '?'} · ${g.status || '?'} · ${g.players || 0}/${g.max || '?'} players · ${t.msgs.length} messages`);
        for (const m of t.msgs) {
            const who = m.fromCentre
                ? `${g.centre || 'the centre'} [CENTRE STAFF]`
                : (names[m.aid] || 'unknown');
            const time = m.at ? DateTime.fromJSDate(m.at).setZone(TZ).toFormat('HH:mm') : '--:--';
            const tag = routineTag(m.text) ? ' (routine)' : '';
            L.push(`  ${time} ${who}${tag}: ${m.text.replace(/\s+/g, ' ')}`);
        }
    }

    if (singles.length) {
        L.push('');
        L.push(`--- ${singles.length} games had a single message each:`);
        for (const t of singles) {
            const g = games[t.gid] || {};
            const m = t.msgs[0];
            const who = m.fromCentre ? `${g.centre || 'centre'} [CENTRE STAFF]` : (names[m.aid] || 'unknown');
            L.push(`  ${g.centre || '?'} — ${who}: ${m.text.replace(/\s+/g, ' ')}`);
        }
    }
    return { corpus: L.join('\n'), threads: threads.length, routineTotal, routineCounts };
}

// ---------------------------------------------------------------- the writer

/**
 * The editorial instruction.
 *
 * Written as a newspaper desk brief rather than "summarise this", because
 * "summarise" reliably produces a flat list of topics. A newspaper has a lead,
 * a hierarchy, and quotes that carry the voice of the person who spoke — which
 * is the whole point of reading chat instead of counting it.
 */
const PROMPT = `You are the editor of an internal daily newspaper about Poteau, a French app
where amateur players organise football and padel games at sports centres.

Below is EVERY message real players and centre staff wrote in game chats
yesterday. Read all of it, then write the day's brief.

Poteau context you need to read this correctly:
- Games are organised by whoever creates them. They fill only if strangers join,
  and most games never fill. Players joining and leaving is normal, not drama.
- A "+1" is a spot someone books for a friend, not a named person.
- Centre staff messages are marked [CENTRE STAFF] — they speak for the venue,
  so what they say carries more weight than one player's opinion.
- Messages marked (routine) are mechanical coordination. Never quote them.

WRITE THIS STRUCTURE:

1. A one-paragraph LEAD. What actually characterised yesterday? Not "players
   coordinated games" — that is always true and says nothing. Find the real
   theme of the day.

2. 3 to 5 STORIES, each with a short headline. A story is a specific thing that
   happened in a specific game: a negotiation, a conflict, a venue problem, an
   act of generosity, a confusion the app caused. For each one, say what
   happened and quote the messages that show it. Attribute every quote to the
   person by name and the venue. Quote in the original French; add a short
   English gloss in brackets only when the meaning is not obvious.

3. FRICTION — anything a player struggled with that is Poteau's fault, not the
   players'. Confusions about how the app works, missing features they asked
   for, things they had to work around by exchanging phone numbers. Be concrete
   and quote them. If there is none, say so plainly.

4. THE MOOD — one or two sentences. Were people warm, irritated, funny?

5. WORTH A REPLY — a short list of anyone who asked something nobody answered,
   or who deserves a human response from the Poteau team. Name them and the
   venue. If nobody, say so.

RULES:
- Ground everything in the actual messages. Never invent a quote or a fact. If
  you are unsure what someone meant, say so rather than guessing.
- Lead with what is interesting. Routine volume goes in one line at most.
- Quotes are the point. Use plenty of real ones.
- Write in English, but keep the French quotes in French.
- Use "game", never "match", when writing your own prose.
- No em dashes. No bullet-point soup — write actual sentences.
- Plain text only, no markdown headers or ** bold **. This is going into a
  terminal and a Slack code block. Use CAPS for section titles and two-space
  indentation for quotes.
- If the day was genuinely quiet, say that in one short brief. Do not inflate
  a nothing day into five stories.

FORMAT (this matters, the output goes into a terminal and a Slack code block):
Plain text ONLY. No markdown whatsoever: no #, no ##, no **bold**, no bullet
characters, no backticks, no tables. Section titles in CAPITALS on their own
line. Indent quotes by two spaces. No em dashes anywhere.

THE MESSAGES:

`;

/**
 * Strip markdown the model emits anyway.
 *
 * The prompt asks for plain text because the output lands in a terminal and a
 * Slack code block, where "## Heading" and "**bold**" are literal noise. The
 * instruction is not reliably obeyed on a long prompt, so the guarantee is
 * enforced here instead of hoped for.
 */
function toPlainText(s) {
    return s
        .replace(/^#{1,6}\s*/gm, '')          // ## Heading -> Heading
        .replace(/\*\*(.+?)\*\*/g, '$1')      // **bold** -> bold
        .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g, '$1$2') // *it* -> it
        .replace(/^\s*[-*]\s+/gm, '  ')        // - item -> indented
        .replace(/^\s*>\s?/gm, '  ')           // > quote -> indented
        .replace(/`([^`\n]+)`/g, '$1')         // `code` -> code
        .replace(/\u2014/g, ',')               // em dash: house style forbids it
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Ask the writer, retrying transient API failures.
 *
 * A 529 Overloaded on the 09:00 run would otherwise cost the whole day's brief,
 * and the corpus is only assembled once a day. Backoff is generous because
 * nothing is waiting on this: a brief that lands at 09:06 is still the morning
 * paper.
 */
function writeBriefWithRetry(corpus, attempts = 3) {
    let last;
    for (let i = 1; i <= attempts; i++) {
        try {
            return writeBrief(corpus);
        } catch (e) {
            last = e;
            const transient = /529|overloaded|rate.?limit|timeout|ECONN|503|502/i.test(e.message);
            if (!transient || i === attempts) break;
            const wait = i * 60;
            console.error(`[chat_brief] attempt ${i} failed (${e.message.slice(0, 80)}), retrying in ${wait}s`);
            execFileSync('sleep', [String(wait)]);
        }
    }
    throw last;
}

function writeBrief(corpus) {
    // spawnSync, not execFileSync: execFileSync's `timeout` kills with SIGTERM
    // and then throws, so a run that produced a perfectly good brief is
    // reported as "Command failed: claude -p" with an empty message. That is
    // exactly what happened on the first live run. Here the exit status and
    // stderr are inspected explicitly, and a non-empty stdout is trusted even
    // if the CLI exits non-zero.
    const res = spawnSync('claude', ['-p'], {
        input: PROMPT + corpus,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 15 * 60 * 1000,
    });
    const out = (res.stdout || '').trim();

    // The CLI prints transient API failures to STDOUT and still exits 0, so a
    // non-empty stdout is not proof of a brief. "API Error: 529 Overloaded"
    // sailed through as the day's newspaper on the first run. Anything this
    // short, or that announces itself as an error, is a failure: the shortest
    // legitimate brief still runs to several hundred characters.
    const looksLikeError = /^(API Error|Execution error|Error:)/i.test(out) || out.length < 200;
    if (out && !looksLikeError) return toPlainText(out);
    if (out && looksLikeError) {
        throw new Error(`the writer returned an error instead of a brief: ${out.slice(0, 200)}`);
    }

    const why = res.error ? res.error.message
        : (res.stderr || '').trim() || `claude exited ${res.status} with no output`;
    throw new Error(`the writer produced nothing: ${why}`);
}

// ------------------------------------------------------------------- output

function slackWebhookUrl() {
    if (!fs.existsSync(WEBHOOK_ENV)) {
        throw new Error(
            `no webhook for #newspaper at ${WEBHOOK_ENV}. Create an incoming webhook ` +
            `for that channel and save it as SLACK_WEBHOOK_URL="https://hooks.slack.com/..."`);
    }
    const env = fs.readFileSync(WEBHOOK_ENV, 'utf8');
    const url = (env.match(/SLACK_WEBHOOK_URL=["']?([^"'\n]+)/) || [])[1];
    if (!url) throw new Error('SLACK_WEBHOOK_URL not found in ' + WEBHOOK_ENV);
    return url;
}

function post(payload) {
    execFileSync('curl', ['-s', '-X', 'POST', '-H', 'Content-type: application/json',
        '--data', JSON.stringify(payload), slackWebhookUrl()], { encoding: 'utf8' });
}

/**
 * Slack caps a text block at 3000 characters and silently truncates past it,
 * so the brief is split across blocks on paragraph boundaries rather than
 * mid-sentence.
 */
function chunk(text, max = 2800) {
    const out = [];
    let cur = '';
    for (const para of text.split('\n\n')) {
        if ((cur + '\n\n' + para).length > max && cur) { out.push(cur); cur = para; }
        else cur = cur ? cur + '\n\n' + para : para;
    }
    if (cur) out.push(cur);
    return out;
}

function postBrief(brief, meta) {
    const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `The Poteau Daily · ${day.toFormat('cccc d LLLL')}`, emoji: true } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `${meta.messages} messages  ·  ${meta.threads} games with chat  ·  ${meta.authors} players  ·  ${meta.routinePct}% routine` }] },
        { type: 'divider' },
    ];
    for (const part of chunk(brief)) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '```\n' + part.replace(/```/g, "'''") + '\n```' } });
    }
    post({ blocks });
}

// --------------------------------------------------------------------- main

(async () => {
    const data = await fetchDay();

    if (data.human.length === 0) {
        const msg = `No game chat at all on ${day.toFormat('cccc d LLLL')}. Either a genuinely silent day or the message pipeline is broken — worth checking, because a zero here is unusual.`;
        console.log(msg);
        if (SLACK) post({ blocks: [
            { type: 'header', text: { type: 'plain_text', text: `The Poteau Daily · ${day.toFormat('cccc d LLLL')}`, emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: msg } }] });
        process.exit(0);
    }

    const [names, gameDocs] = await Promise.all([
        resolveAll('users', data.authorIds, u => (u.display_name || '').trim() || 'unknown'),
        resolveAll('games', data.gameIds, g => ({
            centre: g.centre, sport: g.sport, status: g.status, max: g.max_players,
            date: g.date ? g.date.toDate() : null,
            // Dedupe: a +1 is the same user ref repeated, so raw length lies.
            players: new Set((g.attendees || [])
                .filter(r => r && r.parent && r.parent.id === 'users').map(r => r.id)).size,
        })),
    ]);

    const { corpus, threads, routineTotal } = buildCorpus(data, names, gameDocs);

    if (CORPUS_ONLY) { console.log(corpus); process.exit(0); }

    const meta = {
        messages: data.human.length,
        threads,
        authors: data.authorIds.size,
        routinePct: Math.round((routineTotal / data.human.length) * 100),
    };

    console.error(`[chat_brief] ${meta.messages} messages, ${meta.threads} games, ${corpus.length} chars -> claude`);
    const brief = writeBriefWithRetry(corpus);
    if (!brief) throw new Error('the writer returned nothing');

    console.log(brief);
    if (RAW) process.exit(0);
    if (SLACK) postBrief(brief, meta);
    process.exit(0);
})().catch(e => {
    // Never fail silently: a missing brief must not look like a quiet day.
    console.error('CHAT BRIEF FAILED:', e && e.message);
    if (SLACK) {
        try {
            post({ blocks: [
                { type: 'header', text: { type: 'plain_text', text: '⚠️ The Poteau Daily failed to run', emoji: true } },
                { type: 'section', text: { type: 'mrkdwn', text: `No brief today, so yesterday's chat has gone unread.\n\`\`\`${String(e && (e.stderr || e.message) || e).split('\n')[0].slice(0, 300)}\`\`\`` } },
                { type: 'context', elements: [{ type: 'mrkdwn', text: 'run `node scripts/chat_brief.js` on the Mac to see the full error' }] }] });
        } catch (_) { /* nothing left to try */ }
    }
    process.exit(1);
});
