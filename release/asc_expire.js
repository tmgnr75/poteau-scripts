#!/usr/bin/env node
// Expire a TestFlight build so testers stop seeing it.
//
//   node asc_expire.js <build-number>
//
// Reuses the auth shape of asc_notes.js (same key, same issuer, same app).
// One call: PATCH /v1/builds/{id} {"attributes":{"expired":true}}.
//
// IRREVERSIBLE. An expired build cannot be un-expired -- testers lose it for
// good, so the newer build must already be processed and installable before
// this runs. Refuses to expire a build that is still the newest VALID one.
const crypto = require('crypto');

const KEY_ID = '8S2YGG4B5Z';
const ISSUER = '69a6de86-2a28-47e3-e053-5b8c7c11a4d1';
const APP_ID = '1664764947';
const KEY_PATH = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))
  .toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function token() {
  const header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const payload = b64({
    iss: ISSUER,
    exp: Math.floor(Date.now() / 1000) + 20 * 60,
    aud: 'appstoreconnect-v1',
  });
  const signer = crypto.createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(
    { key: require('fs').readFileSync(KEY_PATH), dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64(sig.toString('binary')) &&
    sig.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`;
}

async function api(path, init = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}\n${text}`);
  return text ? JSON.parse(text) : {};
}

(async () => {
  const version = process.argv[2];
  const force = process.argv.includes('--force');
  if (!version) {
    console.error('usage: asc_expire.js <build-number> [--force]');
    process.exit(1);
  }

  const r = await api(`/v1/builds?filter[app]=${APP_ID}&limit=20&sort=-version`);
  const builds = r.data.map((b) => ({
    id: b.id,
    version: b.attributes.version,
    state: b.attributes.processingState,
    expired: b.attributes.expired,
  }));

  console.log('Builds on ASC:');
  for (const b of builds.slice(0, 6)) {
    console.log(`  ${b.version.padStart(4)}  ${String(b.state).padEnd(10)}` +
                `  expired=${b.expired}`);
  }

  const target = builds.find((b) => b.version === String(version));
  if (!target) { console.error(`\nbuild ${version} not found`); process.exit(2); }
  if (target.expired) { console.log(`\nbuild ${version} is already expired`); return; }

  // The guard: never leave testers with nothing installable.
  const newerValid = builds.filter(
    (b) => Number(b.version) > Number(version) && b.state === 'VALID' && !b.expired);
  if (newerValid.length === 0 && !force) {
    console.error(`\nREFUSING: no newer VALID build exists, so expiring ${version} ` +
                  `would leave testers with nothing.\n` +
                  `Wait for the newer build to finish processing, or pass --force.`);
    process.exit(3);
  }
  console.log(`\nnewer VALID builds: ${newerValid.map(b=>b.version).join(', ') || '(none, forced)'}`);

  await api(`/v1/builds/${target.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'builds', id: target.id, attributes: { expired: true } },
    }),
  });
  console.log(`\nbuild ${version} expired.`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
