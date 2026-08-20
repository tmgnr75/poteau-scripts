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
 *   node chat_brief.js --catchup          # publish EVERY day still missing
 *   node chat_brief.js --catchup --max=10 # cap how many days one run will do
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

const arg = (k, d) => {
    const v = process.argv.find(a => a.startsWith(`--${k}=`));
    return v ? v.split('=')[1] : d;
};
const SLACK = process.argv.includes('--slack');
const CORPUS_ONLY = process.argv.includes('--corpus');
const RAW = process.argv.includes('--raw');
const DRY = process.argv.includes('--dry');       // build everything, post nothing
const CATCHUP = process.argv.includes('--catchup');
// A backlog cap, so a long outage cannot fire an unbounded number of LLM calls in
// one run. Whatever is left over is picked up by the next run.
const MAX_DAYS = Number(arg('max', 14) || 14);
const DATE_ARG = arg('date');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)), projectId: PROJECT });
}
const db = admin.firestore();

// The day boundary is Europe/Paris, not UTC. In August that is UTC+2, so a
// UTC-midnight window would put two hours of the previous evening's chat — the
// busiest slot of the day, when games actually kick off — into the wrong brief.
// Mutable, because one run may publish several days when catching up. setDay()
// is the only writer; everything downstream reads these.
let day = DATE_ARG
    ? DateTime.fromISO(DATE_ARG, { zone: TZ }).startOf('day')
    : DateTime.now().setZone(TZ).minus({ days: 1 }).startOf('day');
let START = day.toJSDate();
let END = day.plus({ days: 1 }).toJSDate();

function setDay(d) {
    day = d;
    START = day.toJSDate();
    END = day.plus({ days: 1 }).toJSDate();
}

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
    const roster = {};        // per-game movement over the day
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

            // Keep the per-game movement too. A roster that climbed to 13 and
            // fell to 9 at 20:29 is the story of the evening, and it is
            // invisible in the chat text: players discuss the collapse without
            // ever stating the numbers.
            const gid = m.game_id && m.game_id.id;
            if (gid && m.created) {
                let delta = 0;
                const withFriends = text.match(/rejoint le match avec (\d+) ami/);
                const added = text.match(/a ajouté (?:(\d+)|un) ami/);
                const removed = text.match(/a retiré (\d+) ami/);
                if (withFriends) delta = 1 + Number(withFriends[1]);
                else if (/a rejoint le match/.test(text)) delta = 1;
                else if (/a quitté le match/.test(text)) delta = -1;
                else if (added) delta = added[1] ? Number(added[1]) : 1;
                else if (removed) delta = -Number(removed[1]);
                if (delta) (roster[gid] = roster[gid] || []).push({ at: m.created.toDate(), delta });
                if (/a annulé le match/.test(text)) {
                    (roster[gid] = roster[gid] || []).push({ at: m.created.toDate(), cancelled: true });
                }
            }
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

    return { human, logs, roster, teamMessages, gameIds, authorIds, total: snap.size };
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
    const rosterByGame = data.roster || {};
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
        L.push(`--- ${g.centre || 'unknown venue'} · kickoff ${when} · ${g.sport || '?'} · ${t.msgs.length} messages`);

        // THE ENDING, stated as fact. Without this the writer can only report
        // that players argued; it cannot say whether they played, which is the
        // question a reader actually has.
        const ended = g.status === 'played' ? 'PLAYED'
            : (g.status === 'canceled' || g.status === 'hidden') ? 'CANCELLED'
            : g.status === 'published' ? 'still open at the end of the day' : (g.status || 'unknown');
        L.push(`    HOW IT ENDED: ${ended}. ${g.spots || 0} of ${g.max || '?'} spots taken by ${g.players || 0} distinct people`
            + (g.spots > g.players
                ? ` (${g.spots - g.players} of those ${g.spots - g.players === 1 ? 'spots is a +1 guest' : 'spots are +1 guests'})`
                : '')
            + `.`);
        const after = [];
        if (g.noShows) after.push(`${g.noShows} reported as no-show`);
        if (g.lates) after.push(`${g.lates} reported late`);
        if (g.praised) after.push(`${g.praised} praised by teammates`);
        if (g.rude) after.push(`${g.rude} reported for behaviour`);
        L.push(`    AFTERWARDS: ${after.length ? after.join(', ') : 'no feedback left by anyone'}.`);

        // The roster trajectory: how the day moved, in numbers the chat never says.
        const moves = (rosterByGame[t.gid] || []).sort((a, b) => a.at - b.at);
        if (moves.length) {
            let n = 0;
            const marks = [];
            for (const mv of moves) {
                if (mv.cancelled) { marks.push(`${DateTime.fromJSDate(mv.at).setZone(TZ).toFormat('HH:mm')} CANCELLED`); continue; }
                n += mv.delta;
                marks.push(`${DateTime.fromJSDate(mv.at).setZone(TZ).toFormat('HH:mm')} ${mv.delta > 0 ? '+' : ''}${mv.delta} (${n})`);
            }
            const peak = Math.max(...marks.map((_, i) => i), 0);
            L.push(`    ROSTER MOVED: ${marks.join('  ')}`);
            L.push(`    (that count is signups over the day and drifts from the final figure above, which is the truth)`);
        }
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

YOUR OUTPUT MUST BEGIN WITH THIS EXACT LINE:
===TEASER===
Nothing may precede it. No title, no date, no preamble. If your first line is
anything else, the output is unusable.

The teaser block is what someone sees in Slack before deciding to open the paper:

===TEASER===
ONE sentence naming what actually characterised the day.
- one line per story, between three and five lines, each naming the venue and
  what happened, under 90 characters, each starting with "- "
ACT: the single most urgent thing a human should do today, one short line, or
"ACT: nothing urgent".
===END TEASER===

Then, after ===END TEASER===, the full brief described below. Do NOT put a title
or a date line at the start of the brief; the page adds those.

