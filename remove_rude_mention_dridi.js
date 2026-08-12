/**
 * Remove the "rude" mention against Anisse Dridi (display name "Joe Attia")
 * from the game played on 18 May 2025 at Terrain de Sport Westermeyer.
 *
 * Context: the user organized this game and was marked as rude by a player who
 * did not show up (Yaya, TYW14UuB5vPLvFjPdvdVibUgVA62 -- already banned, 5
 * no-show reports). The same feedback pass also marked all four attendees as
 * "good", which is why this entry is treated as unreliable.
 *
 * Scope is deliberately narrow: only this user's reference is pulled from
 * games.rude_players. The two other players named in the same array are left
 * untouched. The user's aggregate users.rude_reports is already empty, so it is
 * only asserted here, not modified.
 *
 * Idempotent: re-running after a successful pass is a no-op.
 *
 * Usage:
 *   node remove_rude_mention_dridi.js --dry   # preview
 *   node remove_rude_mention_dridi.js         # apply
 */

const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const GAME_ID = 'hrpMVsMa3H8MsgGCP813';
const USER_ID = '7P5JfLlQUQRgPn2L3NS8e2cLZho2';
const DRY = process.argv.includes('--dry');

(async () => {
  const gameRef = db.doc(`games/${GAME_ID}`);
  const userRef = db.doc(`users/${USER_ID}`);

  const game = await gameRef.get();
  if (!game.exists) throw new Error(`game ${GAME_ID} not found`);

  const before = (game.data().rude_players || []).map((r) => r.id);
  console.log('rude_players before:', before);

  if (!before.includes(USER_ID)) {
    console.log('Nothing to do: user is not in rude_players.');
    process.exit(0);
  }

  // The user's aggregate counter. Already empty in production, but arrayRemove
  // is safe either way and keeps the two surfaces consistent if that changes.
  const user = await userRef.get();
  const userRudeBefore = (user.data().rude_reports || []).map((r) => r.id);
  console.log('users.rude_reports before:', userRudeBefore);

  if (DRY) {
    console.log('\n[dry run] would remove', USER_ID, 'from games.rude_players');
    console.log('[dry run] rude_players after:', before.filter((id) => id !== USER_ID));
    process.exit(0);
  }

  await gameRef.update({ rude_players: admin.firestore.FieldValue.arrayRemove(userRef) });
  await userRef.update({ rude_reports: admin.firestore.FieldValue.arrayRemove(gameRef) });

  const after = await gameRef.get();
  console.log('rude_players after:', (after.data().rude_players || []).map((r) => r.id));

  const userAfter = await userRef.get();
  console.log('users.rude_reports after:', (userAfter.data().rude_reports || []).map((r) => r.id));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
