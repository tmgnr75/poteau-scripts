const fs = require('fs');

const DATA_FILE = 'exports/games_played_12m_1770805660047.json';
const games = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

// ── Helpers ──────────────────────────────────────────────

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function localDate(isoString, tz) {
    if (!isoString) return null;
    try {
        const d = new Date(isoString);
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz || 'Europe/Paris',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false, weekday: 'short'
        }).formatToParts(d);

        const get = (type) => parts.find(p => p.type === type)?.value;
        const weekdayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

        return {
            weekday: weekdayMap[get('weekday')] ?? 0,
            hour: parseInt(get('hour')),
            minute: parseInt(get('minute')),
            month: `${get('year')}-${get('month')}`,
            monthNum: parseInt(get('month')),
        };
    } catch {
        return null;
    }
}

function bar(pct, maxWidth = 40) {
    return '█'.repeat(Math.max(1, Math.round(pct / 100 * maxWidth)));
}

function pct(n, total) {
    return ((n / total) * 100).toFixed(1);
}

function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── Enrich games with local time info ────────────────────

const enriched = games.map(g => {
    const loc = localDate(g.date, g.time_zone);
    const fillRate = g.max_players > 0 ? g.attendee_count / g.max_players : 0;
    return { ...g, loc, fillRate };
}).filter(g => g.loc !== null);

console.log(`\n${'═'.repeat(70)}`);
console.log(`  ANALYSE DES MATCHS JOUÉS — ${enriched.length} matchs (12 derniers mois)`);
console.log(`${'═'.repeat(70)}\n`);

// ══════════════════════════════════════════════════════════
// 1. DISTRIBUTION JOURS × HORAIRES
// ══════════════════════════════════════════════════════════

console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│  1. DISTRIBUTION JOURS × HORAIRES                              │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

// ── 1a. Par jour ─────────────────────────────────────────

const dayDist = Array(7).fill(0);
enriched.forEach(g => dayDist[g.loc.weekday]++);

console.log('  Jour          Matchs     %');
console.log('  ' + '─'.repeat(50));
dayDist.forEach((count, i) => {
    const p = pct(count, enriched.length);
    console.log(`  ${DAY_NAMES[i].padEnd(12)} ${count.toString().padStart(6)}   ${p.padStart(5)}%  ${bar(parseFloat(p))}`);
});

// ── 1b. Par heure ────────────────────────────────────────

const hourDist = Array(24).fill(0);
enriched.forEach(g => hourDist[g.loc.hour]++);

console.log('\n  Heure    Matchs     %');
console.log('  ' + '─'.repeat(50));
for (let h = 6; h <= 23; h++) {
    const count = hourDist[h];
    if (count === 0) continue;
    const p = pct(count, enriched.length);
    console.log(`  ${h.toString().padStart(2)}h     ${count.toString().padStart(6)}   ${p.padStart(5)}%  ${bar(parseFloat(p))}`);
}

// ── 1c. Heatmap jours × horaires ─────────────────────────

const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
enriched.forEach(g => heatmap[g.loc.weekday][g.loc.hour]++);

// Find max for normalization
let heatMax = 0;
heatmap.forEach(row => row.forEach(v => { if (v > heatMax) heatMax = v; }));

const heatChars = [' ', '·', '░', '▒', '▓', '█'];
const heatHours = [];
for (let h = 7; h <= 23; h++) heatHours.push(h);

console.log('\n  HEATMAP — Concentration des matchs (heure locale)');
console.log('  ' + '─'.repeat(60));
console.log('           ' + heatHours.map(h => h.toString().padStart(2)).join(' '));
console.log('           ' + heatHours.map(() => '──').join(' '));

heatmap.forEach((row, day) => {
    let line = `  ${DAY_NAMES[day].substring(0, 3).padEnd(4)} │  `;
    heatHours.forEach(h => {
        const v = row[h];
        const intensity = heatMax > 0 ? Math.round((v / heatMax) * 5) : 0;
        line += heatChars[intensity] + '  ';
    });
    // append actual count for peak hour
    const peakH = heatHours.reduce((best, h) => row[h] > row[best] ? h : best, heatHours[0]);
    line += ` peak: ${peakH}h (${row[peakH]})`;
    console.log(line);
});
console.log('  Légende: · très faible → █ très élevé');

// ── 1d. Comparaison alertes vs réalité ───────────────────

