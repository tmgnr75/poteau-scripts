const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

const centreData = [
  { document_id: '3HYOCefPpf7l7oDp4rbJ', centre_location: '48.6286849&2.4066366' },
  { document_id: '66sBJ1DHyonGxvGZDuLN', centre_location: '48.8181615&2.3658793' },
  { document_id: '6CIZ91rWSxCO1UQ2Dsxn', centre_location: '48.9539465&2.9154573' },
  { document_id: '7BbXNduHwAtYavQ7uSnG', centre_location: '48.7360598&2.315058' },
  { document_id: '7u10tYI2J6wrpUmZStm9', centre_location: '48.82658600000001&2.6296937' },
  { document_id: '9xXghjIxp93f68f9C3Vo', centre_location: '48.8194084&2.5251846' },
  { document_id: 'BvY3DhQizxXV3w6f3Hbr', centre_location: '48.99782219999999&2.3902225' },
  { document_id: 'bWrnmpYePMdVw91kosSB', centre_location: '48.70829&2.17794' },
  { document_id: 'IcIq9aWu5P7OTJ61oCHN', centre_location: '48.9364404&2.3869147' },
  { document_id: 'IMCJhD4GsXSRHGwYbdQO', centre_location: '48.9468144&2.0230574' },
  { document_id: 'k9cUZ7VCYHcKWh7qHKHd', centre_location: '48.8996456&2.2216773' },
  { document_id: 'KSbwyCj9i8OZXMiiqflF', centre_location: '48.9074912&2.3746518' },
  { document_id: 'LHyOzzf3O2FJRQpYN4Lq', centre_location: '48.7722091&2.0600292' },
  { document_id: 'LVrgmOp2HORJaIwrG8p3', centre_location: '48.7643086&2.4706522' },
  { document_id: 'MPetocHnSQRDxzTQsJ2U', centre_location: '48.80013599999999&2.2140811' },
  { document_id: 'MZoccGGhFUoibgkI5Ivu', centre_location: '48.8607303&2.4650432' },
  { document_id: 'nKnJschdFsvnb287psdp', centre_location: '48.692672&2.3192811' },
  { document_id: 'nzs8Usi2KrUFy92Cov3v', centre_location: '48.9552257&2.3328346' },
  { document_id: 'oDB5krf0LOw1ZNNqXCCD', centre_location: '48.8836397&2.2312283' },
  { document_id: 'okgWRQnFVQQh89NjjVXJ', centre_location: '48.9070122&2.3861459' },
  { document_id: 'plmosa7aSHbuygUvYx4R', centre_location: '48.901553&2.4313304' },
  { document_id: 'rD3Fjk68QBDb8jUtVc7L', centre_location: '48.8978522&2.3700234' },
  { document_id: 'rG59DRo1lewFUT8haF7G', centre_location: '48.9009153&2.2297275' },
  { document_id: 'SKEctk7zwtjoRqzzdNkT', centre_location: '48.7511024&2.3713455' },
  { document_id: 'tladgZwRgT9CRTl5fLRV', centre_location: '48.8729106&2.6840919' },
  { document_id: 'UaLlXwEcoRt28eL4Cmjm', centre_location: '48.92192379999999&2.3068311' },
  { document_id: 'uNDYKKA4SVoKnURSSGye', centre_location: '48.900032&2.3213449' },
  { document_id: 'VgbDm71u9CIl7xJYnU6c', centre_location: '48.960066&2.2061913' },
  { document_id: 'WZFO10a4yxzUypiozVlE', centre_location: '48.8199815&2.3936307' },
  { document_id: 'X01N7yNqNzIkO5UwKp7t', centre_location: '48.9501632&2.2093946' },
  { document_id: 'X11XnYyKSTzEcI7LFrHH', centre_location: '48.9190419&2.2117725' }
];

async function updateCentreLocations(dataArray) {
  for (const centre of dataArray) {
    const [lat, lng] = centre.centre_location.split('&').map(Number);
    const geopoint = new admin.firestore.GeoPoint(lat, lng);

    try {
      await db.collection('cached_centres').doc(centre.document_id).update({
        centre_location: geopoint
      });
      console.log(`Updated ${centre.document_id} successfully.`);
    } catch (error) {
      console.error(`Error updating ${centre.document_id}: `, error);
    }
  }
}

updateCentreLocations(centreData).then(() => {
  console.log('All documents updated');
}).catch(error => {
  console.error('An error occurred during the update process:', error);
});