Below is EVERY message real players and centre staff wrote in game chats
yesterday. Read all of it, then write the day's brief.

Poteau context you need to read this correctly:
- Games are organised by whoever creates them. They fill only if strangers join,
  and most games never fill. Players joining and leaving is normal, not drama.
- A "+1" is a spot someone books for a friend, not a named person.
- Centre staff messages are marked [CENTRE STAFF] — they speak for the venue,
  so what they say carries more weight than one player's opinion.
- Messages marked (routine) are mechanical coordination. Never quote them.
- Each conversation carries HOW IT ENDED, AFTERWARDS and ROSTER MOVED lines.
  These are FACTS from the database, not chat. They are how you know whether a
  game was played, how full it got, and who was reported afterwards. The chat
  itself never states these. Use them, and never contradict them.
- "10 of 10 spots taken by 6 distinct people" means the game LOOKED full while
  only six humans were coming: the rest are +1 guests. That gap is often the
  story.

WRITE THIS STRUCTURE:

1. A one-paragraph LEAD. What actually characterised yesterday? Not "players
   coordinated games" — that is always true and says nothing. Find the real
   theme of the day, and ground it in the numbers you were given.

   Then a short paragraph headed HOW THE DAY RAN, tracing the shape of it in
   time: when the first games were being filled, when the pressure peaked, what
   the evening looked like. Use the clock times and the roster movements.

2. 3 to 5 STORIES, in CHRONOLOGICAL order of when the game kicked off, earliest
   first, so the brief reads as the day unfolding.

   HEADLINES ARE INFORMATIVE, NOT MYSTERIOUS. This is an investigative rundown,
   not clickbait. A reader skimming only the headlines must come away knowing
   what happened. Name the venue, the time, and the outcome.
     BAD:  "The night the roster melted"
     BAD:  "A card for someone else's mistake"
     GOOD: "LE FIVE Marville, 21:30: roster hit 13, collapsed to 9, played 10/10"
     GOOD: "Foot POWER 5: Nash carded after the organiser's own misclick"

   For each story, write it as a reporter would:
   - open with what happened and how it ended, not with a tease
   - then walk the exchange in TIME ORDER with the clock times, so the reader
     sees the conversation, not two quotes floating without context. When
     someone replies to someone else, give enough of the exchange that the reply
     makes sense: who said what, at what time, and what came back.
   - name every speaker and the venue. Quote in the original French; add a short
     English gloss in brackets only when the meaning is not obvious.
   - EVERY indented quote line must end with its speaker and the time, in this
     exact shape, or the reader cannot tell who is talking:
       "Tout le monde peut confirmé svp ?" (Mohamed, 12:16)
     Two spaces of indent, the quote in double quotes, then the name and clock
     time in round brackets. Never an indented quote without that attribution.
   - CLOSE EVERY STORY with a line starting "HOW IT ENDED:" stating the outcome
     from the HOW IT ENDED and AFTERWARDS facts given to you. Never leave a
     story hanging on "we do not know if they played". You DO know. Use it.
     If a story has no ending in the data, say exactly that instead of guessing.

3. FRICTION — anything a player struggled with that is Poteau's fault, not the
   players'. Confusions about how the app works, missing features they asked
   for, things they had to work around by exchanging phone numbers. Be concrete
   and quote them. If there is none, say so plainly.

4. THE MOOD — one or two sentences. Were people warm, irritated, funny?

5. WORTH A REPLY — a short list of anyone who asked something nobody answered,
   or who deserves a human response from the Poteau team. Name them and the
   venue. If nobody, say so.

RULES:
- EVERY QUOTE MUST BE COPIED CHARACTER FOR CHARACTER from the messages below.
  Do not tidy spelling, do not fix grammar, do not translate into the quote, do
  not merge two messages into one quote. If you cannot copy it exactly, do not
  quote it. These go in front of the players who wrote them.
- EVERY CLOCK TIME must be the one printed next to that message. Never estimate
  a time, never round it, never infer one from context.
- NEVER state a number that was not given to you. Roster counts, spots, who was
  reported, whether a game played: all of that is in the HOW IT ENDED and
  AFTERWARDS lines. If a number is not there, do not produce one.
- Do not describe what a player "felt", "assumed", "intended" or "was thinking".
  You have their words, not their mind. Report what they wrote and what
  followed.
- If two readings of an exchange are possible, give the one the text supports
  and say plainly that the rest is unclear. An honest gap is worth more than a
  confident guess, because Tim will check.
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

FORMAT (this matters, the output goes into a terminal, a Slack block and a web
page): Plain text ONLY. No markdown whatsoever: no #, no ##, no **bold**, no
bullet characters other than the "- " in the teaser list, no backticks, no
tables. Section titles in CAPITALS on their own line. Indent quotes by two
spaces. No em dashes anywhere.

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

