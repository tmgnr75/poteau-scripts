// Import necessary modules
const xlsx = require('xlsx');
const jsonfile = require('jsonfile');
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Function to export Firestore collection to JSON
// async function exportToJSON(collectionName, outputFile) {
//     const collectionRef = db.collection(collectionName);
//     const snapshot = await collectionRef.get();

//     const data = [];
//     snapshot.forEach(doc => {
//         data.push({ id: doc.id, ...doc.data() });
//     });

//     jsonfile.writeFile(outputFile, data, { spaces: 2 }, (err) => {
//         if (err) console.error(err);
//         else console.log('JSON file successfully created!');
//     });
// }

// Function to export Firestore collection to XLSX
async function exportToXLSX(collectionName, outputFile) {
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();

    const data = [];
    snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
    });

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, collectionName);
    xlsx.writeFile(workbook, outputFile);

    console.log('XLSX file successfully created!');
}

// Main function to execute export
async function exportFirestore(collectionName, format) {
    const outputFile = `./${collectionName}.${format}`;
    if (format === 'json') {
        await exportToJSON(collectionName, outputFile);
    } else if (format === 'xlsx') {
        await exportToXLSX(collectionName, outputFile);
    } else {
        console.log('Unsupported file format.');
    }
}

// Example usage:
// exportFirestore('roadmap', 'json'); // Export to JSON
exportFirestore('roadmap', 'xlsx'); // Export to XLSX