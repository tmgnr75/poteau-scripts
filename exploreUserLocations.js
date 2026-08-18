const path = require('path');
const fnDir = path.resolve(__dirname, '..', 'cloud-functions', 'functions');
const admin = require(path.join(fnDir, 'node_modules', 'firebase-admin'));

admin.initializeApp();
const db = admin.firestore();

async function run() {
  // 1. Query recent active users with last_locations
  console.log('=== Querying users with recent activity and last_locations ===\n');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const snapshot = await db.collection('users')
    .where('last_activity_date', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .limit(100)
    .get();

  console.log(`Found ${snapshot.docs.length} users active in last 30 days\n`);

  // Filter those with last_locations
  const usersWithLocations = [];
  const allLocationFields = new Set();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasLastLocations = data.last_locations && Array.isArray(data.last_locations) && data.last_locations.length > 0;
    const hasLastLocation = data.last_location != null;

    if (hasLastLocations || hasLastLocation) {
      // Collect all location-related fields
      const locationFields = {};
      for (const [key, val] of Object.entries(data)) {
        if (key.toLowerCase().includes('location') || key.toLowerCase().includes('address') ||
            key.toLowerCase().includes('place') || key.toLowerCase().includes('geo') ||
            key.toLowerCase().includes('city') || key.toLowerCase().includes('country')) {
          allLocationFields.add(key);
          locationFields[key] = val;
        }
      }

      usersWithLocations.push({
        userId: doc.id,
        locationFields,
        lastLocationsCount: hasLastLocations ? data.last_locations.length : 0,
      });
    }
  }

  console.log(`Users with location data: ${usersWithLocations.length}`);
  console.log(`All location-related fields found across users: ${[...allLocationFields].join(', ')}\n`);

  // Sort by last_locations count descending, take top 10
  usersWithLocations.sort((a, b) => b.lastLocationsCount - a.lastLocationsCount);
  const top10 = usersWithLocations.slice(0, 10);

  // 2. Display each user
  for (const user of top10) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`USER: ${user.userId} (${user.lastLocationsCount} locations)`);
    console.log(`${'─'.repeat(80)}`);

    for (const [field, value] of Object.entries(user.locationFields)) {
      if (field === 'last_locations' && Array.isArray(value)) {
        console.log(`  ${field}: [${value.length} items]`);
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          console.log(`    [${i}]:`);
          for (const [k, v] of Object.entries(item)) {
            if (v && typeof v === 'object' && v._latitude !== undefined) {
              console.log(`      ${k}: GeoPoint(${v._latitude}, ${v._longitude})`);
            } else if (v && typeof v === 'object' && !(v instanceof Date)) {
              console.log(`      ${k}: ${JSON.stringify(v)}`);
            } else {
              console.log(`      ${k}: ${v}`);
            }
          }
        }
      } else if (value && typeof value === 'object' && value._latitude !== undefined) {
        console.log(`  ${field}: GeoPoint(${value._latitude}, ${value._longitude})`);
      } else {
        console.log(`  ${field}: ${JSON.stringify(value)}`);
      }
    }
    console.log('');
  }

  // 3. Analyze structure consistency
  console.log(`\n${'='.repeat(80)}`);
  console.log('STRUCTURE ANALYSIS');
  console.log(`${'='.repeat(80)}\n`);

  // Collect all keys found in last_locations items
  const itemKeyFrequency = {};
  let totalItems = 0;
  const labelStructures = [];

  for (const user of usersWithLocations) {
    const items = user.locationFields.last_locations || [];
    for (const item of items) {
      totalItems++;
      for (const key of Object.keys(item)) {
        itemKeyFrequency[key] = (itemKeyFrequency[key] || 0) + 1;
        if (key === 'label' || key.startsWith('label')) {
          labelStructures.push({ userId: user.userId, key, value: item[key], type: typeof item[key] });
        }
      }
    }
  }

  console.log(`Total last_locations items analyzed: ${totalItems}`);
  console.log('\nField frequency in last_locations items:');
  for (const [key, count] of Object.entries(itemKeyFrequency).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((count / totalItems) * 100);
    console.log(`  ${key}: ${count}/${totalItems} (${pct}%)`);
  }

  if (labelStructures.length > 0) {
    console.log('\nLabel field samples:');
    const seen = new Set();
    for (const ls of labelStructures) {
      const sig = JSON.stringify({ type: ls.type, value: ls.value });
      if (!seen.has(sig)) {
        seen.add(sig);
        console.log(`  type=${ls.type}, value=${JSON.stringify(ls.value)}`);
      }
    }
  }

  // 4. Check for separate location collections
  console.log('\n\nChecking for separate location collections...');
  const collectionsToCheck = ['locations', 'user_locations', 'addresses', 'places', 'saved_locations'];
  for (const name of collectionsToCheck) {
    try {
      const snap = await db.collection(name).limit(1).get();
      if (!snap.empty) {
        console.log(`  ✅ Collection "${name}" EXISTS (${snap.size}+ docs)`);
        const sample = snap.docs[0].data();
        console.log(`     Sample keys: ${Object.keys(sample).join(', ')}`);
      } else {
        console.log(`  ❌ Collection "${name}" is empty or doesn't exist`);
      }
    } catch (e) {
      console.log(`  ❌ Collection "${name}": ${e.message}`);
    }
  }

  // Also check subcollections on a user doc
  if (top10.length > 0) {
    console.log(`\nChecking subcollections on user ${top10[0].userId}...`);
    const subcollections = await db.collection('users').doc(top10[0].userId).listCollections();
    if (subcollections.length > 0) {
      console.log(`  Subcollections: ${subcollections.map(c => c.id).join(', ')}`);
    } else {
      console.log('  No subcollections found');
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