// The published page's head. Newsprint: a warm paper ground, a high-contrast
// display serif for the masthead and headlines, a reading serif for body, and
// mono for data. Every colour is a token defined on bare :root, so the two dark
// blocks only restate values -- a colour whose ONLY definition sits inside a
// media query renders one theme's text on the other theme's ground.
const PAGE_HEAD = `<title>The Poteau Daily</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root {
    --paper:#FBF9F4; --paper-sunk:#F2EEE5; --ink:#16171B; --ink-soft:#3A3C43;
    --muted:#6B6E76; --rule:#D8D2C4; --pitch:#1E5B3A; --whistle:#9A6B18;
    --measure:62ch;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:#14151A; --paper-sunk:#1C1E24; --ink:#ECE7DC; --ink-soft:#C6C1B6;
      --muted:#8E9199; --rule:#33363F; --pitch:#6FBF8E; --whistle:#D8A93F;
    }
  }
  :root[data-theme="dark"] {
    --paper:#14151A; --paper-sunk:#1C1E24; --ink:#ECE7DC; --ink-soft:#C6C1B6;
    --muted:#8E9199; --rule:#33363F; --pitch:#6FBF8E; --whistle:#D8A93F;
  }
  *,*::before,*::after { box-sizing:border-box; }
  body {
    background:var(--paper); color:var(--ink);
    font-family:"Source Serif 4",Georgia,"Times New Roman",serif;
    font-size:1.0625rem; line-height:1.62; margin:0; padding:0 1.5rem 6rem;
    -webkit-font-smoothing:antialiased;
  }
  .sheet { max-width:var(--measure); margin:0 auto; }
  header.masthead { padding:3.5rem 0 0; border-bottom:3px double var(--pitch); }
  .eyebrow {
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.6875rem;
    letter-spacing:0.16em; text-transform:uppercase; color:var(--pitch); margin:0 0 1rem;
  }
  h1.title {
    font-family:"Instrument Serif",Georgia,serif; font-weight:400;
    font-size:clamp(2.9rem,9vw,5.25rem); line-height:0.94; letter-spacing:-0.015em;
    margin:0 0 0.6rem; text-wrap:balance;
  }
  .dateline {
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.75rem;
    letter-spacing:0.06em; color:var(--muted); margin:0 0 1.4rem;
  }
  .stats {
    display:flex; flex-wrap:wrap; gap:0 2.25rem; padding:0.9rem 0 1rem;
    border-bottom:1px solid var(--rule);
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-variant-numeric:tabular-nums;
  }
  .stat b { display:block; font-weight:500; font-size:1.5rem; line-height:1.1; color:var(--ink); }
  .stat span {
    font-size:0.6875rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted);
  }
  h2 {
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.75rem; font-weight:500;
    letter-spacing:0.22em; text-transform:uppercase; color:var(--pitch);
    margin:3.75rem 0 1.5rem; padding-bottom:0.55rem; border-bottom:1px solid var(--rule);
  }
  h3 {
    font-family:"Instrument Serif",Georgia,serif; font-weight:400;
    font-size:clamp(1.6rem,4vw,2.1rem); line-height:1.14; letter-spacing:-0.01em;
    margin:2.9rem 0 0.9rem; text-wrap:balance;
  }
  p { margin:0 0 1.15rem; }
  .lead p:first-of-type { font-size:1.1875rem; line-height:1.55; }
  .lead p:first-of-type::first-letter {
    font-family:"Instrument Serif",Georgia,serif; font-size:3.6em; float:left;
    line-height:0.78; padding:0.06em 0.09em 0 0; color:var(--pitch);
  }
  blockquote {
    font-family:"Instrument Serif",Georgia,serif; font-size:clamp(1.22rem,3.1vw,1.5rem);
    line-height:1.34; margin:1.6rem 0 1.7rem; padding:0.1rem 0 0.1rem 1.35rem;
    border-left:2px solid var(--pitch); text-wrap:pretty;
  }
  p.dlg {
    background:var(--paper-sunk); border-left:2px solid var(--rule);
    margin:0 0 0.4rem; padding:0.7rem 1rem 0.7rem 1.1rem; font-size:1rem; color:var(--ink-soft);
  }
  p.dlg .who {
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.72rem;
    letter-spacing:0.06em; text-transform:uppercase; color:var(--pitch);
    display:block; margin-bottom:0.2rem;
  }
  #friction h2, #reply h2 { color:var(--whistle); }
  #friction blockquote, #reply blockquote { border-left-color:var(--whistle); }
  /* ---- a quote is a person speaking, so it carries their face ------ */
  figure.quote {
    display:grid; grid-template-columns:auto 1fr; grid-template-areas:"face quote" "face cite";
    gap:0 0.9rem; margin:1.5rem 0 1.6rem; align-items:start;
  }
  figure.quote blockquote { grid-area:quote; margin:0; padding:0 0 0 1.1rem; }
  figure.quote figcaption {
    grid-area:cite; padding-left:1.1rem; margin-top:0.35rem;
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.6875rem;
    letter-spacing:0.06em; text-transform:uppercase; color:var(--muted);
  }
  figure.quote figcaption .t { color:var(--pitch); margin-left:0.4rem; }
  .face {
    grid-area:face; width:40px; height:40px; border-radius:50%; object-fit:cover;
    margin-top:0.25rem; border:1px solid var(--rule); background:var(--paper-sunk);
  }
  .face-blank {
    display:grid; place-items:center; font-family:"IBM Plex Mono",ui-monospace,monospace;
    font-size:0.9rem; color:var(--muted);
  }
  /* ---- the answer the reader came for ----------------------------- */
  p.verdict {
    background:var(--paper-sunk); border-left:2px solid var(--pitch);
    padding:0.85rem 1.1rem; margin:1.5rem 0 2rem; font-size:1rem;
  }
  p.verdict span {
    display:block; font-family:"IBM Plex Mono",ui-monospace,monospace;
    font-size:0.625rem; letter-spacing:0.12em; text-transform:uppercase;
    color:var(--pitch); margin-bottom:0.25rem;
  }
  #friction p.verdict, #reply p.verdict { border-left-color:var(--whistle); }
  #friction p.verdict span, #reply p.verdict span { color:var(--whistle); }
  .overview { margin:2.25rem 0 0; padding:1.5rem 0 0; }
  .overview h2 { margin-top:0; }
  .takeaway {
    font-family:"Instrument Serif",Georgia,serif; font-size:clamp(1.35rem,3.6vw,1.75rem);
    line-height:1.28; margin:0 0 1.5rem; text-wrap:balance;
  }
  .contents { display:flex; flex-direction:column; gap:0.85rem; margin:0 0 1.5rem; padding:0; list-style:none; }
  .contents li {
    display:grid; grid-template-columns:4.5rem 1fr; gap:0 1rem; align-items:baseline;
    padding-bottom:0.85rem; border-bottom:1px solid var(--rule);
  }
  .contents li:last-child { border-bottom:0; padding-bottom:0; }
  .contents .tag {
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.625rem;
    letter-spacing:0.1em; text-transform:uppercase; padding-top:0.2rem;
  }
  .contents .tag.act { color:var(--whistle); }
  .contents .tag.read { color:var(--pitch); }
  .contents a { color:var(--ink); text-decoration:none; border-bottom:1px solid var(--rule); }
  .contents a:hover { border-bottom-color:var(--pitch); }
  .contents a:focus-visible { outline:2px solid var(--pitch); outline-offset:3px; }
  .urgent {
    background:var(--paper-sunk); border-left:2px solid var(--whistle);
    padding:0.85rem 1.1rem; font-size:1rem;
  }
  .urgent span {
    display:block; font-family:"IBM Plex Mono",ui-monospace,monospace;
    font-size:0.625rem; letter-spacing:0.12em; text-transform:uppercase;
    color:var(--whistle); margin-bottom:0.25rem;
  }
  footer {
    max-width:var(--measure); margin:4.5rem auto 0; padding-top:1.25rem;
    border-top:1px solid var(--rule); font-family:"IBM Plex Mono",ui-monospace,monospace;
    font-size:0.7rem; line-height:1.7; letter-spacing:0.04em; color:var(--muted);
  }
  footer b { color:var(--ink-soft); font-weight:500; }
  @media (max-width:600px) {
    body { padding:0 1.15rem 4rem; }
    .stats { gap:0 1.5rem; }
    .stat b { font-size:1.25rem; }
    .contents li { grid-template-columns:3.4rem 1fr; }
    .face { width:32px; height:32px; }
  }
  @media (prefers-reduced-motion:reduce) { *{animation:none!important;transition:none!important;} }
</style>`;

