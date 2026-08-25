/**
 * The Poteau Daily — situations from yesterday's chat that are worth a look.
 *
 * WHAT THIS IS, AND WHAT IT REPLACED. This started as a newspaper: a lead, two
 * or three stories, a mood, published as an artifact with a teaser in Slack.
 * Tim's verdict after a week of editions was that the stories were not worth
 * reading — "games get filled, people apply, more people apply" — and that the
 * only section he actually used was NEEDS A HUMAN TODAY. So the paper is gone
 * and that section is now the whole product.
 *
 * The output is a list of situations, in Slack, with enough context to act on
 * without opening anything else. No artifact, no teaser, no link. Nothing here
 * is mandatory: it is a list Tim can read if he has ten minutes, and skip
 * entirely if he does not. That is a deliberate design constraint, not a
 * caveat — a list that demands attention every day stops being read.
 *
 * TWO HOSTS, ONE LOGIC. Same pattern as the health report, and for the same
 * reason. The Mac host runs the CLI and reads ~/.poteau/*.env; the cloud host
 * calls the Anthropic API and reads env vars. Everything that decides WHAT
 * counts as a signal lives here, so the two cannot drift into disagreeing about
 * what deserves Tim's attention.
 *
 *   scripts/daily_signals_host.js            the Mac
 *   cloud-functions/gen2/dailySignalsHost.js the cloud
 *
 * WHY IT MOVED TO THE CLOUD. The brief ran from launchd on Tim's Mac, so a
 * machine that was asleep or off at 09:00 simply produced no edition, and a
 * missing edition looks exactly like a quiet day. Same failure the health
 * report had, same fix: do not depend on the machine.
 *
 * Usage (Mac):
 *   node daily_signals.js                    # yesterday, print only
 *   node daily_signals.js --slack            # post to #newspaper
 *   node daily_signals.js --date=2026-08-24  # a specific day
 *   node daily_signals.js --corpus           # dump the LLM input, call nothing
 *   node daily_signals.js --dry              # build everything, post nothing
 */

const { DateTime } = require('luxon');

const TZ = 'Europe/Paris';

// The host is injected. The Mac host is the default so `node daily_signals.js`
// works with no ceremony; the Cloud Function calls setHost() before building.
let host = null;
function setHost(h) { host = h; }
function getHost() {
    if (!host) host = require('./daily_signals_host.js');
    return host;
}

// ------------------------------------------------------------ routine buckets

/**
 * Messages that are pure coordination.
 *
 * Matching one of these does NOT hide the message from the model, it only marks
 * it as routine so attention goes to what is actually novel. Carried over
 * unchanged from the newspaper version, where it was tuned against real days.
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
 * demande si c'est possible de faire 1h30 avant de m'inscrire..." opens with the
 * same word and is the most substantive message in its thread. Matching on the
 * prefix alone silently demoted exactly the messages worth surfacing.
 */
const ROUTINE_MAX_CHARS = 60;

function routineTag(text) {
    if (text.length > ROUTINE_MAX_CHARS) return null;
    for (const [re, tag] of ROUTINE) if (re.test(text)) return tag;
    return null;
}

// -------------------------------------------------------------------- fetch

/**
 * Every message written on the target day, split into human chat and log lines.
 *
 * `author_name` is NEVER set on a human message — only on log lines — so names
 * must come from resolving author_id. Reading author_name here yields a corpus
 * of anonymous messages and the model then invents attributions.
 */
