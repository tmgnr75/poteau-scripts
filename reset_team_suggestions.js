/**
 * Puts the Your Team suggestions back, so the Home section can be tested again.
 *
 * Adding somebody and dismissing somebody are both PERMANENT by design: a
 * dismissal writes `users.dismissed_suggestions` and an add writes the
 * recipient's `pending_friends`. getTeamSuggestions excludes both, which is
 * correct in production and makes the section a one-shot on a test account.
 *
 * This undoes exactly those two writes for one user, and nothing else. It does
 * NOT touch `friends`: somebody actually added and accepted belongs in the
 * team, and removing them would be rewriting real history rather than resetting
 * a test.
 *
 *   node reset_team_suggestions.js                 # Tim
 *   node reset_team_suggestions.js <uid>
 *   node reset_team_suggestions.js <uid> --dry
 *
 * Run it from scripts/ -- the admin credentials resolve relative to this
 * directory (see FIRESTORE_ANALYTICS_GUIDE.md).
 */
const admin = require("firebase-admin");
const sa = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: "krank-club",
  });
}
const db = admin.firestore();

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const args = process.argv.slice(2).filter((a) => a !== "--dry");
const DRY = process.argv.includes("--dry");
const UID = args[0] || TIM;

(async () => {
  const ref = db.collection("users").doc(UID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`no such user: ${UID}`);
    process.exit(1);
  }
  const me = snap.data() || {};
  const dismissed = me.dismissed_suggestions || [];

  // Requests this account has SENT. They live on the recipient's document, not
  // on the sender's, so they have to be found by query -- which is also why
  // the function has to check both directions.
  const outgoing = await db
    .collection("users")
    .where("pending_friends", "array-contains", ref)
    .select()
    .get();

  console.log(`user:       ${me.display_name || UID}`);
  console.log(`dismissed:  ${dismissed.length}`);
  console.log(`requests sent: ${outgoing.size}`);
  console.log(`friends:    ${(me.friends || []).length} (left alone)`);

  if (!dismissed.length && !outgoing.size) {
    console.log("\nnothing to reset.");
    process.exit(0);
  }
  if (DRY) {
    console.log("\n--dry: nothing written.");
    process.exit(0);
  }

  if (dismissed.length) await ref.update({ dismissed_suggestions: [] });
  for (const d of outgoing.docs) {
    await d.ref.update({
      pending_friends: admin.firestore.FieldValue.arrayRemove(ref),
    });
  }

  console.log(
    `\ncleared ${dismissed.length} dismissals and ${outgoing.size} sent requests.`
  );
  console.log("Hot restart the app (kill -USR2 $(cat /tmp/flutter.pid)).");
  process.exit(0);
})();