/**
 * Split the writer's output into the Slack teaser and the brief itself.
 *
 * Falls back gracefully: if the envelope is missing (a model that ignored the
 * format), the whole thing becomes the brief and the teaser is derived from its
 * first paragraph. Never lose an edition over a formatting miss.
 */
function splitTeaser(raw) {
    const m = raw.match(/===TEASER===([\s\S]*?)===END TEASER===([\s\S]*)/);
    if (!m) {
        const firstPara = raw.split('\n\n').find(p => p.trim().length > 80) || '';
        return { teaser: { lead: firstPara.replace(/\s+/g, ' ').slice(0, 300), lines: [], act: '' }, brief: raw };
    }
    const block = m[1].trim();
    const brief = m[2].trim();
    const lines = [];
    let lead = '', act = '';
    for (const l of block.split('\n').map(x => x.trim()).filter(Boolean)) {
        if (/^ACT:/i.test(l)) act = l.replace(/^ACT:\s*/i, '');
        // Strip "STORY 3: " style prefixes. They are the writer numbering its own
        // output, which is noise in a teaser: the reader wants the venue and the
        // thing that happened, not an index.
        else if (l.startsWith('- ')) lines.push(l.slice(2).replace(/^STORY\s*\d*\s*[:.]\s*/i, ''));
        else if (!lead) lead = l;
    }
    return { teaser: { lead, lines, act }, brief };
}

/** A quote with the speaker's face, name and the time they said it. */
function quoteWithFace(quote, who, time, avatars) {
    const src = avatars[who];
    const face = src
        ? `<img class="face" src="${src}" alt="" loading="lazy">`
        : `<span class="face face-blank" aria-hidden="true">${esc((who || '?').trim().charAt(0).toUpperCase())}</span>`;
    return `<figure class="quote">${face}<blockquote>${esc(quote.trim())}</blockquote>`
        + `<figcaption>${esc(who)}${time ? ` <span class="t">${esc(time)}</span>` : ''}</figcaption></figure>`;
}

const esc = (t) => String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Turn the plain-text brief into the published page.
 *
 * The writer hard-wraps prose at a fixed width, which is what makes the
 * structure recoverable: a HEADLINE is a deliberately short flush-left line, so
 * it sits well below the wrap width, while a wrapped body line runs right up to
 * it. Detecting headlines by "short" alone matched wrapped first-lines and
 * turned half the paragraphs into headings, so the margin below the measured
 * wrap width is the actual signal.
 */
