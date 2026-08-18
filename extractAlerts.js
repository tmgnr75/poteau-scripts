const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin
const serviceAccount = require("../cloud-functions/functions/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function extractAlerts() {
  console.log("Fetching alerts from Firestore...");
  const snapshot = await db.collection("alerts").get();
  console.log(`Total alerts fetched: ${snapshot.size}`);

  const alerts = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    const alert = { id: doc.id };

    for (const [key, value] of Object.entries(data)) {
      if (value && value.toDate) {
        alert[key] = value.toDate().toISOString();
      } else if (value && value._path) {
        alert[key] = value.path;
      } else if (Array.isArray(value)) {
        alert[key] = value.map((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const obj = {};
            for (const [k, v] of Object.entries(item)) {
              if (v && v._path) obj[k] = v.path;
              else if (v && v.toDate) obj[k] = v.toDate().toISOString();
              else obj[k] = v;
            }
            return obj;
          }
          if (item && item._path) return item.path;
          return item;
        });
      } else {
        alert[key] = value;
      }
    }
    alerts.push(alert);
  });

  // Save next to this script
  const outputPath = path.join(__dirname, "alerts_data.json");
  fs.writeFileSync(outputPath, JSON.stringify(alerts, null, 2));
  console.log(`Data saved to ${outputPath}`);
  console.log(`Sample:`, JSON.stringify(alerts[0], null, 2));

  process.exit(0);
}

extractAlerts().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