async function fetchDay(db, START, END) {
    const snap = await db.collection('messages')
        .where('created', '>=', START).where('created', '<', END).get();

    const human = [];
    const logs = {};
    const roster = {};
    const gameIds = new Set();
    const authorIds = new Set();
    let teamMessages = 0;

    snap.forEach(d => {
        const m = d.data();
        const type = m.type || '—';
        const text = (m.text || '').trim();

        if (type === 'log') {
            // Log text is "<name> a rejoint le match." — strip the name so the
            // kinds collapse into countable buckets.
            const kind = text.replace(/^\S+(\s\S+)?\s+(?=a\s)/, '').slice(0, 48) || '(empty)';
            logs[kind] = (logs[kind] || 0) + 1;

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
async function resolveAll(db, collection, ids, pick) {
    const out = {};
    const list = [...ids];
    for (let i = 0; i < list.length; i += 250) {
        const chunk = list.slice(i, i + 250);
        const docs = await db.getAll(...chunk.map(id => db.doc(`${collection}/${id}`)));
        docs.forEach(d => { if (d.exists) out[d.id] = pick(d.data()); });
    }
    return out;
}

// ------------------------------------------------------------------ geography

/**
 * Which of yesterday's games happened somewhere we barely operate.
 *
 * WHY THIS IS HERE. Tim's one addition to "things worth looking at": a game in
 * a place where we rarely have games is interesting on its own, even when the
 * chat there was silent. It is either an ambassador doing something, an organic
 * pocket forming, or a test account, and none of those ever appears in a
 * message.
 *
 * MEASURED BY AREA, NOT BY VENUE. The first version keyed on place_id and was
 * wrong in a way worth recording: it reported a new municipal gym in Courbevoie
 * as a NEW place, when Courbevoie is inside the Paris cluster where most of our
 * games happen. A venue we have never used is an ordinary event; a REGION we
 * barely serve is the interesting one. So the key is a coarse geographic cell,
 * and every pitch in greater Paris collapses into the same handful of cells.
 *
 * The cell is a ~25km square from rounded lat/lng. That is deliberately crude:
 * it needs to separate Paris from Bordeaux, not one arrondissement from the
 * next, and a crude grid has no clustering parameters to tune or get wrong. A
 * game near a cell boundary can land beside its neighbours rather than with
 * them, which at this threshold costs at most one extra line on one day.
 *
 * The baseline is the 90 days BEFORE the target day, so the comparison is
 * against our normal footprint rather than against the day itself:
 *
 *   NEW    no game in that area in 90 days
 *   RARE   1 to 5 games in 90 days
 *
 * COST. One indexed range query over `games`, once per run.
 */
const AREA_DEGREES = 0.25;              // ~25km at these latitudes
const AREA_RARE_MAX = 5;                // 90-day count at or below this is rare

function areaKey(loc) {
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
    const r = (v) => (Math.round(v / AREA_DEGREES) * AREA_DEGREES).toFixed(2);
    return `${r(loc.latitude)},${r(loc.longitude)}`;
}

/**
 * The town from a Google-formatted address.
 *
 * Addresses here come in two shapes: "2 Rue Louis Armand, Paris" and the full
 * "8 Rue Georges Nègrevergne, 33700 Mérignac, France". Taking the last
 * non-country component and stripping a postcode handles both. Only used as a
 * label, so a miss costs a slightly worse line, never a wrong signal.
 */
function townFrom(address) {
    const parts = String(address || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return '';
    const tail = parts[parts.length - 1];
    const pick = /^(France|Belgique|Belgium|Suisse|Switzerland|Espagne|Spain|Italie|Italy|USA|United States)$/i
        .test(tail) && parts.length > 1 ? parts[parts.length - 2] : tail;
    return pick.replace(/^\d{4,5}\s+/, '').trim();
}

async function venueBaseline(db, day, games) {
    const since = day.minus({ days: 90 }).toJSDate();
    const until = day.toJSDate();

    const counts = new Map();     // area key -> games played in the window
    try {
        const snap = await db.collection('games')
            .where('date', '>=', since).where('date', '<', until).get();
        snap.forEach(d => {
            const g = d.data();
            // Only games that actually happened set the baseline. A cancelled
            // game does not prove we have a presence somewhere.
            if (g.status !== 'played') return;
            const key = areaKey(g.location);
            if (!key) return;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
    } catch (e) {
        // A failed baseline must not take the whole run down: the rest of the
        // signals are still worth posting. Returning null makes buildCorpus omit
        // the section entirely rather than claim every area is new, which is
        // what an empty Map would do.
        console.error(`[daily_signals] area baseline failed: ${e.message}`);
        return null;
    }

    const byArea = new Map();
    for (const [gid, g] of Object.entries(games)) {
        const key = areaKey(g.location);
        if (!key) continue;
        const prior = counts.get(key) || 0;
        if (prior > AREA_RARE_MAX) continue;        // a region we serve normally

        if (!byArea.has(key)) {
            byArea.set(key, {
                key,
                town: townFrom(g.address),
                venues: new Set(),
                prior,
                kind: prior === 0 ? 'NEW' : 'RARE',
                games: [],
            });
        }
        const entry = byArea.get(key);
        entry.games.push(gid);
        if (g.centre) entry.venues.add(g.centre);
        if (!entry.town) entry.town = townFrom(g.address);
    }

    const unusual = [...byArea.values()].map(e => ({ ...e, venues: [...e.venues] }));
    // NEW before RARE, then by how many games ran there yesterday.
    unusual.sort((a, b) => (a.prior - b.prior) || (b.games.length - a.games.length));
    return unusual;
}

// ------------------------------------------------------------------- corpus

/**
 * Assemble the text handed to the model.
 *
 * Ordered by message count: a 40-message argument is far more likely to contain
 * a real situation than a lone "ok". Single-message games are kept in a tail
 * section rather than dropped, because a complaint can hide in exactly one line.
 */
function buildCorpus(day, data, names, games, facts, players, venues) {
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
    L.push('ROSTER EVENTS (system log lines — facts, not chat):');
    Object.entries(data.logs).sort((a, b) => b[1] - a[1]).slice(0, 14)
        .forEach(([k, n]) => L.push(`  ${n} x ${k}`));
    L.push('');
    L.push('ROUTINE COORDINATION, already counted mechanically. These are never');
    L.push('a situation on their own:');
    Object.entries(routineCounts).sort((a, b) => b[1] - a[1])
        .forEach(([k, n]) => L.push(`  ${n} x ${k}`));
    L.push(`  (${routineTotal} of ${data.human.length} messages are routine)`);

    if (facts) {
        L.push('');
        L.push('DAY FACTS (counted from the database, not the chat):');
        L.push(`  ${facts.played} games PLAYED, ${facts.cancelled} cancelled`);
        L.push(`  ${facts.filled} of the played games filled every spot`);
        L.push(`  ${facts.praise} pieces of praise left by players for each other`);
        L.push(`  ${facts.spots} spots taken, of which ${facts.plusOnes} were +1 guests`);
        if (facts.topCentres.length) {
            L.push(`  busiest venues: ${facts.topCentres.map(([c, n]) => `${c} (${n} games)`).join(', ')}`);
        }
    }

    // Geography. Only present when the baseline query succeeded — an omitted
    // section is honest, an empty one would read as "nothing unusual".
    if (venues) {
        L.push('');
        L.push('UNUSUAL AREAS (measured against the 90 days before this one).');
        L.push('Poteau is dense in Paris and a few French cities. This lists AREAS,');
        L.push('roughly 25km across, where we barely operate, so a new pitch inside');
        L.push('greater Paris does NOT appear here but a game in another region or');
        L.push('country does. NEW means no game in that area in 90 days; RARE means');
        L.push(`up to ${AREA_RARE_MAX}. A game here is worth a line even if its chat was silent.`);
        if (venues.length === 0) {
            L.push('  Nothing unusual: every game yesterday was in a region we serve regularly.');
        } else {
            for (const v of venues) {
                L.push(`  ${v.kind}: ${v.town || 'unknown town'}`
                    + (v.venues.length ? ` — ${v.venues.join(', ')}` : '')
                    + ` (${v.prior} games there in the previous 90 days,`
                    + ` ${v.games.length} yesterday)`);
            }
        }
    }

    if (players && Object.keys(players).length) {
        L.push('');
        L.push('PLAYER CONTEXT (for anyone you name):');
        for (const [name, p] of Object.entries(players)) {
            L.push(`  ${name}: joined ${p.joined}`
                + (p.daysOld !== null ? ` (${p.daysOld} days ago)` : '')
                + (p.games === null ? ', game count unavailable' : `, has played ${p.games} games`)
                + (p.gold ? ', Gold member' : ''));
        }
    }

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
        L.push(`    GAME ID: ${t.gid}`);

        // The ending, stated as fact. Without it the model can only report that
        // players argued; it cannot say whether they played, which is usually
        // the difference between a situation and a non-event.
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

        const moves = (rosterByGame[t.gid] || []).sort((a, b) => a.at - b.at);
        if (moves.length) {
            let n = 0;
            const marks = [];
            for (const mv of moves) {
                if (mv.cancelled) { marks.push(`${DateTime.fromJSDate(mv.at).setZone(TZ).toFormat('HH:mm')} CANCELLED`); continue; }
                n += mv.delta;
                marks.push(`${DateTime.fromJSDate(mv.at).setZone(TZ).toFormat('HH:mm')} ${mv.delta > 0 ? '+' : ''}${mv.delta} (${n})`);
            }
            L.push(`    ROSTER MOVED: ${marks.join('  ')}`);
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
 * The instruction.
 *
 * WHAT CHANGED FROM THE NEWSPAPER. The old prompt asked for a lead, stories and
 * a mood, and got exactly that: readable prose about games filling up. This one
 * asks for a triage list and nothing else. The framing that does the work is
 * "most days have two or three things worth reading and the rest is noise" —
 * without it the model treats every argument as a story, because it is trying
 * to be useful and a long answer feels more useful than a short one.
 *
 * The output is JSON, not prose. The old version parsed headlines out of a text
 * brief by measuring line length, which broke whenever the model changed its
 * formatting between runs. A schema cannot drift like that, and it lets Slack
 * render each signal as its own block.
 */
const PROMPT = `You are triaging yesterday's chat from Poteau, a French app where amateur
players organise football and padel games at sports centres.

Your reader is Tim, who runs Poteau. He has maybe ten minutes and no obligation
to act on any of this. You are making him a short list of situations worth a
look, and NOTHING else. There is no newspaper, no lead paragraph, no summary of
how the day went, no mood. A list.

WHAT COUNTS AS WORTH A LOOK

Something a person would want to know about. In rough order of value:

  A user is unhappy in a way that needs a reply. Someone who paid and did not
  play, was treated badly, or asked for help and got none.

  Something good worth acknowledging. Someone gave up their spot, drove a
  teammate, lent equipment, welcomed a newcomer, calmed an argument down, or
  ran a game well when it was falling apart. These are as valuable as the
  complaints and are routinely missed.

  A product problem visible in the chat. People confused by the same thing,
  working around something broken, or asking a question the app should have
  answered.

  A centre behaving unusually, well or badly.

  A game in an unusual place. If the UNUSUAL PLACES block lists anything, each
  entry is a candidate on its own, even when the chat there was silent or
  empty. Say where it is and what happened. A single game in a new city is
  worth one line.

  Anything genuinely surprising that does not fit the categories above.

WHAT DOES NOT COUNT

  Games filling up. People joining and leaving. Someone asking the booking
  name. Routine grumbling that resolved itself. A late player who apologised.
  Ordinary coordination. These are the overwhelming majority of the chat and
  they are why this list exists: to find the few things that are not this.

CALIBRATION. A normal day has three to eight items. Some days have one. If a
day genuinely has nothing, return an empty list, which is a valid and useful
answer. Never pad the list to look thorough, and never split one situation into
two items to reach a number.

Rank them. The first item should be the one you would tell him about if he only
read one line.

OUTPUT FORMAT

Return ONLY a JSON object, no prose before or after it, no markdown fence:

{
  "signals": [
    {
      "kind": "complaint" | "good" | "product" | "centre" | "place" | "other",
      "urgency": "reply" | "worth_knowing",
      "headline": "One line, under 80 characters. Say the thing, not a tease.",
      "where": "Venue, kickoff time. Empty string if it does not apply.",
      "game_id": "the GAME ID exactly as given, or empty string",
      "what": "2 to 4 sentences. What happened and how it ended. Concrete.",
      "quote": "One message copied EXACTLY, or empty string.",
      "quote_who": "Who said it and when, as: Name, 20:59",
      "why": "One sentence: why this is worth his attention.",
      "do": "One short line: what you would actually do. Or empty string."
    }
  ]
}

"urgency": use "reply" ONLY when a real person is waiting on an answer or
something is actively going wrong. Everything else is "worth_knowing", including
the good news. Most items are "worth_knowing".

RULES

- Every quote must be copied CHARACTER FOR CHARACTER from the messages below.
  Do not tidy spelling, fix grammar, translate, or merge two messages. If you
  cannot copy it exactly, use an empty string. Quotes are checked against the
  database automatically.
- Every clock time must be one printed next to that message. Never estimate.
- Never state a number you were not given.
- Do not describe what a player "felt", "assumed" or "intended". You have their
  words, not their mind.
- If two readings are possible, give the one the text supports and say the rest
  is unclear.
- Write in English. Keep French quotes in French, untranslated.
- Say "game", never "match".
- No em dashes anywhere.

THE MESSAGES:

`;

/**
 * Parse the model's JSON, tolerating the ways it wraps it.
 *
 * The instruction says "no markdown fence" and it is mostly obeyed, but a
 * schema this size occasionally comes back fenced or with a sentence in front.
 * Throwing on that would lose a whole day's list over punctuation, so the
 * object is extracted rather than assumed to be the entire response.
 */
function parseSignals(raw) {
    const text = String(raw || '').trim();
    if (!text) throw new Error('the writer returned nothing');

    // Truncation is checked on the RAW text, before any extraction.
    //
    // A response cut off mid-object has no closing brace at all, so
    // `lastIndexOf('}')` returns -1 and the slice below silently becomes the
    // empty string — which then fails to parse as an ordinary malformed
    // response and gets retried twice at full cost. That is exactly what the
    // first cloud deploy did. Detect it here, where the evidence still exists.
    const opens = text.indexOf('{');
    if (opens !== -1 && text.lastIndexOf('}') < opens) {
        throw new Error(
            `the writer's JSON was cut off at the output ceiling `
            + `(${text.length} chars, no closing brace). Not transient: `
            + `raise the output budget. Starts: ${text.slice(0, 120)}`);
    }

    // A fenced block first, then the outermost brace pair.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1]
        : text.slice(opens, text.lastIndexOf('}') + 1);

    let parsed;
    try {
        parsed = JSON.parse(candidate);
    } catch (e) {
        throw new Error(`the writer did not return valid JSON: ${text.slice(0, 200)}`);
    }
    if (!parsed || !Array.isArray(parsed.signals)) {
        throw new Error(`no signals array in the response: ${text.slice(0, 200)}`);
    }

    const KINDS = new Set(['complaint', 'good', 'product', 'centre', 'place', 'other']);
    return parsed.signals
        .filter(s => s && typeof s === 'object' && (s.headline || '').trim())
        .map(s => ({
            kind: KINDS.has(s.kind) ? s.kind : 'other',
            urgency: s.urgency === 'reply' ? 'reply' : 'worth_knowing',
            headline: String(s.headline || '').trim(),
            where: String(s.where || '').trim(),
            game_id: String(s.game_id || '').trim(),
            what: String(s.what || '').trim(),
            quote: String(s.quote || '').trim(),
            quote_who: String(s.quote_who || '').trim(),
            why: String(s.why || '').trim(),
            do: String(s.do || '').trim(),
        }));
}

/**
 * Ask the writer, retrying transient API failures.
 *
 * A 529 on the 09:00 run would otherwise cost the whole day, and the corpus is
 * assembled once. Backoff is generous because nothing is waiting on this.
 */
async function writeSignalsWithRetry(corpus, attempts = 3) {
    let last;
    for (let i = 1; i <= attempts; i++) {
        try {
            const raw = await getHost().askModel(PROMPT + corpus);
            return parseSignals(raw);
        } catch (e) {
            last = e;
            // A truncated response is NOT transient and must never be retried:
            // the same prompt hits the same output ceiling every time. The first
            // cloud deploy retried it twice at full cost before failing, because
            // "did not return valid JSON" matched the transient pattern below
            // and cut-off JSON is, technically, invalid JSON. The host names
            // this case explicitly so it can be excluded here.
            const permanent = /output ceiling|cut off/i.test(e.message);
            const transient = !permanent
                && /529|overloaded|rate.?limit|timeout|ECONN|503|502|did not return valid JSON/i
                    .test(e.message);
            if (!transient || i === attempts) break;
            const wait = i * 60;
            console.error(`[daily_signals] attempt ${i} failed (${e.message.slice(0, 90)}), retrying in ${wait}s`);
            await new Promise(r => setTimeout(r, wait * 1000));
        }
    }
    throw last;
}

// -------------------------------------------------------------------- checks

/**
 * Check every quote against the messages that actually exist.
 *
 * WHY. Tim's judgement on the early editions was "unreliable, some things were
 * false", and one invented quote makes a reader distrust the true ones. A
 * prompt instruction is not a guarantee.
 *
 * Unlike the newspaper, which printed failures on the page, a signal whose
 * quote cannot be verified has the quote REMOVED and the rest kept. The
 * situation is usually real even when the wording drifted, and a signal without
 * a quote is still actionable; a fabricated quote is not.
 */
function verifyQuotes(signals, humanMessages) {
    const norm = (t) => String(t)
        .replace(/[""'']/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const haystack = humanMessages.map(m => norm(m.text));

    let checked = 0, verified = 0;
    const failures = [];
    for (const s of signals) {
        if (!s.quote) continue;
        checked++;
        const q = norm(s.quote);
        if (haystack.some(h => h.includes(q))) { verified++; continue; }
        failures.push(s.quote.slice(0, 60));
        // Drop the quote, keep the signal.
        s.quote = '';
        s.quote_who = '';
        s.quoteDropped = true;
    }
    return { checked, verified, failures };
}

// ------------------------------------------------------------------ day facts

/**
 * The day's counted facts.
 *
 * Chat is a complaints channel by nature: people type when something is wrong
 * and say nothing when a game simply works. These numbers are the corrective,
 * and none of them appear in a message.
 */
function dayFacts(games) {
    const byCentre = {};
    let played = 0, cancelled = 0, praise = 0, filled = 0, plusOnes = 0, spots = 0;

    for (const g of Object.values(games)) {
        if (g.status === 'played') {
            played++;
            byCentre[g.centre] = (byCentre[g.centre] || 0) + 1;
            praise += g.praised || 0;
            if (g.max && g.spots >= g.max) filled++;
            spots += g.spots || 0;
            plusOnes += Math.max(0, (g.spots || 0) - (g.players || 0));
        } else if (g.status === 'canceled' || g.status === 'hidden') {
            cancelled++;
        }
    }
    return {
        played, cancelled, filled, praise, spots, plusOnes,
        topCentres: Object.entries(byCentre).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
}

/**
 * Who is this player? Signup date and how many games they have actually played.
 *
 * A first-timer complaining and a 200-game regular complaining are different
 * events, and the chat cannot tell them apart.
 */
async function playerContext(db, names, wanted) {
    const out = {};
    const uids = wanted
        .map(n => Object.keys(names).find(k => names[k] === n))
        .filter(Boolean);
    for (let i = 0; i < uids.length; i += 200) {
        const docs = await db.getAll(...uids.slice(i, i + 200).map(u => db.doc(`users/${u}`)));
        for (const d of docs) {
            if (!d.exists) continue;
            const u = d.data();
            const created = u.created_time ? u.created_time.toDate() : null;
            out[(u.display_name || '').trim()] = {
                uid: d.id,
                ref: d.ref,
                joined: created ? DateTime.fromJSDate(created).setZone(TZ).toFormat('d LLL yyyy') : 'unknown',
                daysOld: created ? Math.round((Date.now() - created.getTime()) / 86400000) : null,
                games: null,
                gold: u.gold_status === true,
            };
        }
    }
    // `played_games` is NOT usable: it reads 0 for members with a hundred games
    // behind them. Printing "0 games" next to a three-year member is a plain
    // falsehood, so the count is measured with an aggregation query instead.
    await Promise.all(Object.values(out).map(async (p) => {
        try {
            const c = await db.collection('games')
                .where('attendees', 'array-contains', p.ref)
                .where('status', '==', 'played')
                .count().get();
            p.games = c.data().count;
        } catch (e) {
            p.games = null;   // reported as unknown, never as zero
        }
        delete p.ref;
    }));
    return out;
}

// -------------------------------------------------------------------- slack

const KIND_ICON = {
    complaint: ':rotating_light:',
    good: ':green_heart:',
    product: ':wrench:',
    centre: ':office:',
    place: ':round_pushpin:',
    other: ':eyes:',
};

/**
 * Render the list as Slack blocks.
 *
 * Everything is IN the message: no artifact, no link, nothing to click through
 * to. That is the whole point of the redesign, so the formatting has to carry
 * more than a teaser did. Each signal is its own section with the quote in a
 * blockquote, and a divider between them so a phone screen has somewhere to
 * rest.
 *
 * Slack caps a message at 50 blocks. Each signal costs one, so the list is
 * capped well below that and says so if it truncates. A silently trimmed list
 * would read as "that was everything".
 */
const MAX_SIGNALS_POSTED = 12;

function buildBlocks({ signals, meta }) {
    const blocks = [
        {
            type: 'header',
            text: { type: 'plain_text', text: `The Poteau Daily · ${meta.dayLabel}`, emoji: true },
        },
    ];

    const stats = `${meta.messages.toLocaleString('en-US')} messages  ·  ${meta.threads} games`
        + `  ·  ${meta.authors} players`
        + (meta.facts ? `  ·  ${meta.facts.played} played, ${meta.facts.cancelled} cancelled` : '');
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: stats }] });

    if (signals.length === 0) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: 'Nothing from yesterday needs a look. '
                    + 'The chat was ordinary coordination: games filling, players confirming, no situations.',
            },
        });
        return blocks;
    }

    const shown = signals.slice(0, MAX_SIGNALS_POSTED);
    const replies = shown.filter(s => s.urgency === 'reply').length;
    blocks.push({
        type: 'context',
        elements: [{
            type: 'mrkdwn',
            text: `${signals.length} ${signals.length === 1 ? 'thing' : 'things'} worth a look`
                + (replies ? `  ·  ${replies} where someone is waiting on a reply` : '')
                + '  ·  none of it is mandatory',
        }],
    });

    for (const s of shown) {
        blocks.push({ type: 'divider' });

        const icon = KIND_ICON[s.kind] || KIND_ICON.other;
        const flag = s.urgency === 'reply' ? '  `needs a reply`' : '';
        const lines = [`${icon}  *${s.headline}*${flag}`];
        if (s.where) lines.push(`_${s.where}_`);
        if (s.what) lines.push(s.what);
        if (s.quote) lines.push(`> ${s.quote}${s.quote_who ? `\n> — ${s.quote_who}` : ''}`);

        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } });

        const foot = [];
        if (s.why) foot.push(s.why);
        if (s.do) foot.push(`*Do:* ${s.do}`);
        if (foot.length) {
            blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: foot.join('  ·  ') }] });
        }
    }

    if (signals.length > shown.length) {
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'context',
            elements: [{
                type: 'mrkdwn',
                text: `_${signals.length - shown.length} more not shown. `
                    + `Run \`node scripts/daily_signals.js --date=${meta.dayKey}\` to see them all._`,
            }],
        });
    }

    if (meta.check && meta.check.failures.length) {
        blocks.push({
            type: 'context',
            elements: [{
                type: 'mrkdwn',
                text: `:warning: ${meta.check.failures.length} quote(s) could not be matched to a real message `
                    + `and were removed. The situations are kept.`,
            }],
        });
    }

    return blocks;
}