function buildPage(brief, meta, teaser, avatars = {}) {
    const SECTIONS = new Set(['LEAD', 'HOW THE DAY RAN', 'STORIES', 'FRICTION', 'THE MOOD', 'WORTH A REPLY']);
    const SEC_ID = {
        LEAD: 'lead', 'HOW THE DAY RAN': 'dayrun', STORIES: 'stories', FRICTION: 'friction',
        'THE MOOD': 'mood', 'WORTH A REPLY': 'reply',
    };

    // Drop the writer's own title lines; the masthead carries them.
    const lines = brief.split('\n');
    let from = 0;
    while (from < lines.length && (!lines[from].trim() || /^[A-Z0-9 ,.'’·-]+$/.test(lines[from].trim()) && !SECTIONS.has(lines[from].trim()))) {
        if (SECTIONS.has(lines[from].trim())) break;
        from++;
        if (from > 4) break;
    }

    const blocks = [];
    let cur = [];
    // Set when a bare "STORY ONE" label was just consumed, so the first line of
    // the next block is known to be a headline whatever its casing.
    let pendingStory = false;
    const storyBlocks = new Set();
    for (const raw of lines.slice(from)) {
        if (!raw.trim()) { if (cur.length) { blocks.push(cur); cur = []; } continue; }
        // A bare "STORY ONE" label carries no information; the real headline is
        // the descriptive line under it. Fold the two so the label never becomes
        // the heading and the description never becomes body text. The writer
        // alternates between this shape and a single combined line, so both
        // have to work.
        if (/^STORY\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|\d+)\s*[:.]?\s*$/i.test(raw.trim())) {
            if (cur.length) { blocks.push(cur); }
            cur = [];
            pendingStory = true;      // the NEXT line is the real headline
            continue;
        }
        if (pendingStory && !cur.length) { storyBlocks.add(blocks.length); pendingStory = false; }
        cur.push(raw);
    }
    if (cur.length) blocks.push(cur);

    const flush = blocks.filter(b => !b[0].startsWith('  ')).flat();
    const wrapWidth = flush.reduce((m, l) => Math.max(m, l.trimEnd().length), 0) || 92;
    const headMax = Math.max(40, wrapWidth - 25);

    const out = [];
    const headlines = [];
    let openSec = null;

    for (const blk of blocks) {
        const first = blk[0].trim();
        if (SECTIONS.has(first)) {
            if (openSec) out.push('</section>');
            const id = SEC_ID[first] || first.toLowerCase().replace(/\s+/g, '-');
            out.push(`<section id="${id}"${id === 'lead' ? ' class="lead"' : ''}>`);
            out.push(`<h2>${esc(first)}</h2>`);
            openSec = id;
            continue;
        }
        if (blk[0].startsWith('  ')) {
            // Indented: quotes, one per line that starts at the 2-space indent.
            const chunks = [];
            let c = [];
            for (const L of blk) {
                const startsNew = L.startsWith('  "') || (L.startsWith('  ') && !L.startsWith('   '));
                if (startsNew && c.length) { chunks.push(c.join(' ').trim()); c = []; }
                c.push(L.trim());
            }
            if (c.length) chunks.push(c.join(' ').trim());
            for (const ch of chunks) {
                // "…quote…" (Name, 20:59) is the writer's own attribution form.
                // Pulling the speaker out lets the quote carry their face, which
                // is the difference between a wall of French and a conversation.
                const attr = ch.match(/^"([\s\S]+)"\s*[(\[]([^,\])]+?)(?:,\s*(\d{1,2}[:h]\d{2}))?[)\]]\s*$/);
                if (attr) {
                    out.push(quoteWithFace(attr[1], attr[2].trim(), attr[3] || '', avatars));
                    continue;
                }
                if (ch.startsWith('"')) { out.push(`<blockquote>${esc(ch)}</blockquote>`); continue; }
                const i = ch.indexOf(':');
                if (i > 0 && i < 40) {
                    const who = ch.slice(0, i).trim();
                    out.push(quoteWithFace(ch.slice(i + 1).trim().replace(/^"|"$/g, ''), who, '', avatars));
                } else out.push(`<blockquote>${esc(ch)}</blockquote>`);
            }
            continue;
        }
        // A story headline takes two shapes in practice. The model was asked for
        // a short line and sometimes writes one, but it also likes explicit
        // "STORY ONE: ..." banners in capitals. Both are headlines; a wrapped
        // body line is neither, which is what the wrap-width margin separates.
        // An informative headline is now LONGER than the old teasing kind
        // ("LE FIVE MARVILLE, 21:30: ROSTER HIT 13, COLLAPSED, PLAYED 10/10"),
        // so length cannot be the test. What identifies it is that the writer
        // sets it in full capitals on its own line. Allow accents and digits,
        // and allow it to run past the wrap width.
        const letters = first.replace(/[^A-Za-zÀ-ÿ]/g, '');
        const isBanner = storyBlocks.has(blocks.indexOf(blk))
            || (letters.length > 8
                && first === first.toUpperCase()
                && first.length <= 160
                && !first.startsWith('"'));
        const isShortLine = blk.length > 1 && first.length <= headMax
            && !/[.?!:,"]$/.test(first) && !first.includes('"');

        let start = 0;
        if (isBanner || isShortLine) {
            // Stories belong in their own section, not trailing inside LEAD.
            if (openSec === 'lead' && isBanner) {
                out.push('</section>');
                out.push('<section id="stories">');
                out.push('<h2>STORIES</h2>');
                openSec = 'stories';
            }
            const title = first.replace(/^STORY\s+[A-Z]+\s*[:.]\s*/i, '');
            out.push(`<h3>${esc(title)}</h3>`);
            headlines.push(title);
            start = 1;
        }
        const text = blk.slice(start).map(x => x.trim()).join(' ');
        if (!text) continue;
        // The writer closes each story with "HOW IT ENDED: ...". That is the
        // answer the reader came for, so it gets a box rather than a paragraph
        // buried at the foot of the column.
        const endMatch = text.match(/^HOW IT ENDED\s*[:.]\s*([\s\S]+)$/i);
        if (endMatch) {
            out.push(`<p class="verdict"><span>How it ended</span>${esc(endMatch[1])}</p>`);
            continue;
        }
        out.push(`<p>${esc(text)}</p>`);
    }
    if (openSec) out.push('</section>');

    // The overview: what is inside, so a reader picks rather than scrolls.
    // If the writer skipped the teaser's story lines, the headlines the page
    // just parsed are a better contents list than nothing at all.
    if (!teaser.lines.length && headlines.length) {
        teaser.lines = headlines.slice(0, 5);
    }
    const contents = teaser.lines.map((l, i) => {
        const urgent = teaser.act && i === 0 && /card|carton|bug|blocked|paiement|payment/i.test(l);
        const href = i < headlines.length ? '#stories' : '#friction';
        return `    <li><span class="tag ${urgent ? 'act' : 'read'}">${urgent ? 'ACT' : 'READ'}</span><span><a href="${href}">${esc(l)}</a></span></li>`;
    }).join('\n');

    const overview = `<section class="overview">
  <h2>What the day was about</h2>
  <p class="takeaway">${esc(teaser.lead)}</p>
${teaser.lines.length ? `  <ul class="contents">\n${contents}\n  </ul>` : ''}
${teaser.act && !/^nothing urgent/i.test(teaser.act) ? `  <p class="urgent"><span>Needs a human today</span>${esc(teaser.act)}</p>` : ''}
</section>`;

    const stat = (n, l) => `    <div class="stat"><b>${n}</b><span>${l}</span></div>`;
    return `${PAGE_HEAD}
<header class="masthead">
  <div class="sheet">
    <p class="eyebrow">Poteau &middot; what players actually said</p>
    <h1 class="title">The Poteau Daily</h1>
    <p class="dateline">${esc(meta.dayLabel)} &nbsp;/&nbsp; read from every game chat of the day</p>
  </div>
</header>

<div class="sheet">
  <div class="stats">
${stat(meta.messages.toLocaleString('en-US'), 'messages')}
${stat(meta.threads, 'games')}
${stat(meta.authors, 'players')}
${stat(meta.joins || '—', 'joined')}
${stat(meta.leaves || '—', 'left')}
  </div>
${overview}
</div>

<main class="sheet">
${out.join('\n')}
</main>

<footer>
  Written by <b>chat_brief.js</b> from the <b>messages</b> collection, Europe/Paris day boundary.<br>
  ${meta.check
    ? `<b>${meta.check.verified} of ${meta.check.checked}</b> quotes matched against the database automatically`
      + (meta.check.failures.length
        ? `. <b>${meta.check.failures.length} could not be matched</b> and may be paraphrased: ${meta.check.failures.map(f => esc(f)).join(' &middot; ')}`
        : ' &mdash; every quote is verbatim.')
    : 'Quotes are copied from the messages.'}<br>
  Published daily at 09:00.
</footer>`;
}

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

