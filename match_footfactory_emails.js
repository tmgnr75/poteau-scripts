const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const ts = v => v?.toDate ? v.toDate().toISOString() : null;

const LIST = [
  { nom: "Luigi Fumex", email: "churumbelo74@gmail.com" },
  { nom: "Matthieu Tecedor", email: "mat.tecedor@gmail.com" },
  { nom: "Neves Fredy", email: "fredlymaaa@gmail.com" },
  { nom: "Mateo ROTA", email: "rotamateo04@gmail.com" },
  { nom: "Nathan Behr", email: "nathan.behr5@gmail.com" },
  { nom: "Tom Burdet", email: "tom.burdet0405@gmail.com" },
  { nom: "Dani Berbagui", email: "berbagui.dani@gmail.com" },
  { nom: "Alex Dabonneville", email: "dwb.grigny@gmail.com" },
  { nom: "Hugo Fernandes Pereira", email: "fernandespereirahugo@gmail.com" },
  { nom: "Matthieu Blary", email: "mattblary@gmail.com" },
];

const OPERATOR_PHONE = '+33680464480';

// name variants to try for display_name / nickname / first_name / last_name
function nameVariants(nom) {
  const parts = nom.trim().split(/\s+/);
  const v = new Set([nom, nom.toLowerCase()]);
  v.add(parts[0]);                              // first token
  v.add(parts[parts.length - 1]);               // last token
  if (parts.length >= 2) {
    v.add(`${parts[0]} ${parts[1]}`);
    v.add(`${parts[parts.length - 1]} ${parts[0]}`); // reversed (list has "Neves Fredy")
  }
  return [...v].filter(Boolean);
}

async function emailLookup(email) {
  const out = [];
  for (const field of ['email', 'auth_email_address']) {
    const s = await db.collection('users').where(field, '==', email).get();
    s.forEach(d => out.push({ via: `firestore:${field}`, uid: d.id, u: d.data() }));
  }
  // Firebase Auth email lookup (catches accounts where Firestore email differs / Apple relay)
  try {
    const a = await admin.auth().getUserByEmail(email);
    out.push({ via: 'auth:getUserByEmail', uid: a.uid, authUser: a });
  } catch (e) { /* user-not-found is expected */ }
  return out;
}

async function nameLookup(nom) {
  const out = [];
  const seen = new Set();
  for (const field of ['display_name', 'nickname', 'first_name', 'last_name']) {
    for (const val of nameVariants(nom)) {
      const s = await db.collection('users').where(field, '==', val).get();
      s.forEach(d => { const k = field + '|' + d.id; if (!seen.has(k)) { seen.add(k); out.push({ via: `name:${field}=${val}`, uid: d.id, u: d.data() }); } });
    }
  }
  return out;
}

async function main() {
  console.log(`Cross-referencing ${LIST.length} FootFactory contacts against Poteau users.\n`);
  const report = [];

  for (const person of LIST) {
    const emailHits = await emailLookup(person.email);
    const nameHits = await nameLookup(person.nom);

    // dedupe by uid, note match strength
    const byUid = {};
    emailHits.forEach(h => { byUid[h.uid] = byUid[h.uid] || { uid: h.uid, vias: new Set(), u: h.u, authUser: h.authUser }; byUid[h.uid].vias.add(h.via); byUid[h.uid].emailMatch = true; if (h.u) byUid[h.uid].u = h.u; if (h.authUser) byUid[h.uid].authUser = h.authUser; });
    nameHits.forEach(h => { byUid[h.uid] = byUid[h.uid] || { uid: h.uid, vias: new Set(), u: h.u }; byUid[h.uid].vias.add(h.via); byUid[h.uid].nameMatch = true; if (h.u) byUid[h.uid].u = h.u; });

    report.push({ person, matches: Object.values(byUid) });
  }

  // Print
  for (const r of report) {
    const strong = r.matches.filter(m => m.emailMatch);
    const nameOnly = r.matches.filter(m => m.nameMatch && !m.emailMatch);
    console.log('================================================================');
    console.log(`${r.person.nom}  <${r.person.email}>`);
    if (!r.matches.length) { console.log('  → NO Poteau match (email or name).'); continue; }

    if (strong.length) {
      console.log('  ✅ EMAIL MATCH (same person, high confidence):');
      for (const m of strong) await printMatch(m);
    }
    if (nameOnly.length) {
      console.log(`  ~ name-only matches (${nameOnly.length}) — lower confidence, verify manually:`);
      for (const m of nameOnly.slice(0, 6)) await printMatch(m, true);
      if (nameOnly.length > 6) console.log(`     ...and ${nameOnly.length - 6} more common-name hits (omitted).`);
    }
  }

  process.exit(0);
}

async function printMatch(m, brief) {
  const u = m.u || {};
  let phone = u.phone_number;
  let email = u.email;
  let disabled;
  if (!u.phone_number || m.authUser) {
    try { const a = m.authUser || await admin.auth().getUser(m.uid); phone = phone || a.phoneNumber; email = email || a.email; disabled = a.disabled; } catch {}
  }
  const operatorLink = phone === OPERATOR_PHONE ? '  🚩 SAME PHONE AS FOOTFACTORY OPERATOR' : '';
  console.log(`     - ${m.uid} | ${u.display_name || '(no name)'} | ${email || '?'} | ${phone || '?'} | banned=${u.banned}${disabled !== undefined ? ' | auth.disabled=' + disabled : ''} | via ${[...m.vias].join(',')}${operatorLink}`);
  if (!brief) {
    console.log(`        created=${ts(u.created_time)} last_active=${ts(u.last_activity_date)} games=${(u.games || []).length} gold=${u.gold_status}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
