const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// IDs of documents to delete
const documentIds = [
  '1MPKrqXffbnGF1G03pxB',
  '1oMZwJsmdceBeYy0RPP0',
  '2uLaMrF56ih1ugb47zZ9',
  '3FD4Am3RkhG6vnWgWzSm',
  '53IbRdq2trnpR7Yw1rY2',
  '7fJYC039fQn3P9npw0Eo',
  '9gTlS7UVQUc160lYOnTm',
  'AQjqurSxJLXHZF4kExjc',
  'DhNPT9nJAuftcd1fXMO2',
  'Hnkv9mMheOZDJzWMeoVp',
  'JzNncMVmSRne56WDYlNY',
  'L6ncyVtTz4VxjVUhKkgE',
  'LiGfSZI64QhbVHtKerOL',
  'O9n9lBtJUD6rL4TrCpMo',
  'Qo2tvDr1oo6xSHqIiMwu',
  'ROKONHHpBTfVty7wBQui',
  'RsEJHKZDNeKEFyjIr4i7',
  'SCWNLk7p8WxfsZizXxiw',
  'TO47czIaV4hnuEp0NqqA',
  'TUypOK103RIEmbAKETpL',
  'Urf9KHvlfB1WeVbbFpdm',
  'VeUoxvolll2GDfBPNngi',
  'WXM0mF8JvgkNk0hq5iXg',
  'ZimN5gC9QEuzCkngiWFk',
  'a1kIxGPkgM3vqX66IJMQ',
  'aM6DeeMyTrzi1AKIIASu',
  'aQ4yFQx5wLCHyPMxWmBC',
  'eV5tvVIrpdRErXGtdmA8',
  'haT3NB8KFGKLpH8tgbRw',
  'jVo0jrOqySszDLqMkhC7',
  'kUmZKqztPoIIKpv5sNFI',
  'ozQDFws0EnMROhNnCFOA',
  'p9jlTuAB5rpij5u9Wzuw',
  'q5g6SxN5P21tHcz3CA0v',
  'sW1xnC61aCbtILmN3li8',
  'tH1pum4i1sOxbb1dFFz5',
  'tHo8asXvpMEC09vZWZ9V',
  'tbouJt8M6oRpjQYoIjzq',
  'v1i1kcgELPeCsHCx6r5O',
  'wpRNp2tEnNAAgIAxjN2d'
];

async function deleteDocuments() {
  for (const docId of documentIds) {
    try {
      await db.collection('repeaters').doc(docId).delete();
      console.log(`Document ${docId} deleted successfully.`);
    } catch (error) {
      console.error(`Error deleting document ${docId}:`, error);
    }
  }
}

deleteDocuments();