/**
 * Post to Slack and VERIFY it landed.
 *
 * `curl -s` exits 0 whether Slack answered "ok" or rejected the payload with
 * 400 invalid_blocks, so the old version could not tell success from failure:
 * a rejected edition marked itself published in the ledger and vanished. The
 * body is the only reliable signal, so it is read and anything other than "ok"
 * throws.
 */
function post(payload) {
    const body = JSON.stringify(payload);
    const out = execFileSync('curl', [
        '-sS', '--max-time', '30',
        '-w', '\n%{http_code}',
        '-X', 'POST', '-H', 'Content-type: application/json',
        '--data-binary', '@-', slackWebhookUrl(),
    ], { encoding: 'utf8', input: body });

    const lines = out.trim().split('\n');
    const code = lines.pop();
    const reply = lines.join('\n').trim();
    if (code !== '200' || reply !== 'ok') {
        throw new Error(`Slack rejected the post (HTTP ${code}): ${reply.slice(0, 200)}`);
    }
}

/**
 * Check every quote in the brief against the messages that actually exist.
 *
 * WHY. Tim's judgement on the first editions was "unreliable, some things were
 * false", and that is fatal for a paper: one invented quote makes a reader
 * distrust the true ones. A prompt instruction is not a guarantee, so the
 * quotes are verified against the corpus before anything is published.
 *
 * Matching is deliberately lenient about whitespace and quote characters
 * (the writer normalises curly apostrophes) but strict about the words. A
 * quote that cannot be found is reported, not silently dropped: knowing the
 * edition has three unverifiable quotes is the point.
 *
 * Returns { checked, verified, failures[] }.
 */
function verifyQuotes(brief, humanMessages) {
    const norm = (t) => String(t)
        .replace(/[’‘‚‛]/g, "'")
        .replace(/[“”„]/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const haystack = humanMessages.map(m => norm(m.text));
    const failures = [];
    let checked = 0;

    // Only the attributed, indented quotes: prose that merely mentions a phrase
    // is not a quotation and must not be held to this standard.
    for (const m of brief.matchAll(/^\s+"([^"\n]{8,})"/gm)) {
        const q = norm(m[1]);
        checked++;
        // A quote may legitimately be a fragment of a longer message.
        if (!haystack.some(h => h.includes(q))) failures.push(m[1].slice(0, 90));
    }
    return { checked, verified: checked - failures.length, failures };
}

/**
 * Fetch the quoted players' profile photos and inline them as data URIs.
 *
 * WHY DATA URIs. The artifact CSP blocks external hosts, so a remote
 * firebasestorage.googleapis.com URL renders as a broken image. The bytes have
 * to travel inside the page.
 *
 * Downscaled with sips first: the originals are ~20KB each and a page with
 * twenty of them would carry half a megabyte of avatar for no visual gain at
 * 40px. sips ships with macOS, and if it is missing the original is used rather
 * than failing.
 *
 * Only players the brief actually QUOTES are fetched, not all 346 authors.
 */
function fetchAvatars(names, photoUrls, wanted) {
    const out = {};
    const dir = fs.mkdtempSync('/tmp/poteau_av_');
    for (const name of wanted) {
        const uid = Object.keys(names).find(k => names[k] === name);
        const url = uid && photoUrls[uid];
        if (!url) continue;
        try {
            const raw = path.join(dir, `${uid}.jpg`);
            // curl rather than fetch(): this runs on Node 20 where fetch exists,
            // but curl gives a hard timeout and no unhandled-rejection surface.
            execFileSync('curl', ['-sS', '-m', '15', '-o', raw, url], { stdio: 'pipe' });
            if (!fs.existsSync(raw) || fs.statSync(raw).size === 0) continue;
            let file = raw;
            const small = path.join(dir, `${uid}_s.jpg`);
            try {
                execFileSync('sips', ['-Z', '96', raw, '--out', small], { stdio: 'pipe' });
                if (fs.existsSync(small) && fs.statSync(small).size > 0) file = small;
            } catch (_) { /* sips missing or refused the file; use the original */ }
            const b64 = fs.readFileSync(file).toString('base64');
            // A pathological original would bloat the page; skip rather than ship it.
            if (b64.length > 400 * 1024) continue;
            out[name] = `data:image/jpeg;base64,${b64}`;
        } catch (_) { /* one missing face must never cost the edition */ }
    }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    return out;
}

/**
 * Publish the page as an Artifact and return its URL.
 *
 * Uses `claude -p` with the Artifact tool, verified to work headlessly: the CLI
 * has no --artifact flag, so this is the only automated route. --allowedTools
 * keeps the run from wandering into the filesystem, and the prompt demands a
 * bare URL so parsing is not a guess.
 *
 * Returns null rather than throwing: an edition that cannot be published as a
 * page is still worth posting to Slack as text. Losing the whole brief because
 * the artifact step failed would be the worse outcome.
 */