// ------------------------------------------------------------ catch-up state

/**
 * WHY A LEDGER EXISTS.
 *
 * Neither launchd nor Cloud Scheduler does catch-up: a missed slot fires ONCE
 * on the next opportunity, never ten times. So the schedule cannot be the record
 * of what has been published. Each published day is recorded in Firestore and
 * every run asks "which days are missing?" rather than "what is yesterday?".
 *
 * Shares the collection with the old brief but uses its own document, so the
 * newspaper's history stays intact and this starts from its own epoch.
 */
const STATE_DOC = 'internal_state/daily_signals';
const EPOCH = '2026-08-25';

async function publishedDays(db) {
    const snap = await db.doc(STATE_DOC).get();
    return new Set((snap.exists && snap.data().published_days) || []);
}

async function markPublished(db, dayKey) {
    const admin = require('firebase-admin');
    await db.doc(STATE_DOC).set({
        published_days: admin.firestore.FieldValue.arrayUnion(dayKey),
        last_run_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}

/** Every day that should have a list and does not, oldest first. */
async function missingDays(db, maxDays) {
    const done = await publishedDays(db);
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

/**
 * Build and optionally post one day. Returns { posted, signals, meta }.
 */
async function runOneDay(db, targetDay, { post = false, corpusOnly = false } = {}) {
    const day = targetDay.setZone(TZ).startOf('day');
    const dayKey = day.toFormat('yyyy-MM-dd');
    const dayLabel = day.toFormat('cccc d LLLL yyyy');
    const START = day.toJSDate();
    const END = day.plus({ days: 1 }).toJSDate();

    const data = await fetchDay(db, START, END);

    if (data.human.length === 0) {
        // A day with no chat at all is unusual enough to be its own finding: it
        // is either genuinely silent or the message pipeline is broken, and
        // those must not look the same.
        const meta = { dayKey, dayLabel, messages: 0, threads: 0, authors: 0 };
        const blocks = [
            { type: 'header', text: { type: 'plain_text', text: `The Poteau Daily · ${dayLabel}`, emoji: true } },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: 'No game chat at all yesterday. That is either a genuinely silent day '
                        + 'or the message pipeline is broken, and a zero here is unusual enough to check.',
                },
            },
        ];
        if (post) {
            await getHost().postSlack({ blocks });
            await markPublished(db, dayKey);
        }
        return { posted: post, signals: [], meta, blocks };
    }

    const [names, gameDocs] = await Promise.all([
        resolveAll(db, 'users', data.authorIds, u => (u.display_name || '').trim() || 'unknown'),
        resolveAll(db, 'games', data.gameIds, g => {
            // Dedupe: a +1 is the same user ref repeated, so the raw length is
            // the SPOTS taken while the deduped set is the PEOPLE present.
            // "10 of 10 spots, 6 actual people" is the real story of a game
            // that looks full.
            const refs = (g.attendees || []).filter(r => r && r.parent && r.parent.id === 'users');
            return {
                centre: g.centre, sport: g.sport, status: g.status, max: g.max_players,
                date: g.date ? g.date.toDate() : null,
                placeId: g.place_id || '',
                address: g.address || '',
                // The raw GeoPoint, for the area check. Kept as-is rather than
                // flattened: areaKey() reads .latitude/.longitude directly.
                location: g.location || null,
                spots: refs.length,
                players: new Set(refs.map(r => r.id)).size,
                noShows: (g.no_show_players || []).length,
                lates: (g.late_players || []).length,
                praised: (g.good_players || []).length,
                rude: (g.rude_players || []).length,
            };
        }),
    ]);

    // Context for every author who wrote more than a couple of lines: that
    // covers everyone a signal could plausibly be about, at one batched read.
    const talkative = Object.entries(
        data.human.reduce((acc, m) => {
            const n = names[m.aid];
            if (n) acc[n] = (acc[n] || 0) + 1;
            return acc;
        }, {}))
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([n]) => n);

    const facts = dayFacts(gameDocs);
    const [players, venues] = await Promise.all([
        playerContext(db, names, talkative),
        venueBaseline(db, day, gameDocs),
    ]);

    const { corpus, threads, routineTotal } = buildCorpus(
        day, data, names, gameDocs, facts, players, venues);
    if (corpusOnly) return { corpus, posted: false, signals: [], meta: { dayKey } };

    const meta = {
        dayKey, dayLabel,
        messages: data.human.length,
        threads,
        authors: data.authorIds.size,
        routinePct: Math.round((routineTotal / data.human.length) * 100),
        facts,
        unusualVenues: venues ? venues.length : null,
    };

    console.error(`[daily_signals] ${dayKey}: ${meta.messages} messages, ${meta.threads} games, `
        + `${corpus.length} chars, ${venues ? venues.length : '?'} unusual venues -> model`);

    const signals = await writeSignalsWithRetry(corpus);
    meta.check = verifyQuotes(signals, data.human);
    console.error(`[daily_signals] ${dayKey}: ${signals.length} signals, `
        + `quotes ${meta.check.verified}/${meta.check.checked} verified`
        + (meta.check.failures.length ? ` — DROPPED: ${meta.check.failures.join(' | ').slice(0, 200)}` : ''));

    const blocks = buildBlocks({ signals, meta });

    if (post) {
        await getHost().postSlack({ blocks });
        // Mark ONLY after a successful post. If Slack throws, the day stays
        // missing and the next run retries it.
        await markPublished(db, dayKey);
    }
    return { posted: post, signals, meta, blocks, corpus };
}

