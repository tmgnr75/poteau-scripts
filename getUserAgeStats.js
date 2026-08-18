const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function getUserStatistics() {
    try {
        const usersRef = db.collection('users');

        // Query users with a filled birthday field
        const snapshot = await usersRef.where('birthday', '!=', null).get();
        const usersData = snapshot.docs.map((doc) => doc.data());

        const totalUsers = usersData.length;

        if (totalUsers === 0) {
            console.log('No users with a filled birthday field found.');
            return;
        }

        // Initialize variables to store age-related statistics
        let totalAge = 0;
        const ageValues = [];

        usersData.forEach((userData) => {
            const birthday = userData.birthday.toDate();

            if (birthday instanceof Date) {
                const today = new Date();
                const age = today.getFullYear() - birthday.getFullYear();
                const birthdayMonth = birthday.getMonth();
                const currentMonth = today.getMonth();

                if (currentMonth < birthdayMonth || (currentMonth === birthdayMonth && today.getDate() < birthday.getDate())) {
                    totalAge += age - 1;
                } else {
                    totalAge += age;
                }

                ageValues.push(age);

                // Log individual user ages for investigation
                console.log(`User Age: ${age}`);
            }
        });

        const averageAge = totalAge / totalUsers;

        if (ageValues.length === 0) {
            console.log('No users with valid birthday dates found.');
            return;
        }

        ageValues.sort((a, b) => a - b);

        const medianAge = calculateMedian(ageValues);

        // Count users less than 26 and 26 or older
        const ageLessThan26Count = ageValues.filter((age) => age < 26).length;
        const age26OrOlderCount = ageValues.filter((age) => age >= 26).length;

        console.log('Average Age:', averageAge);
        console.log('Median Age:', medianAge);
        console.log('Filled Birthday Field Count:', totalUsers);
        console.log('Age Less Than 26 Count:', ageLessThan26Count);
        console.log('Age 26 or Older Count:', age26OrOlderCount);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to calculate median from an array of numbers
function calculateMedian(arr) {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

// Call the function to get user statistics
getUserStatistics();