const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Day names for display
const DAY_NAMES = {
    1: 'Lundi',
    2: 'Mardi',
    3: 'Mercredi',
    4: 'Jeudi',
    5: 'Vendredi',
    6: 'Samedi',
    7: 'Dimanche'
};

// Time slot categories
function categorizeTime(time) {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 6 && hour < 12) return 'Matin (6h-12h)';
    if (hour >= 12 && hour < 14) return 'Midi (12h-14h)';
    if (hour >= 14 && hour < 18) return 'Après-midi (14h-18h)';
    if (hour >= 18 && hour < 21) return 'Soirée (18h-21h)';
    return 'Nuit (21h+)';
}

// Check if times form a continuous range
function isContiguousTimeRange(times) {
    if (times.length <= 1) return true;
    const sorted = [...times].sort();
    for (let i = 1; i < sorted.length; i++) {
        const prev = parseInt(sorted[i - 1].replace(':', ''));
        const curr = parseInt(sorted[i].replace(':', ''));
        // Allow 30 min gap (e.g., 19:00 -> 19:30 -> 20:00)
        if (curr - prev > 30 && curr - prev !== 70) { // 70 = next hour (e.g., 1930 -> 2000)
            return false;
        }
    }
    return true;
}

// Analyze weekday patterns
function analyzeWeekdayPattern(weekdays) {
    const sorted = [...weekdays].sort((a, b) => a - b);
    const weekdaySet = new Set(sorted);

    // Check for specific patterns
    const hasWeekend = weekdaySet.has(6) && weekdaySet.has(7);
    const hasOnlyWeekend = weekdays.length === 2 && hasWeekend;
    const hasWeekdays = [1, 2, 3, 4, 5].some(d => weekdaySet.has(d));
    const hasAllWeekdays = [1, 2, 3, 4, 5].every(d => weekdaySet.has(d));
    const hasAllDays = weekdays.length === 7;

    if (hasAllDays) return 'Tous les jours';
    if (hasAllWeekdays && !hasWeekend) return 'Semaine complète (L-V)';
    if (hasAllWeekdays && hasWeekend) return 'Semaine + Weekend';
    if (hasOnlyWeekend) return 'Weekend seul (S+D)';
    if (!hasWeekdays && (weekdaySet.has(6) || weekdaySet.has(7))) return 'Weekend partiel';
    if (weekdays.length === 1) return 'Jour unique';
    return 'Jours épars';
}