function publishArtifact(html, dayKey, description) {
    // NOT os.tmpdir(): on macOS that is the per-user /var/folders/... dir, which
    // is outside the directories a headless claude -p may read, so the publish
    // is refused with "reading the file was denied". /tmp is allowed.
    const file = path.join('/tmp', `poteau_daily_${dayKey}.html`);
    fs.writeFileSync(file, html, 'utf8');
    try {
        const res = spawnSync('claude', [
            '-p',
            `Publish the file ${file} as an artifact using the Artifact tool. `
            + `Use favicon 📰 and this description: "${description.replace(/"/g, "'")}". `
            + `Then output ONLY the resulting artifact URL on one line, nothing else.`,
            '--allowedTools', 'Artifact',
        ], { encoding: 'utf8', input: '', maxBuffer: 32 * 1024 * 1024, timeout: 10 * 60 * 1000 });
        const url = ((res.stdout || '').match(/https:\/\/claude\.ai\/code\/artifact\/[a-f0-9-]+/) || [])[0];
        if (!url) {
            console.error('[chat_brief] artifact publish returned no URL:',
                ((res.stdout || res.stderr || '').trim().slice(0, 200)));
            return null;
        }
        return url;
    } catch (e) {
        console.error('[chat_brief] artifact publish failed:', e.message.slice(0, 120));
        return null;
    } finally {
        try { fs.unlinkSync(file); } catch (_) { /* best effort */ }
    }
}

/**
 * Post the TEASER to Slack, with a button through to the full edition.
 *
 * Deliberately not the whole brief. A 14,000 character editorial pasted into a
 * channel as six stacked code blocks is unreadable on a phone and buries its own
 * best story; the page is the publication and Slack is the front page of it. So
 * this carries the day's thesis, up to five story lines, the one thing needing a
 * human, and a link. Nothing else.
 */