console.log('\n  ALERTES vs RÉALITÉ (% par jour)');
console.log('  ' + '─'.repeat(50));
const alertPcts = [55.5, 54.6, 56.8, 56.9, 60.1, 65.0, 67.2]; // from previous analysis
dayDist.forEach((count, i) => {
    const gamePct = parseFloat(pct(count, enriched.length));
    const alertPct = alertPcts[i];
    const delta = (gamePct - alertPct).toFixed(1);
    const arrow = delta > 0 ? '↑' : '↓';
    console.log(`  ${DAY_NAMES[i].padEnd(12)}  Alertes: ${alertPct.toFixed(1).padStart(5)}%  →  Matchs: ${gamePct.toFixed(1).padStart(5)}%  (${arrow}${Math.abs(parseFloat(delta))}pp)`);
});

// ══════════════════════════════════════════════════════════
// 2. SEMAINE VS WEEKEND
// ══════════════════════════════════════════════════════════

console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│  2. SEMAINE VS WEEKEND                                         │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

const weekday = enriched.filter(g => g.loc.weekday <= 4);
const weekend = enriched.filter(g => g.loc.weekday >= 5);

console.log(`  Semaine (L-V): ${weekday.length} matchs (${pct(weekday.length, enriched.length)}%)`);
console.log(`  Weekend (S-D): ${weekend.length} matchs (${pct(weekend.length, enriched.length)}%)\n`);

function hourDistFor(list, label) {
    const dist = Array(24).fill(0);
    list.forEach(g => dist[g.loc.hour]++);
    console.log(`  ${label}`);
    for (let h = 7; h <= 23; h++) {
        const count = dist[h];
        if (count === 0) continue;
        const p = pct(count, list.length);
        console.log(`    ${h.toString().padStart(2)}h   ${count.toString().padStart(5)}  ${p.padStart(5)}%  ${bar(parseFloat(p))}`);
    }
    console.log('');
}

hourDistFor(weekday, 'Distribution horaire SEMAINE (L-V):');
hourDistFor(weekend, 'Distribution horaire WEEKEND (S-D):');

// Matin weekend spécifique
const morningWeekend = weekend.filter(g => g.loc.hour >= 7 && g.loc.hour < 12);
const eveningWeekday = weekday.filter(g => g.loc.hour >= 18 && g.loc.hour < 22);
console.log(`  Matin weekend (7h-12h):  ${morningWeekend.length} matchs (${pct(morningWeekend.length, weekend.length)}% du WE)`);
console.log(`  Soir semaine (18h-22h):  ${eveningWeekday.length} matchs (${pct(eveningWeekday.length, weekday.length)}% de la semaine)`);

// ══════════════════════════════════════════════════════════
// 3. TAUX DE REMPLISSAGE
// ══════════════════════════════════════════════════════════

console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│  3. TAUX DE REMPLISSAGE                                        │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

const fillRates = enriched.map(g => g.fillRate);
const avgFill = fillRates.reduce((a, b) => a + b, 0) / fillRates.length;
const medFill = median(fillRates);
const fullGames = enriched.filter(g => g.fillRate >= 1.0).length;

console.log(`  Moyenne:  ${(avgFill * 100).toFixed(1)}%`);
console.log(`  Médiane:  ${(medFill * 100).toFixed(1)}%`);
console.log(`  Complets: ${fullGames} (${pct(fullGames, enriched.length)}%)`);

// Par jour
console.log('\n  Par jour:');
console.log('  ' + '─'.repeat(50));
for (let d = 0; d < 7; d++) {
    const dayGames = enriched.filter(g => g.loc.weekday === d);
    const dayFill = dayGames.reduce((s, g) => s + g.fillRate, 0) / dayGames.length;
    const dayFull = dayGames.filter(g => g.fillRate >= 1.0).length;
    console.log(`  ${DAY_NAMES[d].padEnd(12)}  Remplissage: ${(dayFill * 100).toFixed(1).padStart(5)}%  Complets: ${pct(dayFull, dayGames.length).padStart(5)}%`);
}

// Par tranche horaire
console.log('\n  Par tranche horaire:');
console.log('  ' + '─'.repeat(50));
const timeSlots = [
    { label: 'Matin (7-12h)', min: 7, max: 11 },
    { label: 'Midi (12-14h)', min: 12, max: 13 },
    { label: 'Après-midi (14-18h)', min: 14, max: 17 },
    { label: 'Soirée (18-21h)', min: 18, max: 20 },
    { label: 'Nuit (21h+)', min: 21, max: 23 },
];

