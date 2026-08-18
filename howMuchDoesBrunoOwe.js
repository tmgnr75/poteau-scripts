const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const TARGET_USER = '/users/HmYKKezkSzc5reCtPkKqUlDscQG3';

(async () => {
    const json = [
        {
            "id": "ch_3RbuBGRtgRDg6WGQ0BYF4wPK",
            "Created date (UTC)": "20/06/2025 01:56",
            "Amount": 12,
            "Amount Refunded": 0,
            "Currency": "eur",
            "Captured": "TRUE",
            "Refunded date (UTC)": "",
            "Status": "Paid",
            "gameId (metadata)": "FvhvFuA6fUtZdoKmzvgA"
        },
        {
            "id": "ch_3Rb33PRtgRDg6WGQ0jnJKWg4",
            "Created date (UTC)": "17/06/2025 17:13",
            "Amount": 8,
            "Amount Refunded": 0,
            "Currency": "eur",
            "Captured": "TRUE",
            "Refunded date (UTC)": "",
            "Status": "Paid",
            "gameId (metadata)": "4t5UunI2wDS5ZlcNnxzP"
        },
        {
            "id": "ch_3RZP8kRtgRDg6WGQ1dETThWM",
            "Created date (UTC)": "13/06/2025 04:24",
            "Amount": 12,
            "Amount Refunded": 12,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "20/06/2025 04:24",
            "Status": "Refunded",
            "gameId (metadata)": "SYQhHvHUdi0d00cOqzYE"
        },
        {
            "id": "ch_3RWruhRtgRDg6WGQ1hMCfGos",
            "Created date (UTC)": "06/06/2025 04:30",
            "Amount": 12,
            "Amount Refunded": 12,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "13/06/2025 04:30",
            "Status": "Refunded",
            "gameId (metadata)": "b9qMNSonR9LP5lUS73vw"
        },
        {
            "id": "ch_3RUKXiRtgRDg6WGQ05zKe6Ic",
            "Created date (UTC)": "30/05/2025 04:28",
            "Amount": 12,
            "Amount Refunded": 12,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "06/06/2025 04:28",
            "Status": "Refunded",
            "gameId (metadata)": "B8EJIrMN9ifT4altipST"
        },
        {
            "id": "ch_3RRn9ZRtgRDg6WGQ1uKO4C7m",
            "Created date (UTC)": "23/05/2025 04:28",
            "Amount": 12,
            "Amount Refunded": 12,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "30/05/2025 04:28",
            "Status": "Refunded",
            "gameId (metadata)": "LBL6QNFC7O1NQmDR7ARw"
        },
        {
            "id": "ch_3ROYXzRtgRDg6WGQ08hJgb90",
            "Created date (UTC)": "14/05/2025 06:12",
            "Amount": 8,
            "Amount Refunded": 8,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "21/05/2025 06:12",
            "Status": "Refunded",
            "gameId (metadata)": "7gfRhLh6yo7TIjQodWaL"
        },
        {
            "id": "ch_3RNoLURtgRDg6WGQ0hEN5VGg",
            "Created date (UTC)": "12/05/2025 04:53",
            "Amount": 12,
            "Amount Refunded": 0,
            "Currency": "eur",
            "Captured": "TRUE",
            "Refunded date (UTC)": "",
            "Status": "Paid",
            "gameId (metadata)": "HO9fBBrZ9vcn7v9nARgS"
        },
        {
            "id": "ch_3RMiTRRtgRDg6WGQ02Kz66Bx",
            "Created date (UTC)": "09/05/2025 04:27",
            "Amount": 12,
            "Amount Refunded": 12,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "16/05/2025 04:27",
            "Status": "Refunded",
            "gameId (metadata)": "oyZqG66QoMXSjlJSXNyZ"
        },
        {
            "id": "ch_3RM15mRtgRDg6WGQ0yI35R8B",
            "Created date (UTC)": "07/05/2025 06:05",
            "Amount": 8,
            "Amount Refunded": 8,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "14/05/2025 06:05",
            "Status": "Refunded",
            "gameId (metadata)": "SwIITvzEO3Tqv5AvWrgq"
        },
        {
            "id": "ch_3RKcnbRtgRDg6WGQ0ctXlrAV",
            "Created date (UTC)": "03/05/2025 09:59",
            "Amount": 12,
            "Amount Refunded": 0,
            "Currency": "eur",
            "Captured": "TRUE",
            "Refunded date (UTC)": "",
            "Status": "Paid",
            "gameId (metadata)": "uxSgV1r4HXpk1k8xAyP9"
        },
        {
            "id": "ch_3RKA6LRtgRDg6WGQ0MC2hsKV",
            "Created date (UTC)": "02/05/2025 03:22",
            "Amount": 12,
            "Amount Refunded": 12,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "09/05/2025 03:22",
            "Status": "Refunded",
            "gameId (metadata)": "yuDb75P6QP9y5zsO56o8"
        },
        {
            "id": "ch_3RI4lnRtgRDg6WGQ0aqW50CT",
            "Created date (UTC)": "26/04/2025 09:16",
            "Amount": 12,
            "Amount Refunded": 12,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "03/05/2025 09:16",
            "Status": "Refunded",
            "gameId (metadata)": "pVF3rBgXJDosWm14ls3f"
        },
        {
            "id": "ch_3RFuhNRtgRDg6WGQ03eSSclB",
            "Created date (UTC)": "20/04/2025 10:02",
            "Amount": 8,
            "Amount Refunded": 0,
            "Currency": "eur",
            "Captured": "TRUE",
            "Refunded date (UTC)": "",
            "Status": "Paid",
            "gameId (metadata)": "ZgGlukdihUOXwjFuS2pC"
        },
        {
            "id": "ch_3QgPfYRtgRDg6WGQ01TwIk4s",
            "Created date (UTC)": "12/01/2025 11:50",
            "Amount": 8,
            "Amount Refunded": 8,
            "Currency": "eur",
            "Captured": "FALSE",
            "Refunded date (UTC)": "17/01/2025 08:24",
            "Status": "Refunded",
            "gameId (metadata)": "rhmogfT5F3g0xrjsxNBW"
        },
        {
            "id": "ch_3QI62ZRtgRDg6WGQ0Ypah2wa",
            "Created date (UTC)": "06/11/2024 10:01",
            "Amount": 8,
            "Amount Refunded": 0,
            "Currency": "eur",
            "Captured": "TRUE",
            "Refunded date (UTC)": "",
            "Status": "Paid",
            "gameId (metadata)": "VO8gypnFawZajE2gfgVR"
        }
    ];

    const paidGames = new Set();

    json.forEach(entry => {
        const gameId = entry['gameId (metadata)'];
        const captured = entry['Captured'] === 'TRUE';
        const status = entry['Status'] === 'Paid';

        if (captured && status && gameId) {
            paidGames.add(gameId);
        }
    });

    console.log(`✅ Found ${paidGames.size} paid games from JSON.`);

    let totalOwed = 0;
    const missingPayments = [];

    for (const entry of json) {
        const gameId = entry['gameId (metadata)'];
        if (!gameId) continue;

        try {
            const gameDoc = await db.collection('games').doc(gameId).get();
            if (!gameDoc.exists) {
                console.warn(`⚠️ Game not found: ${gameId}`);
                continue;
            }

            const game = gameDoc.data();
            if (game.status !== 'played') {
                console.log(`⏩ Skipping game ${gameId} – status is "${game.status}"`);
                continue;
            }

            const targetRef = db.doc(TARGET_USER);
            const userAttended = (game.attendees || []).some(ref => {
                if (ref && typeof ref.path === 'string') {
                    return ref.path === targetRef.path;
                }
                return false;
            });

            if (userAttended) {
                const hasPaid = paidGames.has(gameId);
                if (!hasPaid) {
                    const amount = entry['Amount'];
                    console.log(`❌ Unpaid game by user in ${gameId} – owes ${amount}€`);
                    totalOwed += amount;
                    missingPayments.push({ gameId, amount });
                } else {
                    console.log(`✅ User paid for ${gameId}`);
                }
            } else {
                console.log(`👤 User did not attend ${gameId}`);
            }
        } catch (e) {
            console.error(`🔥 Error processing game ${gameId}:`, e);
        }
    }

    console.log(`\n💰 TOTAL OWED: ${totalOwed}€ across ${missingPayments.length} games`);
    console.table(missingPayments);
})();