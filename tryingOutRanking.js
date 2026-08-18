// Cloud Function triggered when a vote is updated
exports.checkForCyclesBeforeAgreement = functions.firestore
    .document('votes/{voteId}')
    .onUpdate(async (change, context) => {
        const newValue = change.after.data();
        const previousValue = change.before.data();

        // Proceed only if the vote status changed to "agreed"
        if (newValue.status === 'agreed' && previousValue.status !== 'agreed') {
            const voteId = context.params.voteId;
            const bestUserID = newValue.best;
            const worstUserID = newValue.worst;

            console.log(`[Ranking] Checking for cycles before agreement for vote ${voteId} (Best: ${bestUserID}, Worst: ${worstUserID})`);

            // Check if either user is new (not in the ranking collection)
            const bestUserExists = await userExistsInRanking(bestUserID);
            const worstUserExists = await userExistsInRanking(worstUserID);

            // If either user is new, directly create their ranking document and skip cycle detection
            if (!bestUserExists || !worstUserExists) {
                console.log(`[Ranking] No cycle possible as one or both users are new to the ranking system.`);

                // Create ranking documents for new users and update the rankings
                if (!bestUserExists) {
                    console.log(`[Ranking] Creating ranking document for new user: ${bestUserID}`);
                    await createRankingForUser(bestUserID);
                }
                if (!worstUserExists) {
                    console.log(`[Ranking] Creating ranking document for new user: ${worstUserID}`);
                    await createRankingForUser(worstUserID);
                }

                await updateRankings(bestUserID, worstUserID, voteId);

            } else {
                // Existing users, perform cycle detection
                const usersGraph = await getAllUsers();
                const sccs = tarjanSCC(usersGraph, bestUserID, worstUserID);

                if (sccs.length > 0) {
                    // Cycle detected
                    console.log(`[Ranking] Cycle detected in the vote: ${sccs}`);
                    await markVoteAsIllogical(voteId, sccs);
                } else {
                    // No cycle detected, proceed with ranking updates
                    console.log(`[Ranking] No cycle detected, proceeding with ranking update.`);
                    await updateRankings(bestUserID, worstUserID, voteId);
                }
            }
        }
    });

// Function to check if a user exists in the ranking collection
async function userExistsInRanking(userId) {
    const userDocRef = db.collection('ranking').doc(userId);
    const userDoc = await userDocRef.get();
    return userDoc.exists;
}

// Function to create a ranking document for a new user
async function createRankingForUser(userId) {
    await db.collection('ranking').doc(userId).set({
        user: userId,
        better_than: [],
        worse_than: [],
        impacting_votes: []
    });
}

// Update rankings and propagate relationships if no cycle is found
async function updateRankings(bestUserID, worstUserID, voteId) {
    const batch = db.batch();
    const bestUserDocRef = db.collection('ranking').doc(bestUserID);
    const worstUserDocRef = db.collection('ranking').doc(worstUserID);

    // Ensure the ranking documents are created only if no cycle was detected
    console.log(`[Ranking] Creating/Updating ranking documents for Best: ${bestUserID}, Worst: ${worstUserID}`);

    batch.set(bestUserDocRef, {
        user: bestUserID,
        better_than: admin.firestore.FieldValue.arrayUnion(worstUserID),
        impacting_votes: admin.firestore.FieldValue.arrayUnion(voteId)
    }, { merge: true });

    batch.set(worstUserDocRef, {
        user: worstUserID,
        worse_than: admin.firestore.FieldValue.arrayUnion(bestUserID),
        impacting_votes: admin.firestore.FieldValue.arrayUnion(voteId)
    }, { merge: true });

    console.log(`[Ranking] Starting full transitive propagation for Best: ${bestUserID} and Worst: ${worstUserID}`);
    await propagateRelationshipsIteratively(bestUserID, worstUserID, batch);

    // Commit the batch
    console.log(`[Ranking] Committing batch update for rankings.`);
    await batch.commit();
}

// Propagate better_than and worse_than relationships iteratively
async function propagateRelationshipsIteratively(bestUserID, worstUserID, batch) {
    const betterQueue = [worstUserID];
    const worseQueue = [bestUserID];

    console.log(`[Ranking] Starting iterative propagation for Best: ${bestUserID}, Worst: ${worstUserID}`);

    while (betterQueue.length > 0 || worseQueue.length > 0) {
        if (betterQueue.length > 0) {
            const currentWorstID = betterQueue.shift();
            const currentWorstDoc = await db.collection('ranking').doc(currentWorstID).get();
            const currentWorstData = currentWorstDoc.data();

            if (currentWorstData && currentWorstData.better_than) {
                for (const nextWorstID of currentWorstData.better_than) {
                    console.log(`[Ranking] Propagating: ${bestUserID} > ${nextWorstID} (via ${currentWorstID})`);
                    batch.set(db.collection('ranking').doc(bestUserID), {
                        better_than: admin.firestore.FieldValue.arrayUnion(nextWorstID)
                    }, { merge: true });
                    batch.set(db.collection('ranking').doc(nextWorstID), {
                        worse_than: admin.firestore.FieldValue.arrayUnion(bestUserID)
                    }, { merge: true });
                    betterQueue.push(nextWorstID);
                }
            }
        }

        if (worseQueue.length > 0) {
            const currentBestID = worseQueue.shift();
            const currentBestDoc = await db.collection('ranking').doc(currentBestID).get();
            const currentBestData = currentBestDoc.data();

            if (currentBestData && currentBestData.worse_than) {
                for (const nextBestID of currentBestData.worse_than) {
                    console.log(`[Ranking] Propagating: ${nextBestID} > ${worstUserID} (via ${currentBestID})`);
                    batch.set(db.collection('ranking').doc(worstUserID), {
                        worse_than: admin.firestore.FieldValue.arrayUnion(nextBestID)
                    }, { merge: true });
                    batch.set(db.collection('ranking').doc(nextBestID), {
                        better_than: admin.firestore.FieldValue.arrayUnion(worstUserID)
                    }, { merge: true });
                    worseQueue.push(nextBestID);
                }
            }
        }
    }
}

// Get all users for cycle detection
async function getAllUsers() {
    console.log('[Ranking] Retrieving all users for cycle detection.');
    const rankingsSnapshot = await db.collection('ranking').get();
    const graph = {};

    rankingsSnapshot.forEach((doc) => {
        const data = doc.data();
        graph[data.user] = {
            better_than: data.better_than || [],
            worse_than: data.worse_than || []
        };
    });

    return graph;
}