timeSlots.forEach(({ label, min, max }) => {
    const slotGames = enriched.filter(g => g.loc.hour >= min && g.loc.hour <= max);
    if (slotGames.length === 0) return;
    const slotFill = slotGames.reduce((s, g) => s + g.fillRate, 0) / slotGames.length;
    const slotFull = slotGames.filter(g => g.fillRate >= 1.0).length;
    console.log(`  ${label.padEnd(22)}  Remplissage: ${(slotFill * 100).toFixed(1).padStart(5)}%  Complets: ${pct(slotFull, slotGames.length).padStart(5)}%  (n=${slotGames.length})`);
});

// Heatmap remplissage jour × tranche
console.log('\n  HEATMAP REMPLISSAGE — % moyen par jour × tranche');
console.log('  ' + '─'.repeat(65));
console.log('           ' + timeSlots.map(s => s.label.split('(')[0].trim().padEnd(10)).join('  '));

for (let d = 0; d < 7; d++) {
    let line = `  ${DAY_NAMES[d].substring(0, 3).padEnd(4)} │ `;
    timeSlots.forEach(({ min, max }) => {
        const slotGames = enriched.filter(g => g.loc.weekday === d && g.loc.hour >= min && g.loc.hour <= max);
        if (slotGames.length === 0) {
            line += '   ---    ';
        } else {
            const fill = slotGames.reduce((s, g) => s + g.fillRate, 0) / slotGames.length;
            line += `${(fill * 100).toFixed(0).padStart(4)}%      `;
        }
        line += '';
    });
    console.log(line);
}

// ══════════════════════════════════════════════════════════
// 4. SPORT
// ══════════════════════════════════════════════════════════

console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│  4. SPORT (foot vs padel)                                      │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

const sportDist = {};
enriched.forEach(g => {
    const s = g.sport || 'unknown';
    sportDist[s] = (sportDist[s] || 0) + 1;
});

Object.entries(sportDist).sort((a, b) => b[1] - a[1]).forEach(([sport, count]) => {
    console.log(`  ${sport.padEnd(15)} ${count.toString().padStart(6)}  (${pct(count, enriched.length)}%)`);
});

// Heatmap par sport
['soccer', 'padel'].forEach(sport => {
    const sportGames = enriched.filter(g => g.sport === sport);
    if (sportGames.length < 50) return;

    console.log(`\n  Heatmap ${sport.toUpperCase()} (n=${sportGames.length}):`);
    const shm = Array.from({ length: 7 }, () => Array(24).fill(0));
    sportGames.forEach(g => shm[g.loc.weekday][g.loc.hour]++);
    let sMax = 0;
    shm.forEach(r => r.forEach(v => { if (v > sMax) sMax = v; }));

    console.log('           ' + heatHours.map(h => h.toString().padStart(2)).join(' '));
    shm.forEach((row, day) => {
        let line = `  ${DAY_NAMES[day].substring(0, 3).padEnd(4)} │  `;
        heatHours.forEach(h => {
            const intensity = sMax > 0 ? Math.round((row[h] / sMax) * 5) : 0;
            line += heatChars[intensity] + '  ';
        });
        console.log(line);
    });
});

// ══════════════════════════════════════════════════════════
// 5. TYPE (pro vs captain)
// ══════════════════════════════════════════════════════════

console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│  5. TYPE DE MATCH (pro vs captain)                             │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

const typeDist = {};
enriched.forEach(g => {
    const t = g.type || 'unknown';
    typeDist[t] = (typeDist[t] || 0) + 1;
});

Object.entries(typeDist).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    const typeGames = enriched.filter(g => g.type === type);
    const typeFill = typeGames.reduce((s, g) => s + g.fillRate, 0) / typeGames.length;
    const typeFull = typeGames.filter(g => g.fillRate >= 1.0).length;
    console.log(`  ${type.padEnd(12)} ${count.toString().padStart(6)} matchs (${pct(count, enriched.length).padStart(5)}%)   Remplissage: ${(typeFill * 100).toFixed(1)}%   Complets: ${pct(typeFull, typeGames.length)}%`);
});

// ══════════════════════════════════════════════════════════
// 6. GÉOGRAPHIE
// ══════════════════════════════════════════════════════════

console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│  6. GÉOGRAPHIE                                                 │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

const countryDist = {};
enriched.forEach(g => {
    const c = g.country_code || 'unknown';
    countryDist[c] = (countryDist[c] || 0) + 1;
});

