const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

const centreData = [
  // {
  //   "centre_name": "Brooklyn Force Soccer",
  //   "centre_place_id": "ChIJ-S82HdRbwokRHcC6tN0__L4",
  //   "centre_location": "40.68279960006237&-73.98573264418236"
  // },
  // {
  //   "centre_name": "Globall Sports Centers - Brooklyn",
  //   "centre_place_id": "ChIJYVUE_J9bwokRuEBZfRYfobU",
  //   "centre_location": "40.669039084914175&-73.95544310185534"
  // },
  // {
  //   "centre_name": "Soccer Center NYC",
  //   "centre_place_id": "ChIJ1aOw95RfwokRe0fEYMdtNJg",
  //   "centre_location": "40.756478322625114&-73.92187277116352"
  // },
  // {
  //   "centre_name": "Socceroof LIC",
  //   "centre_place_id": "ChIJ5QHjQedfwokRcvhei27HV1o",
  //   "centre_location": "40.7541731002595&-73.92726180185532"
  // },
  // {
  //   "centre_name": "Socceroof New Rochelle",
  //   "centre_place_id": "ChIJO-ZGkm6NwokRH5LzBlNfsIQ",
  //   "centre_location": "40.91151018691811&-73.77849741349058"
  // },
  // {
  //   "centre_name": "Socceroof Crown Heights",
  //   "centre_place_id": "ChIJ_wfNJBVdwokRoU3ZUxM4oTc",
  //   "centre_location": "40.6776894674487&-73.93419044232705"
  // },
  // {
  //   "centre_name": "Chelsea Piers",
  //   "centre_place_id": "ChIJNcurQqBZwokRYDgoFu6QXCI",
  //   "centre_location": "40.748270894835265&-74.00871063021796"
  // },
  // {
  //   "centre_name": "Sofive Brooklyn",
  //   "centre_place_id": "ChIJvytTY_JdwokRVMSxK5pjEyU",
  //   "centre_location": "40.672100258269744&-73.89840313558202"
  // },
  // {
  //   "centre_name": "Socceroof Sunset Park",
  //   "centre_place_id": "ChIJrfgrMK9awokR-Z5O20hCD3w",
  //   "centre_location": "40.65034522951021&-74.02348929814467"
  // },
  // {
  //   "centre_name": "SOFIVE - POMONA",
  //   "centre_place_id": "ChIJWTYmoZwtw4ARhhKsGjxJqdg",
  //   "centre_location": "34.030507485598804&-117.74941894232914"
  // },
  // {
  //   "centre_name": "SOFIVE - RANCHO CUCAMONGA",
  //   "centre_place_id": "ChIJsUuykglKw4ARCHx7QxSVhoY",
  //   "centre_location": "34.10097860080817&-117.54890858650627"
  // },
  // {
  //   "centre_name": "SOFIVE - SOUTHGATE",
  //   "centre_place_id": "ChIJQ2LL-D3MwoAR6vKb3yEZvgk",
  //   "centre_location": "33.94566430088488&-118.18306155767087"
  // },
  // {
  //   "centre_name": "SOFIVE - UPLAND",
  //   "centre_place_id": "ChIJdxqeoAwxw4ARVXVSJLpNtVE",
  //   "centre_location": "34.104186873863284&-117.68452261349374"
  // },
  // {
  //   "centre_name": "SOFIVE - COVINA",
  //   "centre_place_id": "ChIJ4Zh9okUpw4ARzt9_t2FR39Y",
  //   "centre_location": "34.07784672915501&-117.881647398152"
  // },
  // {
  //   "centre_name": "LAB FIVE SOCCER - PACOIMA",
  //   "centre_place_id": "ChIJfzPcqtaRwoARXvzkvoBBQ5Y",
  //   "centre_location": "34.248203902334&-118.40701602883541"
  // },
  // {
  //   "centre_name": "Granada Indoor Soccer",
  //   "centre_place_id": "ChIJZe5X38-p2YgR7V1S_g4R5X8",
  //   "centre_location": "26.046520685979374&-80.20800859814467"
  // },
  // {
  //   "centre_name": "Shooting Stars Indoor Soccer",
  //   "centre_place_id": "ChIJu_DTlg8I2YgRQGdsz5y09e0",
  //   "centre_location": "26.104292968314738&-80.28596592883648"
  // },
  // {
  //   "centre_name": "Soccer Planet",
  //   "centre_place_id": "ChIJVVVVVQnXDIgRLBG0gleJUeg",
  //   "centre_location": "40.13698101467192&-88.20024569393073"
  // },
  // {
  //   "centre_name": "Pegaso Soccer",
  //   "centre_place_id": "ChIJC8qhZ6m22YgRyRMteyq-EoU",
  //   "centre_location": "25.79752568307743&-80.19176688650941"
  // },
  // {
  //   "centre_name": "Stadio Soccer",
  //   "centre_place_id": "ChIJE8piT3Kx2YgRiH6pVi9sIvM",
  //   "centre_location": "25.842363863477672&-80.20647252512583"
  // },
  // {
  //   "centre_name": "Soctainer",
  //   "centre_place_id": "ChIJt-kZfv622YgR4PrDZCA7JCw",
  //   "centre_location": "25.765519921286128&-80.22743196220591"
  // },
  // {
  //   "centre_name": "Soccer 5 Tropical Park",
  //   "centre_place_id": "ChIJI2JYMoa42YgRP0sx16u-fRo",
  //   "centre_location": "25.730190947225587&-80.3241452539623"
  // },
  // {
  //   "centre_name": "Soccer City Miami",
  //   "centre_place_id": "ChIJIRUjAre-2YgRw_lDJcG3dD8",
  //   "centre_location": "25.796380747019104&-80.37480238465409"
  // },
  // {
  //   "centre_name": "Downtown Soccer Miami",
  //   "centre_place_id": "ChIJz6UVWpa22YgRUJImJbvFehM",
  //   "centre_location": "25.778722328274423&-80.2021569539623"
  // },
  // {
  //   "centre_name": "Futbol Fever",
  //   "centre_place_id": "ChIJFSHIaJTB2YgRzi-_B_FVHtw",
  //   "centre_location": "25.656851559577476&-80.4254955306918"
  // },
  // {
  //   "centre_name": "Soccertime",
  //   "centre_place_id": "ChIJVRdtdwa3QIYRzwyM77_hWMk",
  //   "centre_location": "29.902846592048324&-95.34697552698111"
  // },
  // {
  //   "centre_name": "Lets Play!",
  //   "centre_place_id": "ChIJiQuEX3joQIYRrK99NAG9BjM",
  //   "centre_location": "30.005827652440544&-95.72533175035791"
  // },
  // {
  //   "centre_name": "The Indoor Soccer Box",
  //   "centre_place_id": "ChIJadntBAbbQIYRlM2WxDsMz7I",
  //   "centre_location": "29.801679174248164&-95.56183835581763"
  // },
  // {
  //   "centre_name": "Houston Sports Park",
  //   "centre_place_id": "ChIJxcqO6tTqQIYRnAUZYsEpl_s",
  //   "centre_location": "29.63824644076503&-95.39520728279878"
  // },
  // {
  //   "centre_name": "Maya Indoor Soccer",
  //   "centre_place_id": "ChIJZwtLpkDNQIYRyLJuiJ7U-qQ",
  //   "centre_location": "29.997407130600056&-95.48662730977993"
  // },
  // {
  //   "centre_name": "West Houston Indoor Soccer",
  //   "centre_place_id": "ChIJ92iJxOzZQIYRuhDjEWRNgyw",
  //   "centre_location": "29.831163819712472&-95.6598586693082"
  // },
  // {
  //   "centre_name": "Houston Soccer Field",
  //   "centre_place_id": "ChIJYwnTqjHXQIYRDyENYgvwCWo",
  //   "centre_location": "29.88951902486861&-95.6972776276646"
  // },
  // {
  //   "centre_name": "uScore Soccer",
  //   "centre_place_id": "ChIJAdKS7b0yR4YRLzlho5qjzXQ",
  //   "centre_location": "30.05907900500951&-95.54547281349058"
  // },
  // {
  //   "centre_name": "Revolution Soccer Complex",
  //   "centre_place_id": "ChIJ1emlnUhL9IgRGZwtqD7Zz0k",
  //   "centre_location": "29.99899318066411&-95.43933249801391"
  // },
  // {
  //   "centre_name": "Main Street Soccer",
  //   "centre_place_id": "ChIJfdu-8NK4QIYRsNk7vR_t9S4",
  //   "centre_location": "29.775779278923967&-95.36007964283036"
  // },
  // {
  //   "centre_name": "Estuary Park - Alameda",
  //   "centre_place_id": "ChIJF0eB88GAj4ARK7EcyG0E-28",
  //   "centre_location": "37.78986132958717&-122.28681286931655"
  // },
  // {
  //   "centre_name": "SFF Soccer - Mission Bay Field",
  //   "centre_place_id": "ChIJZ0Mj1s9_j4ARt4-u90l2X84",
  //   "centre_location": "37.77075567780977&-122.39383338651577"
  // },
  // {
  //   "centre_name": "Mission Playground Soccer Pitch",
  //   "centre_place_id": "ChIJZ0zooD1-j4ARzVFrHova9O4",
  //   "centre_location": "37.759551392518865&-122.422365701848"
  // },
  {
    "centre_name": "IMPULSTAR PARK",
    "centre_place_id": "impulstarpark",
    "centre_location": "48.954328&2.188729"
  }
];

async function updateCentreLocations(dataArray) {
  for (const centre of dataArray) {
    const [lat, lng] = centre.centre_location.split('&').map(Number);
    const geopoint = new admin.firestore.GeoPoint(lat, lng);

    try {
      await db.collection('cached_centres').add({
        centre_name: centre.centre_name,
        centre_place_id: centre.centre_place_id,
        centre_location: geopoint
      });
      console.log(`Created new document for ${centre.centre_name} successfully.`);
    } catch (error) {
      console.error(`Error creating document for ${centre.centre_name}: `, error);
    }
  }
}

updateCentreLocations(centreData).then(() => {
  console.log('All documents created');
}).catch(error => {
  console.error('An error occurred during the creation process:', error);
});