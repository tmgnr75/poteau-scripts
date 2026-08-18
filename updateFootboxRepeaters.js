const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateDocuments() {
    try {
        const repeatersData = [
            { id: "0b1htfmSAZBe4MBZMTn6", expectedTime: "16:00", timeZone: "Europe/Paris" },
            { id: "1gaUwjAHOfFN7Xzh4P57", expectedTime: "15:00", timeZone: "Europe/Paris" },
            { id: "35HKzkjQhKdiylEv16gn", expectedTime: "19:00", timeZone: "Europe/Paris" },
            { id: "35dagHmoPn2NRmzjZemJ", expectedTime: "17:00", timeZone: "Europe/Paris" },
            { id: "3IG2KZCSZkfWOjwFmT6p", expectedTime: "23:00", timeZone: "Europe/Paris" },
            { id: "4yPAWVut5NpolLK26zvP", expectedTime: "18:00", timeZone: "Europe/Paris" },
            { id: "5Y71JTOLzsCGcysxYMpl", expectedTime: "14:00", timeZone: "Europe/Paris" },
            { id: "7NFxYtJRaD2vQf3C5s8y", expectedTime: "15:00", timeZone: "Europe/Paris" },
            { id: "7i5undsCkfQASrbUSmcU", expectedTime: "23:00", timeZone: "Europe/Paris" },
            { id: "BRyZRQqu4XSGvNin0xGm", expectedTime: "21:00", timeZone: "Europe/Paris" },
            { id: "F40d6KUGVUK5brxvecMy", expectedTime: "17:00", timeZone: "Europe/Paris" },
            { id: "GHPw7UYWqOS4w1Phtnj5", expectedTime: "20:00", timeZone: "Europe/Paris" },
            { id: "K1nrPQbswDsedVroIWKt", expectedTime: "18:00", timeZone: "Europe/Paris" },
            { id: "N36086UyIelFoNho5J8d", expectedTime: "19:00", timeZone: "Europe/Paris" },
            { id: "NtsmHoLTa2XFsmqGMSbX", expectedTime: "20:00", timeZone: "Europe/Paris" },
            { id: "O1SukStKTgy28XjB99gg", expectedTime: "23:00", timeZone: "Europe/Paris" },
            { id: "Q3ZKuqtFo2f8eOMeVAmM", expectedTime: "14:00", timeZone: "Europe/Paris" },
            { id: "TkDj3yg6mSBnx33RDHDz", expectedTime: "16:00", timeZone: "Europe/Paris" },
            { id: "XxpyrsRBlLZlMTkM6JhF", expectedTime: "19:00", timeZone: "Europe/Paris" },
            { id: "Y4SggDTtMY3i6Rjnqxcj", expectedTime: "23:00", timeZone: "Europe/Paris" },
            { id: "Z26x0rVp2PkMyYJ9936U", expectedTime: "22:00", timeZone: "Europe/Paris" },
            { id: "Z60XbKo8q6MH9EvqAqJw", expectedTime: "15:00", timeZone: "Europe/Paris" },
            { id: "aPbzghOUOyTm8kmyfNdw", expectedTime: "23:00", timeZone: "Europe/Paris" },
            { id: "dzOizbg7yiGe0P6kipzt", expectedTime: "15:00", timeZone: "Europe/Paris" },
            { id: "el9DPhMTU3wrnj0bzNJ8", expectedTime: "13:00", timeZone: "Europe/Paris" },
            { id: "esB2HxdJFvjd2zyuRQm0", expectedTime: "15:00", timeZone: "Europe/Paris" },
            { id: "f1PAUfhpkxeC6MrghbC8", expectedTime: "17:00", timeZone: "Europe/Paris" },
            { id: "fa1GfhFzRVdox7OFQvWh", expectedTime: "14:00", timeZone: "Europe/Paris" },
            { id: "fdVWm0NAmHuebLW0apM5", expectedTime: "16:00", timeZone: "Europe/Paris" },
            { id: "gAMkbhe6H0Cf5VXeQWVJ", expectedTime: "14:00", timeZone: "Europe/Paris" },
            { id: "gTQYpLAaHjFbLQDfEZUl", expectedTime: "19:00", timeZone: "Europe/Paris" },
            { id: "geD6Bb6hZaiflMj9CPY0", expectedTime: "16:00", timeZone: "Europe/Paris" },
            { id: "iRQfSjuU9kK6xuC0WegU", expectedTime: "22:00", timeZone: "Europe/Paris" },
            { id: "j4eKv1AnC0NrET3OeGJB", expectedTime: "16:00", timeZone: "Europe/Paris" },
            { id: "jLQUkSnXCgMXpzvgZ5cA", expectedTime: "22:00", timeZone: "Europe/Paris" },
            { id: "km3YdrPDwkn0Z4IizeD1", expectedTime: "21:00", timeZone: "Europe/Paris" },
            { id: "lDDUGTXex3nkCvvgUxPT", expectedTime: "21:00", timeZone: "Europe/Paris" },
            { id: "o1ibucIPPJqeRZv1TrPA", expectedTime: "22:00", timeZone: "Europe/Paris" },
            { id: "qsAaJTbgw8ld9MrXtuQR", expectedTime: "15:00", timeZone: "Europe/Paris" },
            { id: "tDrcl93tueCOI1GX30gF", expectedTime: "23:00", timeZone: "Europe/Paris" },
            { id: "tQyrpO1wkyIEdaz9k3so", expectedTime: "15:00", timeZone: "Europe/Paris" },
            { id: "vEjV9SJYVSQA7UQcQFWW", expectedTime: "20:00", timeZone: "Europe/Paris" },
            { id: "vM2R30T2Kp3r1DiG5LQv", expectedTime: "20:00", timeZone: "Europe/Paris" },
            { id: "ySCeIumrZm4pxc5Up3xD", expectedTime: "13:00", timeZone: "Europe/Paris" },
            { id: "zgLqyMoRwkaEZpAjhhkc", expectedTime: "17:00", timeZone: "Europe/Paris" }
        ];

        const batch = db.batch();

        repeatersData.forEach(data => {
            const docRef = db.collection('repeaters').doc(data.id);
            batch.update(docRef, { expectedTime: data.expectedTime, timeZone: data.timeZone });
        });

        await batch.commit();
        console.log('Documents updated successfully.');
    } catch (error) {
        console.error('Error updating documents:', error);
    }
}

// Call the function to update documents
updateDocuments();