Object.entries(countryDist).sort((a, b) => b[1] - a[1]).forEach(([cc, count]) => {
    console.log(`  ${cc.padEnd(10)} ${count.toString().padStart(6)}  (${pct(count, enriched.length)}%)`);
});

// FR vs US heatmap comparison
['FR', 'US'].forEach(cc => {
    const ccGames = enriched.filter(g => g.country_code === cc);
    if (ccGames.length < 50) return;

    console.log(`\n  Heatmap ${cc} (n=${ccGames.length}):`);
    const chm = Array.from({ length: 7 }, () => Array(24).fill(0));
    ccGames.forEach(g => chm[g.loc.weekday][g.loc.hour]++);
    let cMax = 0;
    chm.forEach(r => r.forEach(v => { if (v > cMax) cMax = v; }));

    console.log('           ' + heatHours.map(h => h.toString().padStart(2)).join(' '));
    chm.forEach((row, day) => {
        let line = `  ${DAY_NAMES[day].substring(0, 3).padEnd(4)} │  `;
        heatHours.forEach(h => {
            const intensity = cMax > 0 ? Math.round((row[h] / cMax) * 5) : 0;
            line += heatChars[intensity] + '  ';
        });
        console.log(line);
    });

    // Fill rate
    const ccFill = ccGames.reduce((s, g) => s + g.fillRate, 0) / ccGames.length;
    console.log(`  Remplissage moyen ${cc}: ${(ccFill * 100).toFixed(1)}%`);
});

// ══════════════════════════════════════════════════════════
// 7. SAISONNALITÉ
// ══════════════════════════════════════════════════════════

console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│  7. SAISONNALITÉ                                               │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

const monthlyVol = {};
enriched.forEach(g => {
    monthlyVol[g.loc.month] = (monthlyVol[g.loc.month] || 0) + 1;
});

const sortedMonths = Object.keys(monthlyVol).sort();
const monthMax = Math.max(...Object.values(monthlyVol));

console.log('  Mois        Matchs');
console.log('  ' + '─'.repeat(55));
sortedMonths.forEach(m => {
    const count = monthlyVol[m];
    const p = pct(count, enriched.length);
    const b = '█'.repeat(Math.round(count / monthMax * 40));
    console.log(`  ${m}    ${count.toString().padStart(5)}  (${p.padStart(5)}%)  ${b}`);
});

// Seasonal hour patterns (summer = Jun-Aug, winter = Dec-Feb)
const summer = enriched.filter(g => [6, 7, 8].includes(g.loc.monthNum));
const winter = enriched.filter(g => [12, 1, 2].includes(g.loc.monthNum));

console.log(`\n  Été (Jun-Août): ${summer.length} matchs   |   Hiver (Déc-Fév): ${winter.length} matchs\n`);

function peakHour(list) {
    const dist = Array(24).fill(0);
    list.forEach(g => dist[g.loc.hour]++);
    let peak = 0;
    dist.forEach((v, h) => { if (v > dist[peak]) peak = h; });
    return peak;
}

console.log(`  Peak hour été:   ${peakHour(summer)}h`);
console.log(`  Peak hour hiver: ${peakHour(winter)}h`);

// Hour distribution comparison
console.log('\n  Distribution horaire été vs hiver:');
for (let h = 7; h <= 23; h++) {
    const sCount = summer.filter(g => g.loc.hour === h).length;
    const wCount = winter.filter(g => g.loc.hour === h).length;
    if (sCount === 0 && wCount === 0) continue;
    const sPct = summer.length > 0 ? pct(sCount, summer.length) : '0.0';
    const wPct = winter.length > 0 ? pct(wCount, winter.length) : '0.0';
    console.log(`    ${h.toString().padStart(2)}h   Été: ${sPct.padStart(5)}%  Hiver: ${wPct.padStart(5)}%`);
}

// ══════════════════════════════════════════════════════════
// 8. DURÉE ET PRIX
// ══════════════════════════════════════════════════════════

console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│  8. DURÉE ET PRIX                                              │');
console.log('└──────────────────────────────────────────────────────────────────┘\n');

// Duration
const durDist = {};
enriched.forEach(g => {
    if (g.duration) durDist[g.duration] = (durDist[g.duration] || 0) + 1;
});

