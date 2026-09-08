#!/usr/bin/env node
// Set TestFlight "What to Test" for a build, via the App Store Connect API.
//
// altool cannot do this -- it uploads a binary and nothing else -- so this was
// the one manual step left in the release. Signs its own ES256 JWT with the
// same .p8 the upload uses, so it needs no new credentials.
//
//   node asc_notes.js <build-number> [--notes-file path] [--wait]
//
// --wait polls until the build finishes processing, which takes 5-15 min after
// upload and is required before notes can be attached.

const crypto = require('crypto');
const fs = require('fs');

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
    exp: Math.floor(Date.now() / 1000) + 900,
    aud: 'appstoreconnect-v1',
  });
  const signer = crypto.createSign('SHA256');
  signer.update(`${header}.${payload}`);
  // ASC wants the JOSE fixed-width r||s pair, not the DER envelope Node emits
  // by default. Getting this wrong is a 401 that looks like a bad key.
  const sig = signer.sign(
    { key: fs.readFileSync(KEY_PATH), dsaEncoding: 'ieee-p1363' },
  ).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.${sig}`;
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
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = (body.errors || []).map((e) => `${e.title}: ${e.detail}`).join('; ');
    throw new Error(`${res.status} ${detail || text}`);
  }
  return body;
}

const findBuild = async (version) => {
  const r = await api(`/v1/builds?filter[app]=${APP_ID}&limit=20&sort=-version`);
  return r.data.find((b) => b.attributes.version === String(version));
};

(async () => {
  const args = process.argv.slice(2);
  const version = args[0];
  if (!version) { console.error('usage: asc_notes.js <build-number> [--notes-file p] [--wait]'); process.exit(1); }
  const wait = args.includes('--wait');
  const fi = args.indexOf('--notes-file');
  const notes = fi >= 0 ? fs.readFileSync(args[fi + 1], 'utf8').trim() : null;

  let build = await findBuild(version);
  if (!build) {
    if (!wait) { console.error(`build ${version} not found on ASC yet`); process.exit(2); }
    process.stdout.write(`waiting for build ${version} to appear`);
  }

  const deadline = Date.now() + 30 * 60 * 1000;
  while (wait && (!build || build.attributes.processingState !== 'VALID')) {
    if (Date.now() > deadline) { console.error('\ntimed out after 30 min'); process.exit(3); }
    if (build && build.attributes.processingState === 'FAILED') {
      console.error(`\nbuild ${version} FAILED processing`); process.exit(4);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 30000));
    build = await findBuild(version);
  }
  if (wait) process.stdout.write('\n');
  if (!build) { console.error(`build ${version} not found`); process.exit(2); }

  console.log(`build ${version}: ${build.attributes.processingState}  (id ${build.id})`);
  if (!notes) return;
  if (build.attributes.processingState !== 'VALID') {
    console.error('not VALID yet -- notes can only be set on a processed build'); process.exit(5);
  }

  // One localization per locale; ours is en-US. Reuse it if it already exists,
  // because POSTing a second one for the same locale is a 409.
  const existing = await api(`/v1/builds/${build.id}/betaBuildLocalizations`);
  const enUS = existing.data.find((l) => l.attributes.locale === 'en-US');

  if (enUS) {
    await api(`/v1/betaBuildLocalizations/${enUS.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'betaBuildLocalizations', id: enUS.id, attributes: { whatsNew: notes } } }),
    });
    console.log('updated existing en-US notes');
  } else {
    await api('/v1/betaBuildLocalizations', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'betaBuildLocalizations',
          attributes: { locale: 'en-US', whatsNew: notes },
          relationships: { build: { data: { type: 'builds', id: build.id } } },
        },
      }),
    });
    console.log('created en-US notes');
  }
  console.log(`\n--- What to Test ---\n${notes}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
