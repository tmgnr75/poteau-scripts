const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const paymentDocIds = [
  'ROYpNTetGWvGBu9xaTDz',
  'bxNbfD13htIYiOPTseQg',
  'FnCBJvynRDuO5WL2hEwZ',
  'JeuMA8bXoP7yCyXwu0k6',
  'nJ6RxbWL9Cc5VocAoCi8',
  'cEKtResfsL0ZK82QCuHx',
  '2ORRR7N24FKiybuywzNJ',
  'jMR3TQBp7G2D2qermVRu',
  '24ZMAC8yLVATwh7eTuIY',
  'L2BOUzCCKQLRXueolZX6',
];

async function cancelPayments() {
  console.log(`🟡 Starting payment cancellation process for ${paymentDocIds.length} documents...`);

  for (const [index, docId] of paymentDocIds.entries()) {
    const ref = db.doc(`payments/${docId}`);
    try {
      console.log(`➡️ [${index}] Updating document /payments/${docId}...`);

      await ref.update({ status: 'canceled' });

      console.log(`✅ [${index}] Successfully set status = "canceled" for /payments/${docId}`);
    } catch (error) {
      console.error(`❌ [${index}] Failed to update /payments/${docId}:`, error.message);
    }
  }

  console.log('🏁 Payment cancellation process completed.');
}

cancelPayments();