async function analyzeAlerts() {
    console.log('🔍 Récupération des alertes depuis Firestore...\n');

    const snapshot = await db.collection('alerts').get();
    const alerts = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        alerts.push({
            id: doc.id,
            created: data.created?.toDate() || null,
            places: data.places || [],
            times: data.times || [],
            user: data.user,
            weekdays: data.weekdays || []
        });
    });

    console.log(`📊 Total alertes analysées: ${alerts.length}\n`);

    // ============================================
    // 1. DISTRIBUTION DES JOURS
    // ============================================
    console.log('=' .repeat(60));
    console.log('1. DISTRIBUTION DES JOURS');
    console.log('=' .repeat(60));

    // Count per day
    const dayCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    const dayPatterns = {};
    const daysPerAlert = [];

    alerts.forEach(alert => {
        alert.weekdays.forEach(day => {
            if (dayCount[day] !== undefined) dayCount[day]++;
        });

        const pattern = analyzeWeekdayPattern(alert.weekdays);
        dayPatterns[pattern] = (dayPatterns[pattern] || 0) + 1;
        daysPerAlert.push(alert.weekdays.length);
    });

    console.log('\n📅 Popularité par jour:');
    const sortedDays = Object.entries(dayCount).sort((a, b) => b[1] - a[1]);
    sortedDays.forEach(([day, count]) => {
        const pct = ((count / alerts.length) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(pct / 2));
        console.log(`  ${DAY_NAMES[day].padEnd(10)} ${count.toString().padStart(5)} (${pct}%) ${bar}`);
    });

    console.log('\n📊 Patterns de jours:');
    const sortedPatterns = Object.entries(dayPatterns).sort((a, b) => b[1] - a[1]);
    sortedPatterns.forEach(([pattern, count]) => {
        const pct = ((count / alerts.length) * 100).toFixed(1);
        console.log(`  ${pattern.padEnd(25)} ${count.toString().padStart(5)} (${pct}%)`);
    });

    const avgDays = daysPerAlert.reduce((a, b) => a + b, 0) / daysPerAlert.length;
    console.log(`\n📈 Nombre de jours par alerte:`);
    console.log(`  Moyenne: ${avgDays.toFixed(2)} jours`);
    console.log(`  Min: ${Math.min(...daysPerAlert)} | Max: ${Math.max(...daysPerAlert)}`);

    // Distribution of number of days
    const dayCountDistrib = {};
    daysPerAlert.forEach(n => dayCountDistrib[n] = (dayCountDistrib[n] || 0) + 1);
    console.log('\n  Distribution:');
    Object.keys(dayCountDistrib).sort((a, b) => a - b).forEach(n => {
        const count = dayCountDistrib[n];
        const pct = ((count / alerts.length) * 100).toFixed(1);
        console.log(`    ${n} jour(s): ${count} (${pct}%)`);
    });

    // ============================================
    // 2. DISTRIBUTION DES HORAIRES
    // ============================================
    console.log('\n' + '=' .repeat(60));
    console.log('2. DISTRIBUTION DES HORAIRES');
    console.log('=' .repeat(60));

    const timeCount = {};
    const timeCategories = {};
    const timesPerAlert = [];
    let contiguousCount = 0;

    alerts.forEach(alert => {
        alert.times.forEach(time => {
            timeCount[time] = (timeCount[time] || 0) + 1;
            const cat = categorizeTime(time);
            timeCategories[cat] = (timeCategories[cat] || 0) + 1;
        });
        timesPerAlert.push(alert.times.length);
        if (isContiguousTimeRange(alert.times)) contiguousCount++;
    });

    console.log('\n⏰ Top 20 créneaux les plus populaires:');
    const sortedTimes = Object.entries(timeCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
    sortedTimes.forEach(([time, count]) => {
        const pct = ((count / alerts.length) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(pct / 2));
        console.log(`  ${time.padEnd(6)} ${count.toString().padStart(5)} (${pct}%) ${bar}`);
    });

    console.log('\n🌅 Par catégorie horaire:');
    const sortedCategories = Object.entries(timeCategories).sort((a, b) => b[1] - a[1]);
    const totalTimeSelections = Object.values(timeCategories).reduce((a, b) => a + b, 0);
    sortedCategories.forEach(([cat, count]) => {
        const pct = ((count / totalTimeSelections) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(pct / 2));
        console.log(`  ${cat.padEnd(25)} ${count.toString().padStart(6)} (${pct}%) ${bar}`);
    });

    const avgTimes = timesPerAlert.reduce((a, b) => a + b, 0) / timesPerAlert.length;
    console.log(`\n📈 Nombre de créneaux par alerte:`);
    console.log(`  Moyenne: ${avgTimes.toFixed(2)} créneaux`);
    console.log(`  Min: ${Math.min(...timesPerAlert)} | Max: ${Math.max(...timesPerAlert)}`);

    const contiguousPct = ((contiguousCount / alerts.length) * 100).toFixed(1);
    console.log(`\n🔗 Plages continues vs isolées:`);
    console.log(`  Plages continues: ${contiguousCount} (${contiguousPct}%)`);
    console.log(`  Créneaux isolés: ${alerts.length - contiguousCount} (${(100 - parseFloat(contiguousPct)).toFixed(1)}%)`);

    // Distribution of number of times
    const timeCountDistrib = {};
    timesPerAlert.forEach(n => timeCountDistrib[n] = (timeCountDistrib[n] || 0) + 1);
    console.log('\n  Distribution du nombre de créneaux:');
    Object.keys(timeCountDistrib).sort((a, b) => a - b).slice(0, 15).forEach(n => {
        const count = timeCountDistrib[n];
        const pct = ((count / alerts.length) * 100).toFixed(1);
        console.log(`    ${n} créneau(x): ${count} (${pct}%)`);
    });

    // ============================================
    // 3. COMBINAISONS JOURS + HORAIRES
    // ============================================
    console.log('\n' + '=' .repeat(60));
    console.log('3. COMBINAISONS JOURS + HORAIRES');
    console.log('=' .repeat(60));

    // Analyze by weekday vs weekend
    const weekdayAlerts = alerts.filter(a => a.weekdays.some(d => d <= 5));
    const weekendAlerts = alerts.filter(a => a.weekdays.some(d => d >= 6));
    const weekdayOnlyAlerts = alerts.filter(a => a.weekdays.every(d => d <= 5));
    const weekendOnlyAlerts = alerts.filter(a => a.weekdays.every(d => d >= 6));

    function getTimeStats(alertList) {
        const cats = {};
        alertList.forEach(a => {
            a.times.forEach(t => {
                const cat = categorizeTime(t);
                cats[cat] = (cats[cat] || 0) + 1;
            });
        });
        return cats;
    }

    console.log('\n📊 Horaires pour alertes SEMAINE UNIQUEMENT:');
    const weekdayTimeStats = getTimeStats(weekdayOnlyAlerts);
    const weekdayTotal = Object.values(weekdayTimeStats).reduce((a, b) => a + b, 0);
    Object.entries(weekdayTimeStats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        const pct = weekdayTotal > 0 ? ((count / weekdayTotal) * 100).toFixed(1) : '0.0';
        console.log(`  ${cat.padEnd(25)} ${pct}%`);
    });

    console.log('\n📊 Horaires pour alertes WEEKEND UNIQUEMENT:');
    const weekendTimeStats = getTimeStats(weekendOnlyAlerts);
    const weekendTotal = Object.values(weekendTimeStats).reduce((a, b) => a + b, 0);
    Object.entries(weekendTimeStats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        const pct = weekendTotal > 0 ? ((count / weekendTotal) * 100).toFixed(1) : '0.0';
        console.log(`  ${cat.padEnd(25)} ${pct}%`);
    });

    // Identify user profiles
    console.log('\n👤 Profils types identifiés:');

    const profiles = {
        'Soir en semaine': 0,
        'Matin weekend': 0,
        'Midi flexible': 0,
        'Soirée weekend': 0,
        'Ultra flexible (5+ jours, 10+ créneaux)': 0,
        'Très sélectif (1 jour, ≤3 créneaux)': 0
    };

    alerts.forEach(alert => {
        const isWeekdayOnly = alert.weekdays.every(d => d <= 5);
        const isWeekendOnly = alert.weekdays.every(d => d >= 6);
        const hasEvening = alert.times.some(t => {
            const h = parseInt(t.split(':')[0]);
            return h >= 18 && h < 21;
        });
        const hasMorning = alert.times.some(t => {
            const h = parseInt(t.split(':')[0]);
            return h >= 6 && h < 12;
        });
        const hasNoon = alert.times.some(t => {
            const h = parseInt(t.split(':')[0]);
            return h >= 12 && h < 14;
        });

        if (isWeekdayOnly && hasEvening) profiles['Soir en semaine']++;
        if (isWeekendOnly && hasMorning) profiles['Matin weekend']++;
        if (hasNoon && alert.weekdays.length >= 3) profiles['Midi flexible']++;
        if (isWeekendOnly && hasEvening) profiles['Soirée weekend']++;
        if (alert.weekdays.length >= 5 && alert.times.length >= 10) profiles['Ultra flexible (5+ jours, 10+ créneaux)']++;
        if (alert.weekdays.length === 1 && alert.times.length <= 3) profiles['Très sélectif (1 jour, ≤3 créneaux)']++;
    });

    Object.entries(profiles).sort((a, b) => b[1] - a[1]).forEach(([profile, count]) => {
        const pct = ((count / alerts.length) * 100).toFixed(1);
        console.log(`  ${profile.padEnd(45)} ${count.toString().padStart(5)} (${pct}%)`);
    });

    // ============================================
    // 4. VOLUME ET ACTIVITÉ
    // ============================================
    console.log('\n' + '=' .repeat(60));
    console.log('4. VOLUME ET ACTIVITÉ');
    console.log('=' .repeat(60));

    // Unique users
    const uniqueUsers = new Set(alerts.map(a => a.user));
    console.log(`\n📊 Statistiques générales:`);
    console.log(`  Total alertes: ${alerts.length}`);
    console.log(`  Utilisateurs uniques: ${uniqueUsers.size}`);
    console.log(`  Alertes par utilisateur: ${(alerts.length / uniqueUsers.size).toFixed(2)}`);

    // Alerts per user distribution
    const alertsPerUser = {};
    alerts.forEach(a => {
        alertsPerUser[a.user] = (alertsPerUser[a.user] || 0) + 1;
    });

    const userAlertCounts = Object.values(alertsPerUser);
    const userAlertDistrib = {};
    userAlertCounts.forEach(n => userAlertDistrib[n] = (userAlertDistrib[n] || 0) + 1);

    console.log('\n  Alertes par utilisateur:');
    Object.keys(userAlertDistrib).sort((a, b) => a - b).slice(0, 10).forEach(n => {
        const count = userAlertDistrib[n];
        const pct = ((count / uniqueUsers.size) * 100).toFixed(1);
        console.log(`    ${n} alerte(s): ${count} utilisateurs (${pct}%)`);
    });

    // Places (centres) distribution
    const placesPerAlert = alerts.map(a => a.places.length);
    const placesDistrib = {};
    placesPerAlert.forEach(n => placesDistrib[n] = (placesDistrib[n] || 0) + 1);

    const avgPlaces = placesPerAlert.reduce((a, b) => a + b, 0) / placesPerAlert.length;
    console.log(`\n📍 Centres par alerte:`);
    console.log(`  Moyenne: ${avgPlaces.toFixed(2)} centres`);
    console.log(`  Min: ${Math.min(...placesPerAlert)} | Max: ${Math.max(...placesPerAlert)}`);

    console.log('\n  Distribution:');
    Object.keys(placesDistrib).sort((a, b) => a - b).slice(0, 10).forEach(n => {
        const count = placesDistrib[n];
        const pct = ((count / alerts.length) * 100).toFixed(1);
        console.log(`    ${n} centre(s): ${count} (${pct}%)`);
    });

    // Creation dates analysis
    const validDates = alerts.filter(a => a.created).map(a => a.created);
    if (validDates.length > 0) {
        const oldest = new Date(Math.min(...validDates));
        const newest = new Date(Math.max(...validDates));
        console.log(`\n📅 Période des alertes:`);
        console.log(`  Plus ancienne: ${oldest.toISOString().split('T')[0]}`);
        console.log(`  Plus récente: ${newest.toISOString().split('T')[0]}`);

        // Monthly distribution
        const monthlyDistrib = {};
        validDates.forEach(d => {
            const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            monthlyDistrib[key] = (monthlyDistrib[key] || 0) + 1;
        });

        console.log('\n  Alertes par mois (6 derniers):');
        Object.keys(monthlyDistrib).sort().slice(-6).forEach(month => {
            const count = monthlyDistrib[month];
            const bar = '█'.repeat(Math.round(count / 5));
            console.log(`    ${month}: ${count.toString().padStart(4)} ${bar}`);
        });
    }

    // ============================================
    // 5. HEATMAP JOURS × HORAIRES
    // ============================================
    console.log('\n' + '=' .repeat(60));
    console.log('5. HEATMAP JOURS × HORAIRES');
    console.log('=' .repeat(60));

    // Create a heatmap matrix
    const heatmap = {};
    const timeSlots = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
                       '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

    for (let day = 1; day <= 7; day++) {
        heatmap[day] = {};
        timeSlots.forEach(slot => heatmap[day][slot] = 0);
    }

    alerts.forEach(alert => {
        alert.weekdays.forEach(day => {
            alert.times.forEach(time => {
                const hour = time.split(':')[0] + ':00';
                if (heatmap[day] && heatmap[day][hour] !== undefined) {
                    heatmap[day][hour]++;
                }
            });
        });
    });

    // Find max for normalization
    let maxHeat = 0;
    Object.values(heatmap).forEach(dayData => {
        Object.values(dayData).forEach(count => {
            if (count > maxHeat) maxHeat = count;
        });
    });

    // Print heatmap
    console.log('\n         ' + timeSlots.map(t => t.substring(0, 2)).join(' '));
    console.log('         ' + timeSlots.map(() => '--').join(' '));

    const heatChars = [' ', '░', '▒', '▓', '█'];
    for (let day = 1; day <= 7; day++) {
        let row = DAY_NAMES[day].substring(0, 3).padEnd(5) + ' │ ';
        timeSlots.forEach(slot => {
            const count = heatmap[day][slot];
            const intensity = Math.floor((count / maxHeat) * 4);
            row += heatChars[intensity] + '  ';
        });
        console.log(row);
    }

    console.log('\nLégende: ░ faible → █ élevé');

    // ============================================
    // 6. INSIGHTS POUR LE DESIGN
    // ============================================
    console.log('\n' + '=' .repeat(60));
    console.log('6. INSIGHTS POUR LE DESIGN DE L\'ONBOARDING');
    console.log('=' .repeat(60));

    console.log(`
🎯 RECOMMANDATIONS:

1. JOURS PAR DÉFAUT:
   - Le weekend (Sam/Dim) est très populaire → proposer comme preset
   - Les jours de semaine sont moins sélectionnés individuellement
   - Proposer des presets: "Weekend", "Semaine", "Tous les jours"

2. CRÉNEAUX PAR DÉFAUT:
   - La SOIRÉE (18h-21h) est le créneau dominant
   - Proposer 18h-21h comme plage par défaut
   - Le midi (12h-14h) est un créneau secondaire populaire

3. UX SUGGESTIONS:
   - ${((contiguousCount / alerts.length) * 100).toFixed(0)}% des alertes ont des plages continues
     → Permettre la sélection par glissement (drag) pour les plages
   - Moyenne de ${avgTimes.toFixed(1)} créneaux sélectionnés
     → Prévoir une UI qui supporte facilement 3-6 créneaux
   - Moyenne de ${avgDays.toFixed(1)} jours sélectionnés
     → Les boutons individuels par jour fonctionnent bien

4. SIMPLIFICATION POSSIBLE:
   - ${profiles['Ultra flexible (5+ jours, 10+ créneaux)']} utilisateurs très flexibles
     → Ajouter un bouton "Disponible tout le temps"
   - ${profiles['Très sélectif (1 jour, ≤3 créneaux)']} utilisateurs très sélectifs
     → Garder la granularité fine pour ces utilisateurs
`);

    // Save detailed data to JSON for further analysis
    const exportData = {
        summary: {
            totalAlerts: alerts.length,
            uniqueUsers: uniqueUsers.size,
            avgDaysPerAlert: avgDays,
            avgTimesPerAlert: avgTimes,
            avgPlacesPerAlert: avgPlaces,
            contiguousTimeRangePct: contiguousPct
        },
        dayDistribution: dayCount,
        dayPatterns: dayPatterns,
        timeDistribution: timeCount,
        timeCategories: timeCategories,
        profiles: profiles,
        heatmap: heatmap
    };

    fs.writeFileSync(
        `exports/alerts_analysis_${Date.now()}.json`,
        JSON.stringify(exportData, null, 2)
    );

    console.log('\n✅ Analyse terminée! Données exportées dans exports/alerts_analysis_*.json');

    process.exit(0);
}

analyzeAlerts().catch(error => {
    console.error('Erreur:', error);
    process.exit(1);
});