function postBrief({ teaser, meta, url }) {
    const blocks = [
        {
            type: 'header',
            text: { type: 'plain_text', text: `The Poteau Daily · ${meta.dayLabel}`, emoji: true },
        },
        {
            type: 'context',
            elements: [{
                type: 'mrkdwn',
                text: `${meta.messages.toLocaleString('en-US')} messages  ·  ${meta.threads} games  ·  ${meta.authors} players`
                    + (meta.check
                        ? `  ·  ${meta.check.verified}/${meta.check.checked} quotes verified`
                          + (meta.check.failures.length ? ' :warning:' : '')
                        : ''),
            }],
        },
    ];

    if (teaser.lead) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${teaser.lead}*` } });
    }
    if (teaser.lines.length) {
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: teaser.lines.map(l => `•  ${l}`).join('\n') },
        });
    }
    if (teaser.act && !/^nothing urgent/i.test(teaser.act)) {
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `:eyes:  *Needs a human today*\n${teaser.act}` },
        });
    }

    if (url) {
        blocks.push({
            type: 'actions',
            elements: [{
                type: 'button',
                text: { type: 'plain_text', text: 'Read the full edition', emoji: true },
                url,
                style: 'primary',
            }],
        });
    } else {
        // No page, so say so rather than leaving a teaser that goes nowhere.
        blocks.push({
            type: 'context',
            elements: [{ type: 'mrkdwn', text: '_The full edition could not be published today. Run `node scripts/chat_brief.js --date=' + meta.dayKey + '` on the Mac._' }],
        });
    }
    post({ blocks });
}

// ------------------------------------------------------------ catch-up state

/**
 * WHY A LEDGER EXISTS.
 *
 * "If the Mac is off for 10 days I want 10 briefs waiting." Neither launchd nor
 * Cloud Scheduler can deliver that: a missed calendar slot fires ONCE on the
 * next opportunity, never ten times. So the schedule cannot be the record of
 * what has been published.
 *
 * Instead each published day is recorded in Firestore, and every run asks
 * "which days are missing?" rather than "what is yesterday?". Ten days of
 * silence then produces ten briefs, oldest first, because the gap is computed
 * from the ledger and not from the clock.
 */
const STATE_DOC = 'internal_state/chat_brief';
// Do not mine history forever on a fresh install: the ledger starts the day the
// feature shipped. Without this the first run would try to write months of
// briefs and burn a fortune in tokens.
const EPOCH = '2026-08-17';

async function publishedDays() {
    const snap = await db.doc(STATE_DOC).get();
    return new Set((snap.exists && snap.data().published_days) || []);
}

async function markPublished(dayKey) {
    await db.doc(STATE_DOC).set({
        published_days: admin.firestore.FieldValue.arrayUnion(dayKey),
        last_run_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Every day that should have a brief and does not, oldest first.
 *
 * Excludes today: the day is not over, so briefing it would produce a partial
 * edition that never gets corrected.
 */
async function missingDays(maxDays) {
    const done = await publishedDays();
    const yesterday = DateTime.now().setZone(TZ).minus({ days: 1 }).startOf('day');
    let cursor = DateTime.fromISO(EPOCH, { zone: TZ }).startOf('day');
    const out = [];
    while (cursor <= yesterday) {
        const key = cursor.toFormat('yyyy-MM-dd');
        if (!done.has(key)) out.push(key);
        cursor = cursor.plus({ days: 1 });
    }
    return out.slice(0, maxDays);
}

// --------------------------------------------------------------------- main

/** Produce and publish one day. Returns true if a brief was posted. */
async function runOneDay(targetDay) {
    setDay(targetDay);
    const dayKey = day.toFormat('yyyy-MM-dd');
    const data = await fetchDay();

    if (data.human.length === 0) {
        // A silent day is still a PUBLISHED day: mark it, or every future run
        // retries it forever and the catch-up never converges.
        const msg = `No game chat at all on ${day.toFormat('cccc d LLLL')}. Either a genuinely silent day or the message pipeline is broken, worth checking, because a zero here is unusual.`;
        console.log(msg);
        if (SLACK && !DRY) {
            post({ blocks: [
                { type: 'header', text: { type: 'plain_text', text: `The Poteau Daily · ${day.toFormat('cccc d LLLL')}`, emoji: true } },
                { type: 'section', text: { type: 'mrkdwn', text: msg } }] });
            await markPublished(dayKey);
        }
        return false;
    }

    const [names, photoUrls, gameDocs] = await Promise.all([
        resolveAll('users', data.authorIds, u => (u.display_name || '').trim() || 'unknown'),
        resolveAll('users', data.authorIds, u => (u.photo_url || '').trim()),
        resolveAll('games', data.gameIds, g => {
            // Dedupe: a +1 is the same user ref repeated, so the raw length is
            // the SPOTS taken while the deduped set is the PEOPLE present. Both
            // matter: "10 of 10 spots, 6 actual people" is the real story of a
            // game that looks full.
            const refs = (g.attendees || []).filter(r => r && r.parent && r.parent.id === 'users');
            return {
                centre: g.centre, sport: g.sport, status: g.status, max: g.max_players,
                date: g.date ? g.date.toDate() : null,
                price: g.price, duration: g.duration,
                spots: refs.length,
                players: new Set(refs.map(r => r.id)).size,
                // The ending, which chat alone can never tell you.
                noShows: (g.no_show_players || []).length,
                lates: (g.late_players || []).length,
                praised: (g.good_players || []).length,
                rude: (g.rude_players || []).length,
            };
        }),
    ]);

    const { corpus, threads, routineTotal } = buildCorpus(data, names, gameDocs);
    if (CORPUS_ONLY) { console.log(corpus); return false; }

    const meta = {
        messages: data.human.length,
        threads,
        authors: data.authorIds.size,
        routinePct: Math.round((routineTotal / data.human.length) * 100),
    };

    console.error(`[chat_brief] ${dayKey}: ${meta.messages} messages, ${meta.threads} games, ${corpus.length} chars -> claude`);
    const raw = writeBriefWithRetry(corpus);
    const { teaser, brief } = splitTeaser(raw);

    meta.dayKey = dayKey;
    meta.dayLabel = day.toFormat('cccc d LLLL yyyy');
    // Roster facts for the stats strip, from the log lines rather than the chat.
    meta.joins = Object.entries(data.logs)
        .filter(([k]) => /rejoint/i.test(k)).reduce((n, [, v]) => n + v, 0);
    meta.leaves = Object.entries(data.logs)
        .filter(([k]) => /quitt/i.test(k)).reduce((n, [, v]) => n + v, 0);

    console.log(brief);
    if (RAW) return false;

    if (DRY) {
        console.log('\n--- teaser ---');
        console.log(JSON.stringify(teaser, null, 1));
        console.log('\n--- dry: not publishing, not posting, not marking ---');
        return false;
    }

    if (SLACK) {
        // Only the people the brief quotes, not all 346 authors: the page needs
        // twenty faces, not a directory.
        // Harvest speakers from the attributed form "…" (Name, 20:59) wherever it
        // appears, plus the "Name at 14:18:" form the writer also uses inline.
        const quoted = [...new Set([
            ...[...brief.matchAll(/"[^"\n]{3,}"\s*\(([^,)]{2,40}?)\s*,\s*\d{1,2}[:h]\d{2}\)/g)].map(m => m[1]),
            ...[...brief.matchAll(/^([A-Z][^\n:]{1,38}?)\s+(?:at|à)\s+\d{1,2}[:h]\d{2}\s*:/gm)].map(m => m[1]),
        ].map(x => x.trim()))].filter(n => n.length > 1 && n.length < 40).slice(0, 30);
        const avatars = quoted.length ? fetchAvatars(names, photoUrls, quoted) : {};
        console.error(`[chat_brief] ${dayKey}: ${Object.keys(avatars).length}/${quoted.length} avatars`);
        // Verify before publishing. A failure does not block the edition, but it
        // is printed and carried onto the page, because an unnoticed false quote
        // is what destroys trust in the whole thing.
        const check = verifyQuotes(brief, data.human);
        meta.check = check;
        console.error(`[chat_brief] ${dayKey}: quotes ${check.verified}/${check.checked} verified`
            + (check.failures.length ? ` — UNVERIFIED: ${check.failures.join(' | ').slice(0, 300)}` : ''));

        const html = buildPage(brief, meta, teaser, avatars);
        const url = publishArtifact(html, dayKey, teaser.lead || `The Poteau Daily for ${meta.dayLabel}`);
        postBrief({ teaser, meta, url });
        // Mark ONLY after a successful post. If Slack throws, the day stays
        // missing and the next run retries it, which is the behaviour you want
        // from a ledger.
        await markPublished(dayKey);
        if (url) console.error(`[chat_brief] ${dayKey} published: ${url}`);
    }
    return true;
}

(async () => {
    if (CATCHUP) {
        const days = await missingDays(MAX_DAYS);
        if (days.length === 0) {
            console.log('Nothing missing. Every day through yesterday has a brief.');
            process.exit(0);
        }
        console.error(`[chat_brief] ${days.length} day(s) missing: ${days.join(', ')}`);
        let posted = 0;
        for (const key of days) {
            try {
                const ok = await runOneDay(DateTime.fromISO(key, { zone: TZ }).startOf('day'));
                if (ok) posted++;
            } catch (e) {
                // One bad day must not block the rest of the backlog. It stays
                // unmarked, so tomorrow's run picks it up again.
                console.error(`[chat_brief] ${key} FAILED: ${e.message.slice(0, 120)}`);
            }
        }
        console.error(`[chat_brief] published ${posted} of ${days.length}`);
        process.exit(0);
    }

    await runOneDay(day);
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