console.log('  Durée (min)   Matchs      %');
console.log('  ' + '─'.repeat(45));
Object.entries(durDist).sort((a, b) => b[1] - a[1]).forEach(([dur, count]) => {
    console.log(`  ${dur.toString().padStart(5)} min   ${count.toString().padStart(6)}   ${pct(count, enriched.length).padStart(5)}%  ${bar(parseFloat(pct(count, enriched.length)))}`);
});

// Price
const priced = enriched.filter(g => g.price !== null && g.price > 0);
const prices = priced.map(g => g.price);
const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
const medPrice = median(prices);

console.log(`\n  Prix (${priced.length} matchs payants):`);
console.log(`    Moyenne: ${avgPrice.toFixed(2)}€`);
console.log(`    Médiane: ${medPrice}€`);
console.log(`    Min: ${Math.min(...prices)}€  Max: ${Math.max(...prices)}€`);

// Price brackets
const brackets = [
    { label: 'Gratuit', min: 0, max: 0 },
    { label: '1-5€', min: 1, max: 5 },
    { label: '6-10€', min: 6, max: 10 },
    { label: '11-15€', min: 11, max: 15 },
    { label: '16-20€', min: 16, max: 20 },
    { label: '20€+', min: 21, max: 999 },
];

const freeGames = enriched.filter(g => g.price === null || g.price === 0).length;
console.log(`\n  Gratuit: ${freeGames} matchs (${pct(freeGames, enriched.length)}%)\n`);

console.log('  Tranche       Matchs     %      Remplissage');
console.log('  ' + '─'.repeat(55));
brackets.forEach(({ label, min, max }) => {
    let bGames;
    if (min === 0 && max === 0) {
        bGames = enriched.filter(g => g.price === null || g.price === 0);
    } else {
        bGames = enriched.filter(g => g.price >= min && g.price <= max);
    }
    if (bGames.length === 0) return;
    const bFill = bGames.reduce((s, g) => s + g.fillRate, 0) / bGames.length;
    console.log(`  ${label.padEnd(14)} ${bGames.length.toString().padStart(6)}   ${pct(bGames.length, enriched.length).padStart(5)}%     ${(bFill * 100).toFixed(1)}%`);
});

// Duration vs fill rate
console.log('\n  Durée vs Remplissage:');
console.log('  ' + '─'.repeat(45));
Object.keys(durDist).sort((a, b) => parseInt(a) - parseInt(b)).forEach(dur => {
    const dGames = enriched.filter(g => g.duration === parseInt(dur));
    const dFill = dGames.reduce((s, g) => s + g.fillRate, 0) / dGames.length;
    console.log(`  ${dur.toString().padStart(5)} min   Remplissage: ${(dFill * 100).toFixed(1)}%   (n=${dGames.length})`);
});

// ══════════════════════════════════════════════════════════
// EXPORT JSON
// ══════════════════════════════════════════════════════════

const exportData = {
    meta: {
        totalGames: enriched.length,
        period: { from: sortedMonths[0], to: sortedMonths[sortedMonths.length - 1] },
        generatedAt: new Date().toISOString()
    },
    dayDistribution: Object.fromEntries(DAY_NAMES.map((name, i) => [name, dayDist[i]])),
    hourDistribution: Object.fromEntries(
        Array.from({ length: 24 }, (_, h) => [h, hourDist[h]]).filter(([, v]) => v > 0)
    ),
    heatmap: Object.fromEntries(
        DAY_NAMES.map((name, d) => [
            name,
            Object.fromEntries(heatHours.map(h => [h, heatmap[d][h]]))
        ])
    ),
    fillRate: {
        average: avgFill,
        median: medFill,
        byDay: Object.fromEntries(DAY_NAMES.map((name, d) => {
            const dg = enriched.filter(g => g.loc.weekday === d);
            return [name, dg.reduce((s, g) => s + g.fillRate, 0) / dg.length];
        })),
        byTimeSlot: Object.fromEntries(timeSlots.map(({ label, min, max }) => {
            const sg = enriched.filter(g => g.loc.hour >= min && g.loc.hour <= max);
            return [label, sg.length > 0 ? sg.reduce((s, g) => s + g.fillRate, 0) / sg.length : 0];
        }))
    },
    sportDistribution: sportDist,
    typeDistribution: typeDist,
    countryDistribution: countryDist,
    monthlyVolume: monthlyVol,
    durationDistribution: durDist,
};

const outPath = `exports/games_analysis_${Date.now()}.json`;
fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));
console.log(`\n✅ Données exportées: ${outPath}`);