/** Publish every day still missing, oldest first. */
async function runCatchup(db, { maxDays = 14, post = false } = {}) {
    const days = await missingDays(db, maxDays);
    if (days.length === 0) return { days: [], posted: 0 };

    console.error(`[daily_signals] ${days.length} day(s) missing: ${days.join(', ')}`);
    let posted = 0;
    for (const key of days) {
        try {
            const r = await runOneDay(db, DateTime.fromISO(key, { zone: TZ }), { post });
            if (r.posted) posted++;
        } catch (e) {
            // One bad day must not block the backlog. It stays unmarked, so
            // tomorrow's run picks it up again.
            console.error(`[daily_signals] ${key} FAILED: ${e.message.slice(0, 140)}`);
        }
    }
    return { days, posted };
}

/**
 * Render a run to plain text, for a terminal or a log.
 *
 * Deliberately not the Slack blocks: reading JSON to check a day's output is
 * miserable, and this is the form a human inspects with --date.
 */
function toText(signals, meta) {
    const L = [];
    L.push(`THE POTEAU DAILY — ${meta.dayLabel}`);
    L.push(`${meta.messages} messages · ${meta.threads} games · ${meta.authors} players`);
    L.push('');
    if (!signals.length) {
        L.push('Nothing from yesterday needs a look.');
        return L.join('\n');
    }
    signals.forEach((s, i) => {
        L.push(`${i + 1}. [${s.kind.toUpperCase()}${s.urgency === 'reply' ? ' · NEEDS A REPLY' : ''}] ${s.headline}`);
        if (s.where) L.push(`   ${s.where}${s.game_id ? `  (game ${s.game_id})` : ''}`);
        if (s.what) L.push(`   ${s.what}`);
        if (s.quote) L.push(`   "${s.quote}" (${s.quote_who})`);
        if (s.why) L.push(`   WHY: ${s.why}`);
        if (s.do) L.push(`   DO:  ${s.do}`);
        L.push('');
    });
    return L.join('\n');
}

module.exports = {
    setHost,
    runOneDay,
    runCatchup,
    missingDays,
    markPublished,
    buildBlocks,
    parseSignals,
    verifyQuotes,
    venueBaseline,
    toText,
    PROMPT,
    TZ,
};
